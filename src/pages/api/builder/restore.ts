/**
 * POST /api/builder/restore
 *
 * Restores a page's builder data from a specific version.
 * Creates a pre_restore snapshot first (so the restore is always reversible).
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'restore_snapshot');
    const { slug, versionId } = await request.json() as { slug: string; versionId: string };
    if (!slug || !versionId) return json({ error: 'slug and versionId required' }, 400);

    const sb = serverClient();

    // Load the target version
    const { data: version, error: vErr } = await sb
      .from('page_versions')
      .select('id, page_id, data')
      .eq('id', versionId)
      .single();
    if (vErr || !version) return json({ error: 'Version not found' }, 404);

    // MEDIUM-5: verify the versionId actually belongs to the requested slug.
    // Previously slug was just echoed into the audit log — a user could
    // pass slug=index with a versionId from /about and restore /about's
    // data into /index's draft.
    const { data: page } = await sb
      .from('pages')
      .select('id')
      .eq('slug', slug)
      .single();
    if (!page || page.id !== version.page_id) {
      return json({ error: `Version ${versionId} does not belong to page /${slug}.` }, 400);
    }

    // Load current state to snapshot before restore
    const { data: currentDraft } = await sb
      .from('page_drafts')
      .select('data')
      .eq('page_id', version.page_id)
      .maybeSingle();

    const { data: currentPage } = await sb
      .from('pages')
      .select('page_builder_data')
      .eq('id', version.page_id)
      .single();

    const currentData = currentDraft?.data ?? currentPage?.page_builder_data;

    // Save a pre_restore snapshot (so we can undo the restore)
    if (currentData) {
      await sb.from('page_versions').insert({
        page_id: version.page_id,
        data: currentData,
        reason: 'pre_restore',
        label: 'Auto: before restore',
        saved_by: user.id,
      });
    }

    // Write restored data to drafts (user must still publish to go live)
    await sb.from('page_drafts').upsert({
      page_id: version.page_id,
      data: version.data,
      saved_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'page_id' });

    // Audit
    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'snapshot_restored',
      targetTable: 'page_versions',
      targetId: versionId,
      targetLabel: `Restored builder version for /${slug}`,
      ...requestContext(request),
    });

    return json({ restored: true, data: version.data });
  } catch (err) {
    return handleError(err);
  }
};
