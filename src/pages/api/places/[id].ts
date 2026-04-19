/**
 * GET  /api/places/[id]      — fetch a local_places row with fresh Google data
 * POST /api/places/[id]      — force-refresh from Google (editor+)
 *
 * Strategy:
 *   • cached_data is served if < 24h old (per-place override possible).
 *   • POST always refetches, regardless of cache age.
 *   • Google Places API (New) lookups use the server-side key
 *     GOOGLE_MAPS_SERVER_KEY (separate from PUBLIC_GOOGLE_MAPS_API_KEY
 *     — that one is referrer-restricted to the site origin and can't be
 *     used from a server). If the server key is missing, we serve
 *     whatever cached_data exists or 503.
 *
 * Security:
 *   • GET is public — the data we return is the same Google shows anyone.
 *     We only surface fields editors explicitly chose to publish.
 *   • POST requires `manage_area_guide` to prevent rate-limit griefing.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { json, requireRole, handleError } from '@lib/api';

export const prerender = false;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

const SERVER_KEY =
  (import.meta.env as any).GOOGLE_MAPS_SERVER_KEY ??
  (typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_SERVER_KEY : '') ??
  '';

// Fields we request from Google Places API (New). Keeping this list tight
// both controls cost and avoids storing more PII/vendor data than we need.
const PLACES_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'googleMapsUri',
  'websiteUri',
  'regularOpeningHours',
  'photos',
  'editorialSummary',
  'types',
].join(',');

async function fetchFromGoogle(placeId: string): Promise<Record<string, unknown> | null> {
  if (!SERVER_KEY) return null;
  // Places API (New): v1/places/{PLACE_ID}
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': SERVER_KEY,
      'X-Goog-FieldMask': PLACES_FIELDS,
    },
  });
  if (!res.ok) {
    console.warn(`[places] Google returned ${res.status} for ${placeId}`);
    return null;
  }
  return (await res.json()) as Record<string, unknown>;
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) return json({ error: 'Missing id' }, 400);

    const sb = serverClient();
    // Accept either local_places.id (UUID) or local_places.google_place_id
    const { data: place, error } = await sb
      .from('local_places')
      .select('*')
      .or(`id.eq.${id},google_place_id.eq.${id}`)
      .maybeSingle();

    if (error || !place) return json({ error: 'Not found' }, 404);
    if (!place.is_published) return json({ error: 'Not found' }, 404);

    const cachedAt = place.cached_at ? new Date(place.cached_at).getTime() : 0;
    const isFresh = Date.now() - cachedAt < CACHE_TTL_MS;

    if (place.cached_data && isFresh) {
      return json({ place, fresh: true });
    }

    // Cache miss or stale — refresh
    const fetched = await fetchFromGoogle(place.google_place_id);
    if (!fetched) {
      // Fall back to stale cache if we have any; otherwise 503
      if (place.cached_data) return json({ place, fresh: false, stale: true });
      return json({ error: 'Place lookup unavailable', reason: SERVER_KEY ? 'google_error' : 'missing_server_key' }, 503);
    }

    await sb
      .from('local_places')
      .update({ cached_data: fetched, cached_at: new Date().toISOString() })
      .eq('id', place.id);

    return json({ place: { ...place, cached_data: fetched, cached_at: new Date().toISOString() }, fresh: true });
  } catch (err) {
    return handleError(err);
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    await requireRole(request, 'manage_area_guide');
    const id = params.id;
    if (!id) return json({ error: 'Missing id' }, 400);

    const sb = serverClient();
    const { data: place, error } = await sb
      .from('local_places')
      .select('*')
      .or(`id.eq.${id},google_place_id.eq.${id}`)
      .maybeSingle();

    if (error || !place) return json({ error: 'Not found' }, 404);
    if (!place.google_place_id || place.google_place_id.startsWith('TODO_')) {
      return json({ error: 'google_place_id is a placeholder — fill it in first.' }, 400);
    }

    const fetched = await fetchFromGoogle(place.google_place_id);
    if (!fetched) {
      return json({ error: 'Google lookup failed', reason: SERVER_KEY ? 'google_error' : 'missing_server_key' }, 502);
    }

    const nowIso = new Date().toISOString();
    await sb
      .from('local_places')
      .update({ cached_data: fetched, cached_at: nowIso })
      .eq('id', place.id);

    return json({ place: { ...place, cached_data: fetched, cached_at: nowIso } });
  } catch (err) {
    return handleError(err);
  }
};
