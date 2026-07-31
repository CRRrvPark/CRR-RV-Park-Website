const PLACE_ID_RE = /^[A-Za-z0-9_-]{8,180}$/;
const PHOTO_NAME_RE = /^places\/([A-Za-z0-9_-]+)\/photos\/[A-Za-z0-9_-]+$/;

/** True when the stored ID is a real Google Place ID (not an admin placeholder). */
export function isUsableGooglePlaceId(id: string | null | undefined): boolean {
  return !!id && !id.startsWith('TODO_') && PLACE_ID_RE.test(id);
}

/** Stable photo-proxy URL that refreshes the current Place photo via Place Details. */
export function googlePlacePhotoUrl(placeId: string, width = 600): string {
  return `/api/place-photo?place=${encodeURIComponent(placeId)}&w=${width}`;
}

/**
 * Extract the stable Google Place ID from one of our photo-proxy URLs.
 *
 * Older rows store a temporary `name=places/{id}/photos/{resource}` value.
 * Newer URLs may use `place={id}` directly. The photo resource can expire,
 * but the embedded Place ID remains useful for requesting a current photo.
 */
export function getGooglePlaceIdFromPhotoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://www.crookedriverranchrv.com');
    if (url.pathname !== '/api/place-photo') return null;

    const directPlaceId = url.searchParams.get('place') || '';
    if (PLACE_ID_RE.test(directPlaceId)) return directPlaceId;

    const photoName = url.searchParams.get('name') || '';
    const match = PHOTO_NAME_RE.exec(photoName);
    return match && PLACE_ID_RE.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Prefer a durable `?place=` proxy URL when `value` is (or embeds) a Place photo
 * reference; otherwise return the original URL unchanged (Unsplash, /images/, static-map).
 */
export function resolvePlacePhotoSrc(value: string | null | undefined, width = 1200): string | null {
  if (!value) return null;
  const placeId = getGooglePlaceIdFromPhotoUrl(value);
  if (placeId) return googlePlacePhotoUrl(placeId, width);
  return value;
}
