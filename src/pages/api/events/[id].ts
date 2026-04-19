/**
 * /api/events/[id]
 *   PATCH — toggle is_published (editor+)
 *
 * Does NOT allow editing event content — events are synced from Zoho and
 * should be edited there. The only admin-side control is visibility.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireRole(request, 'hide_synced_event');
    const { isPublished } = await request.json() as { isPublished: boolean };
    if (typeof isPublished !== 'boolean') {
      return json({ error: 'isPublished (boolean) required' }, 400);
    }

    const sb = serverClient();
    const { data: before } = await sb.from('events').select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'not found' }, 404);

    const { data, error } = await sb
      .from('events')
      .update({ is_published: isPublished })
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'events',
      targetId: params.id as string,
      targetLabel: before.title,
      beforeValue: { is_published: before.is_published },
      afterValue: { is_published: isPublished },
      ...requestContext(request),
    });

    return json({ event: data });
  } catch (err) {
    return handleError(err);
  }
};
