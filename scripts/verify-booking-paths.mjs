/**
 * Crawl every public sitemap route and enforce the reservation-path contract:
 *
 *   - ordinary booking controls go directly to Firefly;
 *   - the Rimrock live-map beta (/availability) is entered only through copy
 *     that explicitly says beta, map, or preview;
 *   - Stay mega must not list the beta (banner is the opt-in);
 *   - /availability embeds Rimrock (not Supabase AvailabilityMap) and must not
 *     offer a Firefly handoff from the beta map surface;
 *   - the reusable date/rig quick-search instrument stays dormant on ordinary pages;
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
  if ($('[data-site-search]').length > 0) {
    failures.push(`${path}: experimental date/rig quick-search instrument is publicly rendered`);
  }
  if ($('[data-beta-banner]').length === 0) {
    failures.push(`${path}: sitewide live-map beta banner is missing`);
  }

  // Stay mega: park map only — beta must not appear under Stay.
  $('[data-mega="stay"] a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.startsWith('/availability')) {
      failures.push(`${path}: Stay mega still links to live-map beta ("${$(el).text().replace(/\s+/g, ' ').trim()}")`);
    }
  });

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

  if (path === '/availability') {
    if ($('iframe[src*="crr.stratapms.com"]').length === 0) {
      failures.push(`${path}: Rimrock live-map iframe embed is missing`);
    }
    if ($('iframe[src*="pilot=1"]').length > 0) {
      failures.push(`${path}: beta embed must not use pilot=1 charge mode`);
    }
    if ($('#av-map, .av-map, [data-availability-map]').length > 0) {
      failures.push(`${path}: retired Supabase AvailabilityMap is still rendered on beta`);
    }
    const pageText = $('main').text();
    if (!/not.*confirmed reservation|not a confirmed/i.test(pageText)) {
      failures.push(`${path}: missing “not a confirmed reservation” disclaimer`);
    }
    if (!/541-923-1441/.test(pageText)) {
      failures.push(`${path}: missing required call-to-confirm phone number`);
    }
    // Visible guest form must not appear — RR collects details inside the embed.
    if ($('.crr-form-shell form[name="beta-reservation-request"]').length > 0) {
      failures.push(`${path}: visible website request form must not appear on beta (RR collects invisibly)`);
    }
    if ($('[data-beta-netlify-bridge]').length === 0) {
      failures.push(`${path}: invisible Netlify bridge for beta-reservation-request is missing`);
    }
    // Beta surface must not hand guests to Firefly from the map UI.
    const fireflyFromBetaUi = $('main a').toArray().filter((a) => {
      const href = $(a).attr('href') || '';
      return href.includes('fireflyreservations.com') && /reserve on firefly|finish in firefly|book on firefly/i.test($(a).text());
    });
    if (fireflyFromBetaUi.length) {
      failures.push(`${path}: beta map UI still offers a Firefly reserve handoff`);
    }
  }
}

if (failures.length) {
  console.error(`Booking-path verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Booking-path verification passed for ${paths.length} public sitemap routes.`);
