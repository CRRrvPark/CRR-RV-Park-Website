/**
 * POST /api/sections — add a new section to a page from the Section Library.
 *
 * Body: { pageSlug, type, displayName?, afterSectionId? }
 *
 * Creates the section row + all default content_blocks for the chosen type.
 * If afterSectionId is provided, inserts after that section in display order.
 * Otherwise appends to the end.
 *
 * Required role: editor or owner.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';
import { getSectionType } from '@lib/section-types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'edit_content_direct');
    const body = await request.json() as {
      pageSlug: string;
      type: string;
      displayName?: string;
      afterSectionId?: string | null;
    };
    if (!body.pageSlug || !body.type) {
      return json({ error: 'pageSlug and type required' }, 400);
    }

    const template = getSectionType(body.type);
    if (!template) {
      return json({ error: `Unknown section type: ${body.type}` }, 400);
    }

    const sb = serverClient();

    // Resolve the page
    const { data: page } = await sb.from('pages').select('id').eq('slug', body.pageSlug).single();
    if (!page) return json({ error: `Unknown page slug: ${body.pageSlug}` }, 404);

    // Compute display_order: place after the specified section, or at end
    let newOrder: number;
    if (body.afterSectionId) {
      const { data: anchor } = await sb.from('sections').select('display_order').eq('id', body.afterSectionId).single();
      if (!anchor) return json({ error: 'afterSectionId not found' }, 404);
      newOrder = anchor.display_order + 5;
      // Bump everything after the anchor down by 10 to make room
      // (cheap reindex; cleaner than gap-management)
      const { data: subsequent } = await sb
        .from('sections')
        .select('id, display_order')
        .eq('page_id', page.id)
        .gt('display_order', anchor.display_order)
        .order('display_order', { ascending: true });
      for (const s of subsequent ?? []) {
        if (s.display_order < newOrder + 5) {
          await sb.from('sections').update({ display_order: s.display_order + 10 }).eq('id', s.id);
        }
      }
    } else {
      const { data: last } = await sb
        .from('sections')
        .select('display_order')
        .eq('page_id', page.id)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      newOrder = (last?.display_order ?? -10) + 10;
    }

    // Generate a unique section key (template type + numeric suffix to avoid collisions)
    const baseKey = template.type;
    let key = baseKey;
    let suffix = 1;
    while (true) {
      const { data: existing } = await sb
        .from('sections')
        .select('id')
        .eq('page_id', page.id)
        .eq('key', key)
        .maybeSingle();
      if (!existing) break;
      suffix++;
      key = `${baseKey}_${suffix}`;
    }

    // Create the section row
    const { data: section, error: secErr } = await sb.from('sections').insert({
      page_id: page.id,
      key,
      type: template.type,
      display_name: body.displayName ?? template.name,
      display_order: newOrder,
      is_visible: true,
    }).select('*').single();
    if (secErr || !section) return json({ error: secErr?.message ?? 'failed to create section' }, 500);

    // Create the default content_blocks for this section type
    const blocks = template.blocks.map((b, i) => ({
      section_id: section.id,
      key: b.key,
      display_name: b.display_name,
      block_type: b.block_type,
      display_order: i * 10,
      notes: b.notes ?? null,
      value_text: b.default_text ?? null,
      value_html: b.default_html ?? null,
      value_json: b.default_json ?? null,
      value_number: b.default_number ?? null,
      value_boolean: b.default_boolean ?? null,
      value_image_url: b.default_image_url ?? null,
      value_image_alt: b.default_image_alt ?? null,
      value_image_width: b.default_image_width ?? null,
      value_image_height: b.default_image_height ?? null,
    }));
    if (blocks.length > 0) {
      const { error: blocksErr } = await sb.from('content_blocks').insert(blocks);
      if (blocksErr) {
        // Rollback the section row to avoid orphan
        await sb.from('sections').delete().eq('id', section.id);
        return json({ error: `failed to create blocks: ${blocksErr.message}` }, 500);
      }
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'sections',
      targetId: section.id,
      targetLabel: `Added '${template.name}' section to ${body.pageSlug}`,
      afterValue: { type: template.type, key, display_order: newOrder },
      ...requestContext(request),
    });

    return json({ section, blocks_created: blocks.length });
  } catch (err) {
    return handleError(err);
  }
};
