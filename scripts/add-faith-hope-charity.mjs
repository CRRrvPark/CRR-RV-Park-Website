#!/usr/bin/env node
/**
 * add-faith-hope-charity.mjs — adds Faith Hope & Charity Vineyards
 * to local_places with full Google Place data cached, owner-flagged
 * featured=true so it surfaces with Editor's Pick treatment on
 * /dining and as a pin on the Area Guide map.
 *
 * Owner notes (2026-04-23): "key dining opportunity we missed,
 * absolutely amazing — fine dining, stone-brick-oven roasted pizza,
 * incredible view of the Three Sisters mountains they're named
 * after." Adding with full Place Details + an editorial description
 * pitched specifically at guests who want a memorable dinner-out.
 *
 * Idempotent: re-run safely (uses upsert pattern via slug).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const text = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  return text.split(/\r?\n/).filter(l => l && !l.startsWith('#')).reduce((a, l) => {
    const i = l.indexOf('=');
    if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    return a;
  }, {});
}

const env = loadEnv();
const SB_URL = env.PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = env.GOOGLE_PLACES_API_KEY;
if (!SB_URL || !SB_KEY || !GOOGLE_KEY) { console.error('missing env'); process.exit(1); }
const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

const SLUG = 'faith-hope-charity-vineyards';
const QUERY = 'Faith Hope Charity Vineyards Terrebonne Oregon';

const OUR_DESCRIPTION =
  "Working vineyard + tasting room + casual fine-dining restaurant on " +
  "312 acres outside Terrebonne, with the Three Sisters mountain range " +
  "(the peaks the vineyard is named after — Faith, Hope, and Charity) " +
  "on the western horizon. Wood-fired brick-oven pizza, a handcrafted " +
  "lunch + dinner menu, and a list of estate-grown wines (Marquette, " +
  "Leon Millot, Frontenac) plus sourced Pinot Noir and Merlot. Live " +
  "music Friday and Saturday evenings year-round. About 15 minutes " +
  "from the park — one of the few destination dining experiences this " +
  "close to CRR.";

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'shortFormattedAddress',
  'location', 'rating', 'userRatingCount', 'priceLevel',
  'internationalPhoneNumber', 'nationalPhoneNumber', 'websiteUri',
  'googleMapsUri', 'currentOpeningHours', 'regularOpeningHours',
  'businessStatus', 'primaryType', 'types', 'editorialSummary',
  'photos', 'reviews', 'goodForGroups', 'goodForChildren',
  'reservable', 'servesBreakfast', 'servesLunch', 'servesDinner',
  'servesBrunch', 'takeout', 'delivery', 'dineIn', 'outdoorSeating',
  'accessibilityOptions',
].join(',');

(async () => {
  // 1. Resolve real Place ID
  console.log('Searching Google Places for', QUERY);
  const sr = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress' },
    body: JSON.stringify({ textQuery: QUERY, maxResultCount: 1 }),
  });
  if (!sr.ok) { console.error('search failed:', sr.status, await sr.text()); process.exit(1); }
  const sj = await sr.json();
  const placeId = sj.places?.[0]?.id;
  if (!placeId) { console.error('no Place result'); process.exit(1); }
  console.log('Resolved →', sj.places[0].displayName?.text, '@', sj.places[0].formattedAddress);

  // 2. Pull full Place Details (hours, photos, reviews, etc.)
  console.log('Fetching Place Details…');
  const dr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
  });
  if (!dr.ok) { console.error('details failed:', dr.status, await dr.text()); process.exit(1); }
  const details = await dr.json();
  console.log('  ⭑', details.rating || '?', 'from', details.userRatingCount || 0, 'reviews');
  console.log('  📷', details.photos?.length || 0, 'photos cached');

  // 3. Upsert into local_places. Check if a row already exists.
  const existing = await (await fetch(`${SB_URL}/rest/v1/local_places?slug=eq.${SLUG}&select=id`, { headers: sbHeaders })).json();
  const row = {
    slug: SLUG,
    name_override: 'Faith Hope & Charity Vineyards',
    google_place_id: placeId,
    category: 'restaurant',
    our_description: OUR_DESCRIPTION,
    featured: true,
    is_published: true,
    display_order: 5,  // sort near the top of the dining list
    cached_data: details,
    cached_at: new Date().toISOString(),
  };
  if (existing.length) {
    const r = await fetch(`${SB_URL}/rest/v1/local_places?slug=eq.${SLUG}`, {
      method: 'PATCH', headers: sbHeaders, body: JSON.stringify(row),
    });
    if (!r.ok) { console.error('PATCH failed:', r.status, await r.text()); process.exit(1); }
    console.log('Updated existing local_places row.');
  } else {
    const r = await fetch(`${SB_URL}/rest/v1/local_places`, {
      method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(row),
    });
    if (!r.ok) { console.error('INSERT failed:', r.status, await r.text()); process.exit(1); }
    console.log('Inserted new local_places row.');
  }
  console.log('\nDone — Faith Hope & Charity is now on /dining + the Area Guide map.');
})();
