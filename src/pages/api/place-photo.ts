/**
 * GET /api/place-photo?name=<photo-resource-name>&w=<maxWidthPx>
 * GET /api/place-photo?place=<stable-place-id>&w=<maxWidthPx>
 * GET /api/place-photo?place=<stable-place-id>&w=<maxWidthPx>&format=json
 *
 * Proxies a Google Place Photo with our server-side Places key so
 * we can render real Place photos in <img> tags without exposing
 * the API key in the page HTML.
 *
 * Behavior:
 *   - Accepts either a current photo resource name or a stable Place ID.
 *   - Refreshes temporary photo names through Place Details before use.
 *   - Calls Places Photo API with skipHttpRedirect=true so we get
 *     back the signed CDN photoUri, then 302-redirects to it.
 *   - JSON mode returns the signed URI plus current author attribution
 *     for the progressive card/hero loader.
 *   - Keeps a short-lived, in-memory server-side resolve cache keyed by
 *     placeId:index:width so a grid of N cards costs one Place Details +
 *     Photo resolve per (place, index, width) within the TTL instead of
 *     2N billed Google calls per visitor. The browser response itself is
 *     never cached (stays no-store); only the resolved signed URL is
 *     memoized in this function's memory (see the cache note below).
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

const PLACE_ID_RE = /^[A-Za-z0-9_-]{8,180}$/;
const NAME_RE = /^places\/([A-Za-z0-9_-]+)\/photos\/[A-Za-z0-9_-]+$/;
const GOOGLE_PHOTO_HOST_RE = /(^|\.)googleusercontent\.com$/i;

interface AuthorAttribution {
  displayName?: string;
  uri?: string;
  photoUri?: string;
}

interface PlacePhoto {
  name?: string;
  authorAttributions?: AuthorAttribution[];
}

function normalizeAttributionUri(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if (url.protocol !== 'https:') return null;
    if (!/(^|\.)google\.com$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safePhotoUri(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !GOOGLE_PHOTO_HOST_RE.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

interface NormalizedAttribution {
  displayName: string;
  uri: string | null;
}

function normalizeAttributions(list: AuthorAttribution[] | undefined): NormalizedAttribution[] {
  return (list ?? [])
    .map((attribution) => ({
      displayName: String(attribution.displayName || '').trim().slice(0, 160),
      uri: normalizeAttributionUri(attribution.uri),
    }))
    .filter((attribution) => attribution.displayName);
}

// ---- Server-side resolve cache ------------------------------------------
// A single Things-to-Do / dining grid renders many Google-backed cards, and
// each one otherwise costs two billed Google calls (Place Details for the
// current photo name + Photo media for the signed URI). This memoizes the
// resolved signed URI (and its attribution) per (placeId, index, width) so a
// grid of N cards collapses to one resolve per distinct card within the TTL,
// shared across every visitor hitting the same warm function instance.
//
// Caveat (Netlify Functions model): each function instance has its own memory
// and cold starts reset it, so this is a best-effort warm-instance cache, not
// a distributed one — which is exactly the case that matters, a single page
// load bursting N requests at one instance. It never changes what the browser
// sees (the response stays `no-store`); only our own upstream call count drops.
interface CachedPhoto {
  photoUri: string;
  authorAttributions: NormalizedAttribution[];
  expires: number;
}

const PHOTO_TTL_MS = 45 * 60 * 1000; // 45 min — inside Google's signed-URL lifetime
const PHOTO_CACHE_MAX = 500;
const photoCache = new Map<string, CachedPhoto>();

function readPhotoCache(key: string): CachedPhoto | null {
  const hit = photoCache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    photoCache.delete(key);
    return null;
  }
  return hit;
}

function writePhotoCache(key: string, photoUri: string, authorAttributions: NormalizedAttribution[]): void {
  if (photoCache.size >= PHOTO_CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of photoCache) if (v.expires <= now) photoCache.delete(k);
    // Still full of live entries: evict the oldest inserted key (Map keeps
    // insertion order) to bound memory.
    if (photoCache.size >= PHOTO_CACHE_MAX) {
      const oldest = photoCache.keys().next().value;
      if (oldest !== undefined) photoCache.delete(oldest);
    }
  }
  photoCache.set(key, { photoUri, authorAttributions, expires: Date.now() + PHOTO_TTL_MS });
}

function jsonResponse(photoUri: string, placeId: string, authorAttributions: NormalizedAttribution[]): Response {
  return Response.json(
    { photoUri, placeId: placeId || null, authorAttributions },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        Vary: 'Accept',
      },
    },
  );
}

function redirectResponse(photoUri: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: photoUri,
      // The signed URL is per-request and user-agnostic but must not be
      // cached by the browser/CDN; our server memoizes it instead (see cache).
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      Vary: 'Accept',
    },
  });
}

async function getCurrentPhoto(placeId: string, index: number): Promise<PlacePhoto | null> {
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': SERVER_KEY,
        'X-Goog-FieldMask': 'photos',
      },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { photos?: PlacePhoto[] };
    const photos = payload.photos ?? [];
    return photos[index] ?? photos[0] ?? null;
  } catch {
    return null;
  }
}

async function getPhotoUri(photoName: string, maxWidth: number): Promise<string | null> {
  const upstream = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  upstream.searchParams.set('maxWidthPx', String(maxWidth));
  upstream.searchParams.set('key', SERVER_KEY);
  upstream.searchParams.set('skipHttpRedirect', 'true');

  try {
    const response = await fetch(upstream.toString());
    if (!response.ok) return null;
    const payload = await response.json() as { photoUri?: string };
    return safePhotoUri(payload.photoUri);
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ url }) => {
  if (!SERVER_KEY) {
    return new Response('place-photo not configured', { status: 503 });
  }

  const name = url.searchParams.get('name') || '';
  const explicitPlaceId = url.searchParams.get('place') || '';
  const nameMatch = NAME_RE.exec(name);
  const placeId = PLACE_ID_RE.test(explicitPlaceId)
    ? explicitPlaceId
    : nameMatch && PLACE_ID_RE.test(nameMatch[1])
      ? nameMatch[1]
      : '';
  if (!placeId && !nameMatch) return new Response('invalid photo reference', { status: 400 });

  const maxWidth = Math.max(64, Math.min(2400, Number(url.searchParams.get('w') || '1200') | 0));
  const requestedIndex = Number(url.searchParams.get('index') || '0') | 0;
  const index = Math.max(0, Math.min(9, requestedIndex));
  const wantsJson = url.searchParams.get('format') === 'json';

  // Serve a warm-instance cache hit before spending any Google calls. The key
  // is the stable (placeId, index, width) tuple, so both JSON and redirect
  // callers for the same card share one resolved signed URL within the TTL.
  const cacheKey = placeId ? `${placeId}:${index}:${maxWidth}` : null;
  if (cacheKey) {
    const hit = readPhotoCache(cacheKey);
    if (hit) {
      return wantsJson
        ? jsonResponse(hit.photoUri, placeId, hit.authorAttributions)
        : redirectResponse(hit.photoUri);
    }
  }

  // Google explicitly warns that photo resource names can expire. Whenever a
  // stable Place ID is available, request a current photo object before asking
  // for the media URI. Legacy name-only URLs contain that Place ID, so they
  // recover automatically without a database rewrite.
  const currentPhoto = placeId ? await getCurrentPhoto(placeId, index) : null;
  const photo: PlacePhoto = currentPhoto ?? { name };
  if (!photo.name || !NAME_RE.test(photo.name)) {
    return new Response('photo not available', { status: 502 });
  }

  const photoUri = await getPhotoUri(photo.name, maxWidth);
  if (!photoUri) return new Response('photo not available', { status: 502 });

  const authorAttributions = normalizeAttributions(photo.authorAttributions);
  if (cacheKey) writePhotoCache(cacheKey, photoUri, authorAttributions);

  return wantsJson
    ? jsonResponse(photoUri, placeId, authorAttributions)
    : redirectResponse(photoUri);
};
