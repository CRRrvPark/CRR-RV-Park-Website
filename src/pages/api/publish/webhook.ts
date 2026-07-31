/**
 * POST /api/publish/webhook — Netlify build status callback.
 *
 * Configure this URL as an outgoing webhook in Netlify:
 *   Site settings → Build & deploy → Deploy notifications → Add notification
 *   Event: "Deploy succeeded" + "Deploy failed"
 *   URL: https://www.crookedriverranchrv.com/api/publish/webhook
 *
 * Netlify posts a JSON payload; we find the matching publish row and update
 * its status. If the build failed in production, we auto-rollback to the
 * previous successful deploy via the Netlify restoreDeploy API.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { restoreDeploy, listRecentDeploys } from '@lib/netlify';
import { logAudit } from '@lib/audit';
import { json, requireScheduledOrAuth, handleError } from '@lib/api';

export const prerender = false;

interface NetlifyWebhookPayload {
  id: string;
  state: string;
  context?: string;          // 'production' | 'deploy-preview' | 'branch-deploy'
  deploy_url?: string;
  ssl_url?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
  branch?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // SECURITY: require shared secret (Netlify webhook URL includes ?secret=...)
    // or an authenticated user. Without this gate, anyone could fake a "build
    // failed" event and trigger auto-rollback of the live site.
    await requireScheduledOrAuth(request);
  } catch (err) {
    return handleError(err);
  }
  const payload = (await request.json()) as NetlifyWebhookPayload;
  const sb = serverClient();

  // BUG-3: match the Netlify deploy to the correct `publishes` row.
  //
  // Preferred: if this webhook's deploy ID already matches a row (the
  // publishes table stores `netlify_deploy_id` once known), use that.
  //
  // Fallback: match the most-recent queued/building publish whose
  // `started_at` is within the window before the deploy's `created_at`.
  // This is an imperfect heuristic but safer than "most recent" alone,
  // which confused rapid successive publishes.
  let pub: any = null;

  if (payload.id) {
    const { data: byId } = await sb
      .from('publishes')
      .select('*')
      .eq('netlify_deploy_id', payload.id)
      .limit(1);
    if (byId && byId[0]) pub = byId[0];
  }

  if (!pub) {
    // Time-proximity match: look at pending publishes whose started_at is
    // within the last 30 minutes AND before the deploy's created_at.
    const deployCreatedAt = payload.created_at ? new Date(payload.created_at).toISOString() : new Date().toISOString();
    const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: pending } = await sb
      .from('publishes')
      .select('*')
      .in('status', ['queued', 'building'])
      .gte('started_at', windowStart)
      .lte('started_at', deployCreatedAt)
      .order('started_at', { ascending: false })
      .limit(1);
    pub = pending?.[0] ?? null;
  }
  const now = new Date().toISOString();

  if (payload.state === 'ready' || payload.state === 'success') {
    if (pub) {
      await sb.from('publishes').update({
        status: 'success',
        netlify_deploy_id: payload.id,
        netlify_deploy_url: payload.deploy_url ?? payload.ssl_url,
        completed_at: now,
        duration_ms: pub.started_at ? Date.now() - new Date(pub.started_at).getTime() : null,
      }).eq('id', pub.id);
      await logAudit({
        actorId: pub.triggered_by,
        action: 'publish_succeeded',
        targetTable: 'publishes',
        targetId: pub.id,
        notes: `Netlify deploy ${payload.id} complete`,
      });
    }
    return json({ status: 'recorded' });
  }

  if (payload.state === 'error' || payload.state === 'failed') {
    let rollbackInfo: string | null = null;

    // Auto-rollback on production failures
    if (payload.context === 'production') {
      try {
        const deploys = await listRecentDeploys(10);
        const lastGood = deploys.find(d =>
          d.id !== payload.id &&
          d.context === 'production' &&
          d.state === 'ready'
        );
        if (lastGood) {
          await restoreDeploy(lastGood.id);
          rollbackInfo = `Auto-restored to ${lastGood.id}`;
        }
      } catch (err: any) {
        console.error('[publish/webhook] auto-rollback failed:', err);
        rollbackInfo = `Rollback attempt failed: ${err.message}`;
      }
    }

    if (pub) {
      await sb.from('publishes').update({
        status: rollbackInfo ? 'rolled_back' : 'failed',
        netlify_deploy_id: payload.id,
        completed_at: now,
        error_message: payload.error_message ?? 'build failed',
      }).eq('id', pub.id);
      await logAudit({
        actorId: pub.triggered_by,
        action: 'publish_failed',
        targetTable: 'publishes',
        targetId: pub.id,
        notes: `${payload.error_message ?? 'build failed'} — ${rollbackInfo ?? 'no rollback attempted'}`,
      });
    }

    return json({ status: 'recorded', rollback: rollbackInfo });
  }

  // Any other state — just record
  return json({ status: 'ignored', state: payload.state });
};
