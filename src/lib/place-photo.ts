const PLACE_ID_RE = /^[A-Za-z0-9_-]{8,180}$/;
const PHOTO_NAME_RE = /^places\/([A-Za-z0-9_-]+)\/photos\/[A-Za-z0-9_-]+$/;

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
