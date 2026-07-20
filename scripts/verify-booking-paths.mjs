/**
 * Crawl every public sitemap route and enforce the reservation-path contract:
 *
 *   - ordinary booking controls go directly to Firefly;
 *   - the developing availability map is entered only through copy that
 *     explicitly says beta, map, or preview;
 *   - every public page retains persistent desktop, mobile, and footer
 *     booking access.
 *
 * Usage:
 *   BOOKING_CHECK_BASE=http://127.0.0.1:4321 node scripts/verify-booking-paths.mjs
 *   BOOKING_CHECK_BASE=https://crookedriverranchrv.com node scripts/verify-booking-paths.mjs
 */

import * as cheerio from 'cheerio';

const FIREFLY =
  'https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK';
const base = (process.env.BOOKING_CHECK_BASE || 'http://127.0.0.1:4321').replace(/\/+$/, '');
const allowedMapCopy = /\b(beta|map|preview)\b/i;

const sitemapResponse = await fetch(`${base}/sitemap.xml`);
if (!sitemapResponse.ok) {
  throw new Error(`Sitemap returned ${sitemapResponse.status} at ${base}/sitemap.xml`);
}

const sitemap = await sitemapResponse.text();
const paths = Array.from(
  new Set(
    [...sitemap.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)]
      .map((match) => new URL(match[1]).pathname)
      .filter((path) => path !== '/sitemap.xml'),
  ),
).sort();

if (!paths.length) throw new Error('No public sitemap routes were found.');

const failures = [];

for (const path of paths) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) {
    failures.push(`${path}: returned ${response.status}`);
    continue;
  }

  const $ = cheerio.load(await response.text());
  const links = $('a').toArray();
  const directBookingLinks = links.filter((link) => $(link).attr('href') === FIREFLY);

  if (directBookingLinks.length < 4) {
    failures.push(`${path}: only ${directBookingLinks.length} generic Firefly booking links (expected at least 4)`);
  }
  if ($('.crr-header-actions .v2-book-button').attr('href') !== FIREFLY) {
    failures.push(`${path}: persistent header booking control does not go directly to Firefly`);
  }
  if ($('.crr-mobile-book').attr('href') !== FIREFLY) {
    failures.push(`${path}: sticky mobile booking control does not go directly to Firefly`);
  }
  if ($('.crr-footer-lead .v2-book-button').attr('href') !== FIREFLY) {
    failures.push(`${path}: footer booking control does not go directly to Firefly`);
  }

  for (const link of links) {
    const href = $(link).attr('href') || '';
    if (!href.startsWith('/availability')) continue;
    const copy = $(link).text().replace(/\s+/g, ' ').trim();
    if (!allowedMapCopy.test(copy)) {
      failures.push(`${path}: beta-map link lacks explicit map/beta/preview copy: "${copy}"`);
    }
  }

  $('form[action^="/availability"]').each((_, form) => {
    const copy = $(form).text().replace(/\s+/g, ' ').trim();
    if (!allowedMapCopy.test(copy)) {
      failures.push(`${path}: beta-map form is not explicitly identified as beta/map/preview`);
    }
  });
}

if (failures.length) {
  console.error(`Booking-path verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Booking-path verification passed for ${paths.length} public sitemap routes.`);
