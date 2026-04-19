/**
 * POST /api/snapshots/restore
 *
 * Body: { snapshotId: string }
 *
 * Restores all content from a snapshot. Always captures a pre-restore
 * snapshot first, so the operation is reversible.
 *
 * Required role: editor or owner.
 */

import type { APIRoute } from 'astro';
import { verifyRequestUser } from '@lib/auth';

export const prerender = false;
import { requireCapability, ForbiddenError } from '@lib/rbac';
import { restoreSnapshot } from '@lib/content';
import { logAudit, requestContext } from '@lib/audit';

export const POST: APIRoute = async ({ request }) => {
  const user = await verifyRequestUser(request);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  try {
    requireCapability(user.role, 'restore_snapshot');
  } catch (err) {
    if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
    throw err;
  }

  const { snapshotId } = await request.json() as { snapshotId: string };
  if (!snapshotId) return json({ error: 'snapshotId required' }, 400);

  try {
    await restoreSnapshot(snapshotId, user.id);
    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'snapshot_restored',
      targetTable: 'snapshots',
      targetId: snapshotId,
      ...requestContext(request),
    });
    return json({ status: 'restored', snapshotId });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
