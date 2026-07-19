/**
 * /api/sections/[id]
 *   PATCH  — update section: display_name, display_order, is_visible
 *   DELETE — delete section + cascade-delete its content_blocks
 *
 * Required role: editor or owner.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireRole(request, 'edit_content_direct');
    const body = await request.json() as {
      display_name?: string;
      display_order?: number;
      is_visible?: boolean;
    };

    const sb = serverClient();
    const { data: before } = await sb.from('sections').select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'not found' }, 404);

    const updates: Record<string, unknown> = {};
    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.display_order !== undefined) updates.display_order = body.display_order;
    if (body.is_visible !== undefined) updates.is_visible = body.is_visible;

    if (Object.keys(updates).length === 0) {
      return json({ error: 'no updates provided' }, 400);
    }

    const { data, error } = await sb.from('sections').update(updates).eq('id', params.id).select('*').single();
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'sections',
      targetId: params.id as string,
      targetLabel: before.display_name,
      beforeValue: before,
      afterValue: data,
      ...requestContext(request),
    });

    return json({ section: data });
  } catch (err) {
    return handleError(err);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireRole(request, 'edit_content_direct');
    const sb = serverClient();

    const { data: before } = await sb.from('sections').select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'not found' }, 404);

    // content_blocks will cascade-delete via the FK ON DELETE CASCADE
    const { error } = await sb.from('sections').delete().eq('id', params.id);
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'sections',
      targetId: params.id as string,
      targetLabel: `Deleted section: ${before.display_name}`,
      beforeValue: before,
      ...requestContext(request),
    });

    return json({ status: 'deleted' });
  } catch (err) {
    return handleError(err);
  }
};
