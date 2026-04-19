/**
 * Admin CRUD for local_places.
 *   GET  /api/area-guide/places      — list
 *   POST /api/area-guide/places      — create (editor+)
 *
 * To refresh Google cached_data, call POST /api/places/[id].
 */

import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';
import { serverClient } from '@lib/supabase';

export const prerender = false;

const MAX_BODY_BYTES = 64_000;

const ALLOWED_FIELDS = [
  'slug',
  'name_override',
  'google_place_id',
  'category',
  'our_description',
  'featured',
  'is_published',
  'display_order',
] as const;

function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) if (key in body) out[key] = body[key];
  return out;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'view_area_guide');
    const sb = serverClient();
    const { data, error } = await sb.from('local_places').select('*').order('display_order');
    if (error) throw error;
    return json({ places: data ?? [] });
  } catch (err) {
    return handleError(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413);

    const body = (await request.json()) as Record<string, unknown>;
    const sanitized = sanitize(body);
    if (!sanitized.google_place_id) {
      return json({ error: 'google_place_id is required' }, 400);
    }

    const sb = serverClient();
    const { data, error } = await sb.from('local_places').insert(sanitized).select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ place: data }, 201);
  } catch (err) {
    return handleError(err);
  }
};
