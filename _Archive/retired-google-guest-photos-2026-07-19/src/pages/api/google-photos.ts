/**
 * Archived 2026-07-19 when the owner retired the Google guest-photo concept.
 *
 * GET /api/google-photos
 *
 * Returns a small, live-only view of guest-contributed photos attached to the
 * park's Google Maps listing. Photo resource names and attribution metadata
 * are never persisted or cached. The client loads each image through
 * /api/place-photo, which keeps the API key server-side.
 */

import type { APIRoute } from 'astro';
import { json } from '@lib/api';

export const prerender = false;

const FALLBACK_MAPS_URL = 'https://www.google.com/maps?cid=4960049674782183446';
const DEFAULT_PLACE_ID = 'ChIJSYUMNkrYvlQRFhCvVeai1UQ';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex',
};

function readEnv(name: string): string {
  const fromAstro = (import.meta.env as Record<string, string | undefined>)[name];
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  return (fromAstro ?? fromProcess ?? '').trim();
}

function isGoogleMapsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (
      url.hostname === 'google.com'
      || url.hostname.endsWith('.google.com')
      || url.hostname === 'googleusercontent.com'
      || url.hostname.endsWith('.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function unavailable() {
  return json(
    { ok: false, mapsUrl: FALLBACK_MAPS_URL },
    200,
    NO_STORE_HEADERS,
  );
}

export const GET: APIRoute = async () => {
  const apiKey = readEnv('GOOGLE_PLACES_API_KEY') || readEnv('GOOGLE_MAPS_SERVER_KEY');
  if (!apiKey) return unavailable();

  try {
    const placeId = readEnv('GOOGLE_RV_PARK_PLACE_ID') || DEFAULT_PLACE_ID;
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'displayName,googleMapsUri,photos',
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      console.warn(`[google-photos] Place Details returned HTTP ${response.status}.`);
      return unavailable();
    }

    const place = await response.json() as {
      displayName?: { text?: string };
      googleMapsUri?: string;
      photos?: Array<{
        name?: string;
        widthPx?: number;
        heightPx?: number;
        googleMapsUri?: string;
        flagContentUri?: string;
        authorAttributions?: Array<{
          displayName?: string;
          uri?: string;
          photoUri?: string;
        }>;
      }>;
    };

    const placeName = place.displayName?.text?.trim() || 'Crooked River Ranch RV Park';
    const normalizedPlaceName = normalizeName(placeName);
    const mapsUrl = isGoogleMapsUrl(place.googleMapsUri)
      ? place.googleMapsUri
      : FALLBACK_MAPS_URL;

    const photos = (place.photos ?? [])
      .map((photo) => {
        const name = photo.name?.trim() || '';
        const sourceUrl = isGoogleMapsUrl(photo.googleMapsUri) ? photo.googleMapsUri : '';
        const authors = (photo.authorAttributions ?? [])
          .map((author) => {
            const displayName = author.displayName?.trim() || '';
            if (!displayName) return null;
            return {
              displayName,
              profileUrl: isGoogleMapsUrl(author.uri) ? author.uri : sourceUrl,
              avatarUrl: isGoogleMapsUrl(author.photoUri) ? author.photoUri : null,
            };
          })
          .filter((author): author is NonNullable<typeof author> => author !== null);

        const hasGuestAuthor = authors.some(
          (author) => normalizeName(author.displayName) !== normalizedPlaceName,
        );
        if (!name || !sourceUrl || authors.length === 0 || !hasGuestAuthor) return null;

        return {
          imageUrl: `/api/place-photo?name=${encodeURIComponent(name)}&w=1200`,
          width: typeof photo.widthPx === 'number' ? photo.widthPx : null,
          height: typeof photo.heightPx === 'number' ? photo.heightPx : null,
          sourceUrl,
          reportUrl: isGoogleMapsUrl(photo.flagContentUri) ? photo.flagContentUri : null,
          authors,
        };
      })
      .filter((photo): photo is NonNullable<typeof photo> => photo !== null)
      .slice(0, 4);

    if (photos.length === 0) return unavailable();

    return json(
      {
        ok: true,
        placeName,
        mapsUrl,
        photos,
        source: 'Google Maps',
        selection: 'Guest-contributed photos in the current Google relevance response',
      },
      200,
      NO_STORE_HEADERS,
    );
  } catch (error) {
    console.error('[google-photos] Live photo lookup failed:', error);
    return unavailable();
  }
};
