/**
 * /api/content/blocks
 *   GET    — list content blocks (filterable by page/section)
 *   PATCH  — update a content block (editor+) or create a draft (contributor)
 *
 * Banned-word check runs on every PATCH.
 */

import type { APIRoute } from 'astro';
import { verifyRequestUser } from '@lib/auth';

export const prerender = false;
import { can, isRoleAtLeast } from '@lib/rbac';
import { serverClient } from '@lib/supabase';
import { assertNoBannedWords, BannedWordError } from '@lib/content';
import { logAudit, requestContext } from '@lib/audit';

export const GET: APIRoute = async ({ request, url }) => {
  const user = await verifyRequestUser(request);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  const sb = serverClient();
  const pageSlug = url.searchParams.get('page');
  const sectionKey = url.searchParams.get('section');

  // Inverted query: fetch sections (with their content_blocks via left-join
  // semantics), then flatten back to the legacy { blocks, blocks[i].sections }
  // shape the editor expects. This way, sections with ZERO blocks (newly
  // created via the Section Library) still appear in the editor.
  if (pageSlug) {
    const { data: page } = await sb.from('pages').select('id').eq('slug', pageSlug).maybeSingle();
    if (!page) return json({ blocks: [] });

    let secQ = sb.from('sections').select('*, content_blocks(*)').eq('page_id', page.id);
    if (sectionKey) secQ = secQ.eq('key', sectionKey);

    const { data: sections, error } = await secQ;
    if (error) return json({ error: error.message }, 500);

    // Flatten: emit one row per content_block with `.sections` denormalized.
    // For sections with zero blocks, emit a single placeholder row so the
    // editor still groups it. Use a nullish marker so the editor can filter it.
    const blocks: any[] = [];
    for (const s of sections ?? []) {
      const sectionMeta = { id: s.id, key: s.key, type: s.type, display_name: s.display_name, display_order: s.display_order, is_visible: s.is_visible };
      if (!s.content_blocks || s.content_blocks.length === 0) {
        blocks.push({ __empty_section: true, sections: sectionMeta });
        continue;
      }
      for (const b of s.content_blocks) {
        blocks.push({ ...b, sections: sectionMeta });
      }
    }
    return json({ blocks });
  }

  // Fallback (no pageSlug): legacy behavior
  let q = sb.from('content_blocks').select('*, sections!inner(*, pages!inner(*))');
  if (sectionKey) q = q.eq('sections.key', sectionKey);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);
  return json({ blocks: data });
};

