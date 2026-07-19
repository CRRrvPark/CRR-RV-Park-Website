/**
 * POST /api/publish — trigger a production publish of the current content.
 *
 * Flow:
 *   1. Verify caller is authenticated and has 'publish_content' capability
 *   2. Capture a pre-publish snapshot (for restore)
 *   3. Insert a 'queued' row in `publishes`
 *   4. Trigger Netlify build hook (or Deploy API)
 *   5. Return publish ID; client polls /api/publish/[id]/status
 *   6. (Background) Netlify build runs; webhook updates publish row to success/failed
 *      — webhook handler at /api/publish/webhook
 *
 * If the build fails, the auto-rollback in /api/publish/webhook restores
 * the previous successful deploy via Netlify's restoreDeploy.
 */

import type { APIRoute } from 'astro';
import { verifyRequestUser } from '@lib/auth';

export const prerender = false;
import { can, ForbiddenError } from '@lib/rbac';
import { serverClient } from '@lib/supabase';
import { captureSnapshot } from '@lib/content';
import { triggerBuildHook } from '@lib/netlify';
import { logAudit, requestContext } from '@lib/audit';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifyRequestUser(request);
    if (!user) return json({ error: 'unauthenticated' }, 401);
    if (!can(user.role, 'publish_content')) {
      throw new ForbiddenError('You do not have permission to publish');
    }

    const sb = serverClient();

    // 1. Snapshot
    const snapshotId = await captureSnapshot('pre_publish', user.id);

    // 2. Queue row
    const { count: blockCount } = await sb.from('content_blocks').select('*', { count: 'exact', head: true });
    const { data: pubRow, error: pubErr } = await sb.from('publishes').insert({
      triggered_by: user.id,
      status: 'queued',
      snapshot_id: snapshotId,
      content_block_count: blockCount ?? 0,
    }).select('id').single();
    if (pubErr || !pubRow) throw new Error(pubErr?.message ?? 'Failed to insert publish row');

    // 3. Audit
    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_publish_request',
      targetTable: 'publishes',
      targetId: pubRow.id,
      ...requestContext(request),
    });

    // 4. Trigger Netlify
    let buildOk = false;
    try {
      const r = await triggerBuildHook();
      buildOk = r.ok;
    } catch (err: any) {
      await sb.from('publishes').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: `Build hook failed: ${err.message}`,
      }).eq('id', pubRow.id);
      await logAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: 'publish_failed',
        targetTable: 'publishes',
        targetId: pubRow.id,
        notes: err.message,
      });
      return json({ error: err.message }, 500);
    }

    if (buildOk) {
      await sb.from('publishes').update({ status: 'building' }).eq('id', pubRow.id);
    }

    return json({ publishId: pubRow.id, status: 'building', snapshotId });
  } catch (err: any) {
    if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
    console.error('[publish] error:', err);
    return json({ error: err.message ?? 'unknown error' }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
