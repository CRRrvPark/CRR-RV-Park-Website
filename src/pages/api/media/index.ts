/**
 * GET /api/media       — list media (any auth'd)
 * POST /api/media      — record a new media item (editor+; mostly used by sync)
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, requireRole, handleError, json } from '@lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);
    const search = url.searchParams.get('q') ?? '';
    const sb = serverClient();
    let q = sb.from('media').select('*').eq('is_active', true).order('updated_at', { ascending: false });
    if (search) {
      // Escape %/_ LIKE wildcards in user search to avoid surprise matches
      // (BUG-5 in SECURITY-AND-BUGS-REPORT.md).
      const escaped = search.replace(/[\\%_]/g, (m) => '\\' + m);
      q = q.ilike('filename', `%${escaped}%`);
    }
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    return json({ media: data });
  } catch (err) {
    return handleError(err);
  }
};

/**
 * Allow-list of columns a client can set when inserting a media row.
 * Columns managed by the sync pipeline (public_url_*, zoho_resource_id,
 * storage_path_*, last_synced_at) are deliberately excluded — direct
 * inserts via /api/media must carry only user-facing metadata. See
 * HIGH-6 in SECURITY-AND-BUGS-REPORT.md.
 */
const MEDIA_INSERT_ALLOWED = [
  'filename',
  'display_name',
  'alt_text',
  'caption',
  'mime_type',
  'byte_size',
  'width',
  'height',
] as const;

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'upload_media');
    const body = await request.json() as Record<string, unknown>;
    const insert: Record<string, unknown> = {};
    for (const k of MEDIA_INSERT_ALLOWED) {
      if (k in body) insert[k] = body[k];
    }
    if (!insert.filename || typeof insert.filename !== 'string') {
      return json({ error: 'filename (string) is required' }, 400);
    }
    const sb = serverClient();
    const { data, error } = await sb.from('media').insert(insert).select('*').single();
    if (error) return json({ error: error.message }, 500);
    return json({ media: data }, 201);
  } catch (err) {
    return handleError(err);
  }
};