export const PATCH: APIRoute = async ({ request }) => {
  const user = await verifyRequestUser(request);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  const body = await request.json() as {
    blockId: string;
    value_text?: string;
    value_html?: string;
    value_json?: unknown;
    value_number?: number;
    value_boolean?: boolean;
    value_image_url?: string;
    value_image_alt?: string;
    value_image_width?: number;
    value_image_height?: number;
  };

  if (!body.blockId) return json({ error: 'blockId is required' }, 400);

  // SECURITY: validate URL fields (image_url, also URL-typed text fields) against
  // a strict allow-list. Block javascript:, data:, vbscript: schemes that could
  // be used to inject script execution into image src or href attributes when
  // rendered with set:html or as an <a href> target.
  if (body.value_image_url !== undefined && body.value_image_url !== null && body.value_image_url !== '') {
    if (!isSafeUrl(body.value_image_url)) {
      return json({ error: 'Invalid image URL — must be a relative path (starting with /) or https URL.' }, 422);
    }
  }
  // For URL-typed blocks the value lives in value_text. We don't know the
  // block's type without an extra fetch, but text values that LOOK like URLs
  // get the same treatment so we can't be tricked by `javascript:...` text.
  if (body.value_text && /^(javascript|data|vbscript|file|about):/i.test(body.value_text.trim())) {
    return json({ error: 'URL scheme not allowed in text value.' }, 422);
  }

  // Banned-word check
  try {
    assertNoBannedWords(body.value_text);
    assertNoBannedWords(body.value_html);
  } catch (err) {
    if (err instanceof BannedWordError) {
      return json({ error: err.message, hits: err.hits }, 422);
    }
    throw err;
  }

  // SECURITY: sanitize rich-text HTML — strip <script>, on* attributes, and
  // javascript: hrefs that an attacker (or compromised browser extension)
  // could inject into a Tiptap-bound editor before submit.
  if (body.value_html) {
    body.value_html = sanitizeRichHtml(body.value_html);
  }

  const sb = serverClient();
  const { data: existing } = await sb.from('content_blocks').select('*').eq('id', body.blockId).single();
  if (!existing) return json({ error: 'block not found' }, 404);

  const updates: Record<string, unknown> = {};
  for (const k of ['value_text', 'value_html', 'value_json', 'value_number', 'value_boolean', 'value_image_url', 'value_image_alt', 'value_image_width', 'value_image_height']) {
    if (k in body) updates[k] = (body as any)[k];
  }

  if (isRoleAtLeast(user.role, 'editor')) {
    // Direct write
    const { error } = await sb.from('content_blocks').update(updates).eq('id', body.blockId);
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'content_blocks',
      targetId: body.blockId,
      beforeValue: existing,
      afterValue: { ...existing, ...updates },
      ...requestContext(request),
    });
    return json({ status: 'updated' });
  }

  if (can(user.role, 'edit_content_draft')) {
    // Create a draft
    const { data: draft, error } = await sb.from('content_block_drafts').insert({
      content_block_id: body.blockId,
      drafted_by: user.id,
      ...updates,
      status: 'pending',
    }).select('id').single();
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'content_block_drafts',
      targetId: draft?.id,
      beforeValue: existing,
      afterValue: updates,
      notes: 'Draft awaiting editor approval',
      ...requestContext(request),
    });
    return json({ status: 'draft_created', draftId: draft?.id });
  }

  return json({ error: 'forbidden' }, 403);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Allow-list URL validator. Accepts:
 *   - Relative paths: /images/foo.jpg, /book-now.html, #section-anchor
 *   - https URLs (and http for localhost dev only — be loose; we're not the only XSS guard)
 *   - mailto: / tel: for contact info
 * Rejects: javascript:, data:, vbscript:, file:, about:
 */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('//')) return false; // protocol-relative — could be hijacked
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^(mailto|tel):/i.test(trimmed)) return true;
  return false;
}

/**
 * Conservative HTML sanitizer for rich_text content from Tiptap.
 *
 * Removes:
 *   - <script>, <style>, <iframe>, <object>, <embed>, <form>, <input> tags (full)
 *   - on* event handler attributes (onclick, onerror, onload, etc.)
 *   - href / src attributes with disallowed schemes (javascript:, data:, vbscript:)
 *
 * Tiptap's StarterKit already only emits a safe subset, so this is defense
 * in depth — protects against bypasses, malicious extensions, or future
 * additions to the allowed extensions list.
 */
function sanitizeRichHtml(html: string): string {
  // Strip dangerous tags wholesale (including their content).
  let cleaned = html.replace(
    /<(script|style|iframe|object|embed|form|input|svg|math|link|meta|base)[\s\S]*?<\/\1\s*>/gi,
    ''
  );
  // Self-closing variants
  cleaned = cleaned.replace(/<(script|style|iframe|object|embed|form|input|svg|math|link|meta|base)[^>]*\/?>/gi, '');
  // Strip on* event handler attributes. PT-2 fix: HTML allows '/' as an
  // attribute separator (`<img/src=x/onerror=…>` parses identically to
  // space-separated), so `\s+` alone was bypassable. Match whitespace OR '/'.
  cleaned = cleaned.replace(/[\s\/]on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // PT-3 fix: strip style attributes that contain legacy CSS-based XSS
  // vectors (javascript:/vbscript:/expression()/‑moz-binding/behavior).
  cleaned = cleaned.replace(
    /\sstyle\s*=\s*("[^"]*(?:javascript:|vbscript:|expression\s*\(|-moz-binding|behavior\s*:)[^"]*"|'[^']*(?:javascript:|vbscript:|expression\s*\(|-moz-binding|behavior\s*:)[^']*')/gi,
    ''
  );
  // Strip dangerous URL schemes from href= / src= / xlink:href=
  cleaned = cleaned.replace(
    /(href|src|xlink:href)\s*=\s*("|')\s*(javascript|data|vbscript|file|about)\s*:[^"']*\2/gi,
    '$1=$2#blocked-unsafe-url$2'
  );
  cleaned = cleaned.replace(
    /(href|src|xlink:href)\s*=\s*(javascript|data|vbscript|file|about)\s*:[^\s>]*/gi,
    '$1=#blocked-unsafe-url'
  );
  return cleaned;
}
