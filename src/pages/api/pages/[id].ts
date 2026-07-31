/**
 * /api/pages/[id]
 *   GET    — fetch single page
 *   PATCH  — update page settings (title, meta, draft state, nav, etc.)
 *   DELETE — remove page (owner only; protected pages cannot be deleted)
 *
 * The DB enforces:
 *   - protected pages cannot be deleted
 *   - the index page cannot become a draft
 *   - slug must match safe pattern + not be reserved
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

const PATCHABLE_FIELDS = [
  'title', 'meta_description', 'og_image', 'hero_preload',
  'canonical_url', 'is_draft', 'show_in_main_nav', 'nav_order',
  'schemas',
];

export const GET: APIRoute = async ({ request, params }) => {
  try {
    await requireRole(request, 'view_content');
    const sb = serverClient();
    const { data, error } = await sb.from('pages').select('*').eq('id', params.id).single();
    if (error) return json({ error: error.message }, 404);
    return json({ page: data });
  } catch (err) {
    return handleError(err);
  }
};

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireRole(request, 'edit_content_direct');
    const body = await request.json();
    const sb = serverClient();

    const { data: before } = await sb.from('pages').select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'not found' }, 404);

    const updates: Record<string, unknown> = {};
    for (const k of PATCHABLE_FIELDS) {
      if (k in body) updates[k] = body[k];
    }
    // Slug change is intentionally NOT allowed — would break links / SEO.
    // If slug really needs to change: delete and recreate (keeps the URL change explicit).

    if (Object.keys(updates).length === 0) {
      return json({ error: 'no patchable fields supplied' }, 400);
    }

    const { data, error } = await sb.from('pages').update(updates).eq('id', params.id).select('*').single();
    if (error) {
      if (error.message.includes('cannot be a draft') || error.message.includes('reserved')) {
        return json({ error: error.message }, 400);
      }
      return json({ error: error.message }, 500);
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'pages',
      targetId: params.id as string,
      targetLabel: `Updated page settings: ${before.title} (/${before.slug})`,
      beforeValue: before,
      afterValue: data,
      ...requestContext(request),
    });

    return json({ page: data });
  } catch (err) {
    return handleError(err);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    // Owner-level destructive action — use the dedicated `delete_page`
    // capability (MEDIUM-4). Previously reused `change_user_role` which
    // was conceptually wrong even though both resolve to owner.
    const user = await requireRole(request, 'delete_page');
    const sb = serverClient();

    const { data: before } = await sb.from('pages').select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'not found' }, 404);
    if (before.is_protected) {
      return json({ error: `Page "${before.slug}" is protected and cannot be deleted.` }, 409);
    }

    const { error } = await sb.from('pages').delete().eq('id', params.id);
    if (error) {
      if (error.message.includes('protected')) return json({ error: error.message }, 409);
      return json({ error: error.message }, 500);
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'pages',
      targetId: params.id as string,
      targetLabel: `Deleted page: ${before.title} (/${before.slug})`,
      beforeValue: before,
      ...requestContext(request),
    });

    return json({ status: 'deleted' });
  } catch (err) {
    return handleError(err);
  }
};
