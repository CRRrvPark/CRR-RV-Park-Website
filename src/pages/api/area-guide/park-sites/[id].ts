import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';
import { serverClient } from '@lib/supabase';

export const prerender = false;

const MAX_BODY_BYTES = 64_000;

const ALLOWED_FIELDS = [
  'site_number', 'loop',
  'length_feet', 'width_feet', 'pull_through', 'amp_service', 'site_type',
  'nightly_rate', 'weekly_rate', 'monthly_rate',
  'hero_image_url', 'gallery_image_urls', 'description', 'features',
  'map_position_x', 'map_position_y', 'map_polygon',
  'firefly_deep_link', 'is_available', 'is_published',
  // V4 park-map status fields (migration 016). CHECK constraint on
  // park_sites.status enforces the allowed vocabulary — invalid values
  // come back as a 400 from Supabase, which surfaces as the admin toast.
  'status', 'status_note',
] as const;

function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) if (key in body) out[key] = body[key];
  return out;
}

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    if (!params.id) return json({ error: 'Missing id' }, 400);
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413);

    const body = (await request.json()) as Record<string, unknown>;
    const sanitized = sanitize(body);
    const sb = serverClient();
    const { data, error } = await sb.from('park_sites').update(sanitized).eq('id', params.id).select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ site: data });
  } catch (err) {
    return handleError(err);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    if (!params.id) return json({ error: 'Missing id' }, 400);
    const sb = serverClient();
    const { error } = await sb.from('park_sites').delete().eq('id', params.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
};
