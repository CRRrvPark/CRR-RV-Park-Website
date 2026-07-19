/**
 * POST /api/code/publish
 *
 * Body: { draftId: string, confirm: true }
 *
 * Promotes an open code draft to production. Requires:
 *   - Owner role (edit_code/publish_code)
 *   - Explicit `confirm: true` (so UI can't publish by accident)
 *   - Preceded by a successful preview build (draft.status must be 'preview_built')
 *
 * What it does:
 *   1. Snapshots current content (pre_code_publish)
 *   2. Applies the draft's content to the source file (writes to filesystem
 *      when running in a full dev environment; in production this step is
 *      replaced by writing to Supabase Storage and re-building via Deploy API)
 *   3. Triggers production publish
 *   4. Marks draft as published
 *
 * NOTE: In the Netlify Functions runtime there is NO writable filesystem for
 * persisting code changes across deploys. So the long-term implementation
 * writes the draft content to a dedicated `code_overrides` Supabase bucket,
 * and the Astro build reads from there to compose the live source.
 *
 * Phase 3 implementation: full flow. This scaffold is the API surface.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { captureSnapshot } from '@lib/content';
import { triggerBuildHook } from '@lib/netlify';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'publish_code');
    const { draftId, confirm } = await request.json() as { draftId: string; confirm: boolean };
    if (!draftId || !confirm) {
      return json({ error: 'draftId and confirm=true both required' }, 400);
    }

    const sb = serverClient();
    const { data: draft } = await sb.from('code_drafts').select('*').eq('id', draftId).single();
    if (!draft) return json({ error: 'draft not found' }, 404);
    if (draft.status !== 'preview_built') {
      return json({
        error: 'Draft must have a successful preview build before publishing. Run /api/code/preview first.',
        currentStatus: draft.status,
      }, 409);
    }

    // 1. Snapshot
    const snapshotId = await captureSnapshot('pre_code_publish', user.id);

    // 2. Apply the draft (implementation deferred — see top-of-file note).
    //    For Phase 3 MVP, we mark the draft published and trigger a build.
    //    The build pipeline reads code_overrides from Supabase Storage.

    // 3. Trigger production build
    let buildOk = false;
    try {
      await triggerBuildHook();
      buildOk = true;
    } catch (err: any) {
      return json({ error: `Build trigger failed: ${err.message}` }, 500);
    }

    // 4. Mark draft published
    await sb.from('code_drafts').update({
      status: 'published',
      published_at: new Date().toISOString(),
    }).eq('id', draftId);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'code_published',
      targetTable: 'code_drafts',
      targetId: draftId,
      targetLabel: draft.file_path,
      notes: `Snapshot: ${snapshotId}`,
      ...requestContext(request),
    });

    return json({ status: 'published', snapshotId, buildOk });
  } catch (err) {
    return handleError(err);
  }
};
