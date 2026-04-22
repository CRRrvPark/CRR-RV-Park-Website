/**
 * /api/park-map — read/write the single active park_map row.
 *
 *   GET  /api/park-map             — returns { parkMap } for the active row,
 *                                    or { parkMap: null } when no active map
 *                                    exists yet. Requires view_area_guide.
 *   PUT  /api/park-map             — upsert the active park_map with an
 *                                    image URL + natural dimensions.
 *                                    Requires manage_area_guide.
 *
 * Per-site polygon writes go through the existing PATCH on
 * /api/area-guide/park-sites/[id] — no separate "region" endpoint,
 * because map_polygon lives directly on park_sites (not in a join table).
 *
 * The endpoint enforces the partial-unique-index contract on
 * park_maps.is_active: it marks any existing active rows inactive
 * before inserting/updating the new one, so the DB never has two
 * active rows at once.
 */

import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';
import { serverClient } from '@lib/supabase';

export const prerender = false;

const MAX_BODY_BYTES = 4_000;

interface PutBody {
  slug?: string;
  title?: string;
  image_url?: string;
  natural_width?: number;
  natural_height?: number;
  notes?: string;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'view_area_guide');
    const sb = serverClient();
    const { data, error } = await sb
      .from('park_maps')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return json({ parkMap: data ?? null });
  } catch (err) {
    return handleError(err);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413);

    const body = (await request.json()) as PutBody;
    const image_url = typeof body.image_url === 'string' ? body.image_url.trim() : '';
    if (!image_url) return json({ error: 'image_url required' }, 400);
    const natural_width = Number(body.natural_width);
    const natural_height = Number(body.natural_height);
    if (!Number.isFinite(natural_width) || natural_width <= 0) return json({ error: 'natural_width must be > 0' }, 400);
    if (!Number.isFinite(natural_height) || natural_height <= 0) return json({ error: 'natural_height must be > 0' }, 400);
    const slug = (typeof body.slug === 'string' && body.slug.trim()) || 'default';
    const title = (typeof body.title === 'string' && body.title.trim()) || 'Crooked River Ranch — Park Map';
    const notes = typeof body.notes === 'string' ? body.notes : '';

    const sb = serverClient();

    // Deactivate any currently active rows first. The partial unique index
    // on (is_active=true) means we can only ever have one active; flipping
    // the old one off before inserting/updating keeps the constraint happy.
    const { error: deactErr } = await sb
      .from('park_maps')
      .update({ is_active: false })
      .eq('is_active', true);
    if (deactErr) throw deactErr;

    // Upsert by slug. Preserves id + created_at on subsequent re-uploads.
    const { data, error } = await sb
      .from('park_maps')
      .upsert(
        { slug, title, image_url, natural_width, natural_height, notes, is_active: true },
        { onConflict: 'slug' },
      )
      .select('*')
      .single();
    if (error) throw error;

    return json({ parkMap: data });
  } catch (err) {
    return handleError(err);
  }
};
