/**
 * GET /api/static-map?lat=&lng=&zoom=&w=&h=&label=
 *
 * Server-side proxy for the Google Static Maps API. Hides the API
 * key from client HTML (same pattern as /api/place-photo). Used
 * primarily on /trails/[slug] hero images so guests see a map of
 * the trailhead instead of a reused generic landscape photo.
 *
 * - Validates lat/lng/zoom/size to safe ranges.
 * - Returns the upstream PNG bytes directly so we can also serve a
 *   nice Cache-Control + immutable hash URL (the URL itself is the
 *   cache key — same lat/lng/zoom/size always returns the same map).
 * - Streams the response (no buffering all bytes in memory).
 *
 * Cost: each unique (lat,lng,zoom,size,maptype,marker) tuple is one
 * Static Maps API call (~$0.002). Browser cache makes subsequent
 * page loads free.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const SERVER_KEY =
  (typeof process !== 'undefined' ? process.env.GOOGLE_PLACES_API_KEY : '') ||
  (import.meta.env as any).GOOGLE_PLACES_API_KEY ||
  '';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export const GET: APIRoute = async ({ url }) => {
  if (!SERVER_KEY) return new Response('static-map not configured', { status: 503 });

  const lat = parseFloat(url.searchParams.get('lat') || '');
  const lng = parseFloat(url.searchParams.get('lng') || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return new Response('lat/lng required', { status: 400 });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return new Response('lat/lng out of range', { status: 400 });

  const zoom = clamp(parseInt(url.searchParams.get('zoom') || '14', 10) | 0, 1, 20);
  // Google Static Maps free tier caps size at 640x640 per request.
  // With scale=2 below, Google renders the delivered image at 2x
  // (so size=640x400 → 1280x800 actual image on Retina screens).
  const w = clamp(parseInt(url.searchParams.get('w') || '640', 10) | 0, 64, 640);
  const h = clamp(parseInt(url.searchParams.get('h') || '400', 10) | 0, 64, 640);
  const maptype = (url.searchParams.get('maptype') || 'terrain').replace(/[^a-z]/g, '');
  const labelChar = (url.searchParams.get('label') || '').replace(/[^A-Z0-9]/g, '').slice(0, 1);

  const upstream = new URL('https://maps.googleapis.com/maps/api/staticmap');
  upstream.searchParams.set('center', `${lat},${lng}`);
  upstream.searchParams.set('zoom', String(zoom));
  upstream.searchParams.set('size', `${w}x${h}`);
  upstream.searchParams.set('scale', '2'); // retina
  upstream.searchParams.set('maptype', maptype);
  upstream.searchParams.set('markers', `color:red${labelChar ? `|label:${labelChar}` : ''}|${lat},${lng}`);
  upstream.searchParams.set('key', SERVER_KEY);

  const r = await fetch(upstream.toString());
  if (!r.ok) return new Response('static-map upstream error', { status: 502 });

  return new Response(r.body, {
    status: 200,
    headers: {
      'Content-Type': r.headers.get('Content-Type') || 'image/png',
      'Cache-Control': 'public, max-age=2592000, immutable',
    },
  });
};
