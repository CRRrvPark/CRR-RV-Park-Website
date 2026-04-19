/**
 * Admin CRUD for things_to_do.
 *   GET  /api/area-guide/things
 *   POST /api/area-guide/things
 */

import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';
import { serverClient } from '@lib/supabase';

export const prerender = false;

const MAX_BODY_BYTES = 256_000;

const ALLOWED_FIELDS = [
  'slug', 'title', 'summary', 'description',
  'category', 'personas',
  'location_name', 'lat', 'lng', 'distance_from_park',
  'hero_image_url', 'gallery_image_urls', 'icon',
  'external_link', 'details_html',
  'is_published', 'display_order',
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
    const { data, error } = await sb.from('things_to_do').select('*').order('display_order');
    if (error) throw error;
    return json({ things: data ?? [] });
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
    if (!sanitized.slug || !sanitized.title || !sanitized.category) {
      return json({ error: 'slug, title, and category are required' }, 400);
    }

    const sb = serverClient();
    const { data, error } = await sb.from('things_to_do').insert(sanitized).select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ thing: data }, 201);
  } catch (err) {
    return handleError(err);
  }
};
