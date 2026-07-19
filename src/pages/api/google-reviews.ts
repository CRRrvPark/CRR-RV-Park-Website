/**
 * GET /api/google-reviews
 *
 * Returns a small, display-safe view of the RV park's current Google Maps
 * reviews. Google Places content is deliberately fetched live and never
 * written to the database or an application cache. If Google is unavailable
 * or the server key is not configured, the public component links directly to
 * Google Maps without displaying testimonial text or a rating.
 */

import type { APIRoute } from 'astro';
import { json } from '@lib/api';

export const prerender = false;

const FALLBACK_REVIEWS_URL = 'https://www.google.com/maps?cid=4960049674782183446';
// Place IDs are public identifiers and Google explicitly permits storing them.
// The env value remains available as an operational override if the listing
// ever moves or Google replaces the ID.
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

function unavailable() {
  return json(
    { ok: false, reviewsUrl: FALLBACK_REVIEWS_URL },
    200,
    NO_STORE_HEADERS,
  );
}

export const GET: APIRoute = async () => {
  const apiKey = readEnv('GOOGLE_MAPS_SERVER_KEY') || readEnv('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return unavailable();

  try {
    const placeId = readEnv('GOOGLE_RV_PARK_PLACE_ID') || DEFAULT_PLACE_ID;

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': [
            'displayName',
            'rating',
            'userRatingCount',
            'googleMapsUri',
            'googleMapsLinks',
            'reviews',
          ].join(','),
        },
      },
    );

    if (!response.ok) {
      console.warn(`[google-reviews] Place Details returned HTTP ${response.status}.`);
      return unavailable();
    }

    const place = await response.json() as {
      displayName?: { text?: string };
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      googleMapsLinks?: { reviewsUri?: string };
      reviews?: Array<{
        rating?: number;
        relativePublishTimeDescription?: string;
        publishTime?: string;
        text?: { text?: string };
        originalText?: { text?: string };
        googleMapsUri?: string;
        flagContentUri?: string;
        authorAttribution?: {
          displayName?: string;
          uri?: string;
          photoUri?: string;
        };
      }>;
    };

    const reviewsUrl = isGoogleMapsUrl(place.googleMapsLinks?.reviewsUri)
      ? place.googleMapsLinks.reviewsUri
      : isGoogleMapsUrl(place.googleMapsUri)
        ? place.googleMapsUri
        : FALLBACK_REVIEWS_URL;

    const reviews = (place.reviews ?? [])
      .map((review) => {
        const text = review.originalText?.text?.trim() || review.text?.text?.trim() || '';
        const authorName = review.authorAttribution?.displayName?.trim() || '';
        const sourceUrl = isGoogleMapsUrl(review.googleMapsUri) ? review.googleMapsUri : '';
        if (!text || !authorName || !sourceUrl || typeof review.rating !== 'number') return null;

        return {
          text,
          rating: Math.max(1, Math.min(5, Math.round(review.rating))),
          authorName,
          authorUrl: isGoogleMapsUrl(review.authorAttribution?.uri)
            ? review.authorAttribution.uri
            : sourceUrl,
          authorPhotoUrl: isGoogleMapsUrl(review.authorAttribution?.photoUri)
            ? review.authorAttribution.photoUri
            : null,
          relativeDate: review.relativePublishTimeDescription?.trim() || null,
          publishTime: review.publishTime ?? null,
          sourceUrl,
          reportUrl: isGoogleMapsUrl(review.flagContentUri) ? review.flagContentUri : null,
        };
      })
      .filter((review): review is NonNullable<typeof review> => review !== null)
      .slice(0, 3);

    if (reviews.length === 0) return unavailable();

    return json(
      {
        ok: true,
        placeName: place.displayName?.text || 'Crooked River Ranch RV Park',
        rating: typeof place.rating === 'number' ? place.rating : null,
        reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        reviewsUrl,
        reviews,
        ordering: 'relevance',
      },
      200,
      NO_STORE_HEADERS,
    );
  } catch (error) {
    console.error('[google-reviews] Live review lookup failed:', error);
    return unavailable();
  }
};
