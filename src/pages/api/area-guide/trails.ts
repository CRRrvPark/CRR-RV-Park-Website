/**
 * Admin CRUD for trails.
 *   GET  /api/area-guide/trails        — list (editor+)
 *   POST /api/area-guide/trails        — create (editor+)
 *   PATCH /api/area-guide/trails/[id]  — update (editor+) (separate file)
 *   DELETE /api/area-guide/trails/[id] — delete (editor+) (separate file)
 *
 * Write endpoints are rate-limited by body-size caps and field allow-lists.
 */

import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';
import { serverClient } from '@lib/supabase';

export const prerender = false;

const MAX_BODY_BYTES = 256_000;

const ALLOWED_FIELDS = [
  'slug',
  'name',
  'summary',
  'description',
  'distance_miles',
  'elevation_gain_feet',
  'difficulty',
  'pet_friendly',
  'kid_friendly',
  'hazards',
  'hero_image_url',
  'gallery_image_urls',
  'trailhead_lat',
  'trailhead_lng',
  'parking_info',
  'season',
  'drive_time_from_park',
  'external_link',
  'gpx_data',
  'is_on_property',
  'is_published',
  'display_order',
] as const;

function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) out[key] = body[key as keyof typeof body];
  }
  return out;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'view_area_guide');
    const sb = serverClient();
    const { data, error } = await sb
      .from('trails')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return json({ trails: data ?? [] });
  } catch (err) {
    return handleError(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_BODY_BYTES) return json({ error: `Payload too large (${len} > ${MAX_BODY_BYTES} bytes)` }, 413);

    const body = (await request.json()) as Record<string, unknown>;
    const sanitized = sanitize(body);
    if (!sanitized.slug || !sanitized.name) {
      return json({ error: 'slug and name are required' }, 400);
    }

    const sb = serverClient();
    const { data, error } = await sb
      .from('trails')
      .insert(sanitized)
      .select('*')
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ trail: data }, 201);
  } catch (err) {
    return handleError(err);
  }
};
