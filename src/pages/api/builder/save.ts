/**
 * POST /api/builder/save
 *
 * Two modes:
 *   { slug, data, reason: 'auto' }      → upsert page_drafts (auto-save)
 *   { slug, data, reason: 'publish' }   → write to pages.page_builder_data,
 *                                          set use_page_builder=true,
 *                                          insert page_versions row,
 *                                          clear the draft
 *   { slug, data, reason: 'manual', label? } → insert page_versions only
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';
import { triggerBuildHook } from '@lib/netlify';
import { sanitizePuckData } from '@lib/puck-sanitize';

export const prerender = false;

/**
 * Max accepted body size for a builder save. A real page with every field
 * filled in is well under 100 KB; 500 KB gives generous headroom without
 * letting an authenticated attacker stream arbitrary-size JSON into the
 * DB. See PT-6 in PEN-TEST-REPORT.md.
 */
const MAX_BUILDER_BODY_BYTES = 500 * 1024;

export const POST: APIRoute = async ({ request }) => {
  try {
    // PT-6: body-size cap BEFORE we read+parse the body. The
    // Content-Length header is a fast first check; we also cap the read.
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BUILDER_BODY_BYTES) {
      return json(
        { error: `Payload too large (${declared} bytes). Max ${MAX_BUILDER_BODY_BYTES} bytes.` },
        413
      );
    }

    // All three modes (auto / manual / publish) require at least
    // edit_content_draft (contributor+). Viewers must not be able to
    // overwrite any drafts. Publish tightens further below.
    const user = await requireRole(request, 'edit_content_draft');
    const body = await request.json() as {
      slug: string;
      data: unknown;
      reason: 'auto' | 'publish' | 'manual';
      label?: string;
    };

    const { slug, data, reason, label } = body;
    if (!slug) return json({ error: 'slug required' }, 400);
    if (!data || typeof data !== 'object') {
      return json({ error: 'data required and must be an object' }, 400);
    }

    // Shape-validate so a malformed or malicious payload can't corrupt the DB.
    const puckData = data as { content?: unknown; root?: unknown; zones?: unknown };
    if (!Array.isArray(puckData.content)) {
      return json({ error: 'data.content must be an array' }, 400);
    }

    // Run sanitization on every rich-text / URL field in the Puck JSON
    // BEFORE we store it. Without this, any contributor with draft access
    // could inject stored XSS that fires on the public site after an
    // editor publishes. See HIGH-4 in SECURITY-AND-BUGS-REPORT.md.
    const sanitized = sanitizePuckData(puckData);

    const sb = serverClient();

    // Resolve page
    const { data: page, error: pageErr } = await sb
      .from('pages')
      .select('id')
      .eq('slug', slug)
      .single();
    if (pageErr || !page) return json({ error: `Page "${slug}" not found` }, 404);

    // --- Auto-save: upsert draft ---
    if (reason === 'auto') {
      const { error: draftErr } = await sb
        .from('page_drafts')
        .upsert({
          page_id: page.id,
          data: sanitized,
          saved_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'page_id' });

      if (draftErr) return json({ error: draftErr.message }, 500);
      return json({ saved: true, reason: 'auto' });
    }

    // --- Manual checkpoint ---
    if (reason === 'manual') {
      const { error: verErr } = await sb.from('page_versions').insert({
        page_id: page.id,
        data: sanitized,
        reason: 'manual',
        label: label || null,
        saved_by: user.id,
      });
      if (verErr) return json({ error: verErr.message }, 500);

      await logAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: 'snapshot_created',
        targetTable: 'page_versions',
        targetId: page.id,
        targetLabel: `Manual checkpoint: ${label || slug}`,
        ...requestContext(request),
      });

      return json({ saved: true, reason: 'manual' });
    }

    // --- Publish ---
    if (reason === 'publish') {
      // Require editor+ for publishing
      const pubUser = await requireRole(request, 'publish_content');

      // 1. Create a version snapshot
      const { error: verErr } = await sb.from('page_versions').insert({
        page_id: page.id,
        data: sanitized,
        reason: 'publish',
        label: label || `Published ${new Date().toLocaleString()}`,
        saved_by: pubUser.id,
      });
      if (verErr) return json({ error: verErr.message }, 500);

      // 2. Write to pages.page_builder_data + flip the flag
      const { error: pageUpdateErr } = await sb
        .from('pages')
        .update({
          page_builder_data: sanitized,
          use_page_builder: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', page.id);
      if (pageUpdateErr) return json({ error: pageUpdateErr.message }, 500);

      // 3. Clear the draft (it's been committed)
      await sb.from('page_drafts').delete().eq('page_id', page.id);

      // 4. Audit
      await logAudit({
        actorId: pubUser.id,
        actorEmail: pubUser.email,
        action: 'content_publish_request',
        targetTable: 'pages',
        targetId: page.id,
        targetLabel: `Published visual editor: /${slug}`,
        ...requestContext(request),
      });

      // 5. Prune old versions (keep last 50)
      await sb.rpc('prune_page_versions', { p_page_id: page.id, p_keep: 50 }).catch(() => {});

      // 6. Trigger Netlify rebuild so prerendered public pages pick up the
      // new content. Non-fatal if the hook isn't configured or fails —
      // the content is still saved; just won't appear live until next build.
      let rebuildTriggered = false;
      if (process.env.NETLIFY_BUILD_HOOK) {
        try {
          await triggerBuildHook();
          rebuildTriggered = true;
        } catch (err) {
          console.warn('[builder/save] build hook failed (non-fatal):', err);
        }
      }

      return json({ saved: true, reason: 'publish', slug, rebuildTriggered });
    }

    return json({ error: `Unknown reason: ${reason}` }, 400);
  } catch (err) {
    return handleError(err);
  }
};
