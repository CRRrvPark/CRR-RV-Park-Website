/**
 * GET /api/place-photo?name=<photo-resource-name>&w=<maxWidthPx>
 *
 * Proxies a Google Place Photo with our server-side Places key so
 * we can render real Place photos in <img> tags without exposing
 * the API key in the page HTML.
 *
 * Behavior:
 *   - Validates `name` matches the expected Google resource pattern.
 *   - Calls Places Photo API with skipHttpRedirect=true so we get
 *     back the signed CDN photoUri, then 302-redirects to it.
 *   - Caches at the edge for 1 day (signed Google URLs are stable
 *     long enough for that; we just refresh on cache miss).
 *
 * Why redirect rather than stream the bytes:
 *   - Cheaper: Google serves the actual image bytes from their CDN,
 *     not from our serverless function (no per-byte egress cost).
 *   - Faster: client follows the 302 directly to googleusercontent.
 *
 * Failure modes returned as plain HTTP error codes (400/404/500),
 * never expose the API key or upstream error body verbatim.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const SERVER_KEY =
  (typeof process !== 'undefined' ? process.env.GOOGLE_PLACES_API_KEY : '') ||
  (import.meta.env as any).GOOGLE_PLACES_API_KEY ||
  '';

// Photo resource names look like: places/{placeId}/photos/{photoRef}
// Both segments are URL-safe base64-ish, no slashes inside.
const NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export const GET: APIRoute = async ({ url }) => {
  if (!SERVER_KEY) {
    return new Response('place-photo not configured', { status: 503 });
  }
  const name = url.searchParams.get('name') || '';
  if (!NAME_RE.test(name)) {
    return new Response('invalid photo name', { status: 400 });
  }
  const maxWidth = Math.max(64, Math.min(2400, Number(url.searchParams.get('w') || '1200') | 0));

  const upstream = new URL(`https://places.googleapis.com/v1/${name}/media`);
  upstream.searchParams.set('maxWidthPx', String(maxWidth));
  upstream.searchParams.set('key', SERVER_KEY);
  upstream.searchParams.set('skipHttpRedirect', 'true');

  let photoUri: string | null = null;
  try {
    const r = await fetch(upstream.toString());
    if (!r.ok) return new Response('photo not available', { status: 502 });
    const j = await r.json() as { photoUri?: string };
    photoUri = j.photoUri ?? null;
  } catch {
    return new Response('photo upstream error', { status: 502 });
  }
  if (!photoUri) return new Response('photo missing', { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: photoUri,
      // Browser cache; revalidate against our endpoint daily so we
      // get a fresh signed URL when the previous one expires.
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      // Don't let intermediate caches leak our redirect across users
      // (the photoUri itself is signed but unique per request).
      Vary: 'Accept',
    },
  });
};
