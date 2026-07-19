/**
 * GET /api/snapshots — list snapshots (any auth'd)
 * POST /api/snapshots — manually create a snapshot (editor+)
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { captureSnapshot } from '@lib/content';
import { requireAuth, requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();
    // Don't include the full `state` blob in list view (can be several MB);
    // fetch it lazily via /api/snapshots/[id].
    const { data, error } = await sb
      .from('snapshots')
      .select('id, triggered_by, reason, byte_size, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return json({ error: error.message }, 500);
    return json({ snapshots: data });
  } catch (err) {
    return handleError(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'restore_snapshot');
    const body = await request.json().catch(() => ({}));
    const reason = body.reason ?? 'manual';

    const id = await captureSnapshot(reason, user.id);
    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'snapshot_created',
      targetTable: 'snapshots',
      targetId: id,
      notes: `Manual snapshot: ${reason}`,
      ...requestContext(request),
    });

    return json({ status: 'created', snapshotId: id });
  } catch (err) {
    return handleError(err);
  }
};
