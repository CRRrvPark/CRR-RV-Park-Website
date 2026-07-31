/**
 * /api/media/[id]
 *   GET    — single media item
 *   PATCH  — update alt text, display name, caption (editor+)
 *   DELETE — soft-delete (set is_active=false). Checks usage first.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();
    const { data, error } = await sb.from('media').select('*').eq('id', params.id).single();
    if (error) return json({ error: error.message }, 404);
    return json({ media: data });
  } catch (err) {
    return handleError(err);
  }
};

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireRole(request, 'upload_media');
    const body = await request.json();
    const sb = serverClient();

    const { data: before } = await sb.from('media').select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'not found' }, 404);

    const allowed = ['display_name', 'alt_text', 'caption'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) updates[k] = body[k];

    const { data, error } = await sb.from('media').update(updates).eq('id', params.id).select('*').single();
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'media',
      targetId: params.id as string,
      targetLabel: before.filename,
      beforeValue: before,
      afterValue: data,
      ...requestContext(request),
    });

    return json({ media: data });
  } catch (err) {
    return handleError(err);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireRole(request, 'delete_media');
    const sb = serverClient();

    const { data: before } = await sb.from('media').select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'not found' }, 404);

    // Usage check: is this image referenced anywhere? Check BOTH the
    // legacy content_blocks table AND the newer Puck page_builder_data
    // JSONB column. (BUG-2 in SECURITY-AND-BUGS-REPORT.md.)
    //
    // MEDIUM-2: escape PostgREST filter-meta + LIKE wildcards so a
    // maliciously-named file can't inject additional filter clauses.
    const imageUrl = before.public_url_jpg ?? before.public_url_webp;
    if (imageUrl) {
      const escaped = String(imageUrl).replace(/[\\%_]/g, (m) => '\\' + m);

      const [legacyExact, legacyText, legacyHtml, puckRefs] = await Promise.all([
        sb.from('content_blocks').select('*', { count: 'exact', head: true }).eq('value_image_url', imageUrl),
        sb.from('content_blocks').select('*', { count: 'exact', head: true }).ilike('value_text', `%${escaped}%`),
        sb.from('content_blocks').select('*', { count: 'exact', head: true }).ilike('value_html', `%${escaped}%`),
        // Puck JSON lives in page_builder_data JSONB — search the text cast.
        sb.from('pages')
          .select('*', { count: 'exact', head: true })
          .filter('page_builder_data::text', 'ilike', `%${escaped}%`),
      ]);
      const total =
        (legacyExact.count ?? 0) +
        (legacyText.count ?? 0) +
        (legacyHtml.count ?? 0) +
        (puckRefs.count ?? 0);
      if (total > 0) {
        return json({
          error: `This image is still referenced by ${total} content item(s). Replace those references before deleting.`,
          referenceCount: total,
          detail: {
            content_blocks_exact: legacyExact.count ?? 0,
            content_blocks_text: legacyText.count ?? 0,
            content_blocks_html: legacyHtml.count ?? 0,
            puck_pages: puckRefs.count ?? 0,
          },
        }, 409);
      }
    }

    const { error } = await sb.from('media').update({ is_active: false }).eq('id', params.id);
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'media_removed',
      targetTable: 'media',
      targetId: params.id as string,
      targetLabel: before.filename,
      beforeValue: before,
      ...requestContext(request),
    });

    return json({ status: 'deleted' });
  } catch (err) {
    return handleError(err);
  }
};
