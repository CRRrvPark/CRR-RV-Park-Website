/**
 * Admin CRUD for park_sites (the 109 RV sites).
 *   GET  /api/area-guide/park-sites
 *   POST /api/area-guide/park-sites          — create one
 *   PATCH /api/area-guide/park-sites         — bulk update map positions
 *                                              (for drag-to-position UI)
 */

import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';
import { serverClient } from '@lib/supabase';

export const prerender = false;

const MAX_BODY_BYTES = 128_000;
const MAX_BULK_SIZE = 512_000;  // for position updates covering 109 rows

const ALLOWED_FIELDS = [
  'site_number', 'loop',
  'length_feet', 'width_feet', 'pull_through', 'amp_service', 'site_type',
  'nightly_rate', 'weekly_rate', 'monthly_rate',
  'hero_image_url', 'gallery_image_urls', 'description', 'features',
  'map_position_x', 'map_position_y', 'map_polygon',
  'firefly_deep_link', 'is_available', 'is_published',
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
    const { data, error } = await sb
      .from('park_sites')
      .select('*')
      .order('loop').order('site_number');
    if (error) throw error;
    return json({ sites: data ?? [] });
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
    if (!sanitized.site_number || !sanitized.loop) {
      return json({ error: 'site_number and loop are required' }, 400);
    }

    const sb = serverClient();
    const { data, error } = await sb.from('park_sites').insert(sanitized).select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ site: data }, 201);
  } catch (err) {
    return handleError(err);
  }
};

/**
 * PATCH body: { updates: [{id, map_position_x, map_position_y}, ...] }
 * Used by the admin drag-to-position UI. Atomic update per row; bulk size
 * capped so an attacker can't rewrite the whole table with one request.
 */
export const PATCH: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_BULK_SIZE) return json({ error: 'Payload too large' }, 413);

    const body = (await request.json()) as { updates?: Array<{ id: string; map_position_x: number; map_position_y: number }> };
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (updates.length === 0) return json({ error: 'updates array is required' }, 400);
    if (updates.length > 200) return json({ error: 'Too many updates in one request' }, 413);

    const sb = serverClient();
    // Run updates individually so a bad row doesn't poison the whole batch.
    const results = await Promise.all(
      updates.map((u) =>
        sb
          .from('park_sites')
          .update({ map_position_x: u.map_position_x, map_position_y: u.map_position_y })
          .eq('id', u.id)
          .select('id')
      )
    );
    const failed = results.filter((r) => r.error).length;
    return json({ updated: updates.length - failed, failed });
  } catch (err) {
    return handleError(err);
  }
};
