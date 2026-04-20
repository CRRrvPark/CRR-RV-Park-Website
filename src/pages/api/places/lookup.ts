/**
 * GET /api/places/lookup?q=search+query
 *
 * Proxies to Google Places API (New) Text Search so the Local Places
 * admin can resolve a name → place_id without the owner having to
 * hand-copy IDs out of Google's buried Place ID Finder tool.
 *
 * Response:
 *   { candidates: [{ place_id, name, address, rating? }], reason? }
 *
 * If GOOGLE_MAPS_SERVER_KEY isn't set, we return a 503 with a specific
 * reason string so the admin UI can render an actionable error instead of
 * a generic "lookup failed" message.
 *
 * Auth: same as the Refresh endpoint — requires `manage_area_guide` so
 * anonymous visitors can't rack up Google quota on our bill.
 */

import type { APIRoute } from 'astro';
import { json, requireRole, handleError } from '@lib/api';

export const prerender = false;

const SERVER_KEY =
  (import.meta.env as any).GOOGLE_MAPS_SERVER_KEY ??
  (typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_SERVER_KEY : '') ??
  '';

// Keep the field mask tight — we only need what the dropdown shows.
const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.types',
].join(',');

export const GET: APIRoute = async ({ url, request }) => {
  try {
    await requireRole(request, 'manage_area_guide');

    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return json({ candidates: [] });
    }

    if (!SERVER_KEY) {
      return json(
        {
          candidates: [],
          reason: 'missing_server_key',
          detail:
            'GOOGLE_MAPS_SERVER_KEY is not set. Add it in Netlify → Environment variables. See AREA-GUIDE-SETUP.md §2.',
        },
        503,
      );
    }

    // Places API (New) Text Search — POST with a JSON body
    // https://developers.google.com/maps/documentation/places/web-service/text-search
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': SERVER_KEY,
        'X-Goog-FieldMask': SEARCH_FIELDS,
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 8 }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[places/lookup] Google returned ${res.status}: ${detail.slice(0, 200)}`);
      let reason = 'google_error';
      let message = `Google returned HTTP ${res.status}. Check the server-side API key and that "Places API (New)" is enabled in your Google Cloud project.`;
      // Parse known failure shapes for better messaging.
      try {
        const body = JSON.parse(detail);
        if (body?.error?.status === 'PERMISSION_DENIED') {
          reason = 'permission_denied';
          message = 'Google denied the request. Verify that "Places API (New)" is enabled on your Google Cloud project and that GOOGLE_MAPS_SERVER_KEY has no restrictions blocking server-side calls.';
        } else if (body?.error?.status === 'INVALID_ARGUMENT') {
          reason = 'invalid_argument';
          message = `Google rejected the query: ${body.error.message || 'invalid argument'}.`;
        }
      } catch { /* non-JSON body; keep generic reason */ }
      return json({ candidates: [], reason, detail: message }, 502);
    }

    const body = (await res.json()) as { places?: Array<Record<string, any>> };
    const candidates = (body.places || []).map((p) => ({
      place_id: p.id as string,
      name: p.displayName?.text || 'Unnamed place',
      address: p.formattedAddress || '',
      rating: typeof p.rating === 'number' ? p.rating : undefined,
      userRatingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
      types: Array.isArray(p.types) ? p.types : [],
    }));

    return json({ candidates });
  } catch (err) {
    return handleError(err);
  }
};
