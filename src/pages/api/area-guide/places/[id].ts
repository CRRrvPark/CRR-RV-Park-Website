import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';
import { serverClient } from '@lib/supabase';

export const prerender = false;

const MAX_BODY_BYTES = 64_000;

const ALLOWED_FIELDS = [
  'slug', 'name_override', 'google_place_id', 'category',
  'our_description', 'featured', 'is_published', 'display_order',
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
    const { data, error } = await sb.from('local_places').update(sanitized).eq('id', params.id).select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ place: data });
  } catch (err) {
    return handleError(err);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    if (!params.id) return json({ error: 'Missing id' }, 400);
    const sb = serverClient();
    const { error } = await sb.from('local_places').delete().eq('id', params.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
};
