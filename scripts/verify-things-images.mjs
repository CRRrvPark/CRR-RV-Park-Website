/**
 * Verify every photo rendered by the public Things to Do card grid.
 *
 * Google Places photo names expire, so Google-backed cards are checked through
 * the stable Place ID JSON endpoint. Other images are checked at their actual
 * URL. The script deliberately limits concurrency to avoid a burst of Places
 * requests during regression testing.
 *
 * Usage:
 *   THINGS_IMAGE_CHECK_BASE=http://127.0.0.1:4321 node scripts/verify-things-images.mjs
 *   THINGS_IMAGE_CHECK_BASE=https://www.crookedriverranchrv.com node scripts/verify-things-images.mjs
 */

import * as cheerio from 'cheerio';

const base = (process.env.THINGS_IMAGE_CHECK_BASE || 'http://127.0.0.1:4321').replace(/\/+$/, '');
const pageResponse = await fetch(`${base}/things-to-do`);
if (!pageResponse.ok) {
  throw new Error(`Things to Do returned ${pageResponse.status} at ${base}/things-to-do`);
}

const $ = cheerio.load(await pageResponse.text());
const failures = [];
const checks = [];

$('[data-google-place-photo]').each((_, frame) => {
  const placeId = $(frame).attr('data-google-place-photo') || '';
  const card = $(frame).closest('.crr-list-card');
  const title = card.find('h3').first().text().trim() || $('h1').first().text().trim() || placeId;
  if (!placeId) {
    failures.push(`${title}: missing Google Place ID`);
    return;
  }
  checks.push({ kind: 'google', label: title, value: placeId });
});

$('img[data-card-image]').each((_, image) => {
  const src = $(image).attr('src') || '';
  const title = $(image).attr('alt') || src;
  if (!src) {
    failures.push(`${title}: missing image URL`);
    return;
  }
  checks.push({ kind: 'image', label: title, value: new URL(src, base).toString() });
});

if (!checks.length) throw new Error('No Things to Do image checks were discovered.');

async function verify(check) {
  if (check.kind === 'google') {
    const url = new URL('/api/place-photo', base);
    url.searchParams.set('place', check.value);
    url.searchParams.set('w', '1200');
    url.searchParams.set('format', 'json');
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Google photo metadata returned ${response.status}`);
    const payload = await response.json();
    const photoUrl = new URL(payload.photoUri);
    if (photoUrl.protocol !== 'https:' || !/(^|\.)googleusercontent\.com$/i.test(photoUrl.hostname)) {
      throw new Error('Google photo metadata returned an invalid media URL');
    }
    if (!Array.isArray(payload.authorAttributions)) {
      throw new Error('Google photo metadata omitted author attribution data');
    }
    return;
  }

  let response = await fetch(check.value, { method: 'HEAD', redirect: 'follow' });
  if (response.status === 403 || response.status === 405) {
    response = await fetch(check.value, {
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
    });
  }
  if (!response.ok) throw new Error(`image returned ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType && !contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`unexpected content type ${contentType}`);
  }
}

const queue = [...checks];
const workerCount = Math.min(5, queue.length);
await Promise.all(Array.from({ length: workerCount }, async () => {
  while (queue.length) {
    const check = queue.shift();
    try {
      await verify(check);
    } catch (error) {
      failures.push(`${check.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}));

if (failures.length) {
  console.error(`Things to Do image verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const googleCount = checks.filter((check) => check.kind === 'google').length;
const imageCount = checks.length - googleCount;
console.log(
  `Things to Do image verification passed for ${checks.length} photos ` +
  `(${googleCount} live Google Places, ${imageCount} direct/local).`,
);
