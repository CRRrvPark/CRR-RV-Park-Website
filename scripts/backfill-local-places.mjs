#!/usr/bin/env node
/**
 * backfill-local-places.mjs — populate the local_places table with
 * real Google Place IDs and cached Place Details (hours, photos,
 * ratings, top reviews, phone, website).
 *
 * What this script does:
 *   1. Inserts 8 new owner-curated restaurant rows (5 CRR-area +
 *      3 Redmond/Tumalo + Hola Mexican). The existing 5 rows
 *      (terrebonne-depot, crux-fermentation, deschutes-brewery,
 *      crescent-moon-ranch, smith-rock-state-park) are left in place
 *      and just get their cached_data refreshed.
 *   2. For every row whose google_place_id is null or starts with
 *      "TODO_", calls Places Text Search → real place_id.
 *   3. For every row, calls Place Details and caches the full
 *      payload into local_places.cached_data + cached_at.
 *
 * Re-runnable: idempotent on slug uniqueness; existing rows get
 * PATCHed, new rows get INSERTed.
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
if (!SB_URL || !SB_KEY || !GOOGLE_KEY) {
  console.error('Missing env');
  process.exit(1);
}

const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

// Owner-curated rows to insert (skipped if slug already exists).
const newPlaces = [
  // In CRR
  { slug: 'over-the-edge-taphouse', name_override: 'Over The Edge Taphouse',  category: 'restaurant', our_description: "Highly-rated bar & grill right in CRR — the locals' spot for casual food and a beer.", featured: true,  query: 'Over The Edge Taphouse Crooked River Ranch Oregon' },
  { slug: 'big-dog-saloon',         name_override: 'Big Dog Saloon',          category: 'restaurant', our_description: "Casual saloon-style food on Commercial Loop in CRR.",      featured: false, query: 'Big Dog Saloon Crooked River Ranch Oregon' },
  { slug: 'sandbagger-saloon',      name_override: 'Sandbagger Saloon',       category: 'restaurant', our_description: "Bar food at the Crooked River Ranch golf course clubhouse — convenient post-round.", featured: false, query: 'Sandbagger Saloon Crooked River Ranch Oregon' },
  // Terrebonne (just outside CRR)
  { slug: 'brand-44n',              name_override: 'Brand 44° N',             category: 'restaurant', our_description: "Hidden-gem breakfast in Terrebonne — locals' favorite for morning food.", featured: true, query: 'Brand 44° N Terrebonne Oregon' },
  { slug: 'pump-house-bar-grill',   name_override: 'Pump House Bar & Grill',  category: 'restaurant', our_description: "Long-running roadhouse on Hwy 97 — popular comfort-food stop.", featured: true, query: 'Pump House Bar & Grill Terrebonne Oregon' },
  // Redmond / Tumalo / Bend
  { slug: 'hola-pelican-bay',       name_override: 'Hola! Pelican Bay',       category: 'restaurant', our_description: "Popular Mexican spot in Redmond — go-to for Latin fusion.", featured: false, query: 'Hola Pelican Bay Redmond Oregon' },
  { slug: 'tumalo-feed-co',         name_override: 'Tumalo Feed Company',     category: 'restaurant', our_description: "Historic steakhouse ~15 min away in Tumalo.",          featured: true,  query: 'Tumalo Feed Company Steakhouse Oregon' },
  { slug: 'brickhouse-steakhouse',  name_override: 'Brickhouse Steakhouse',   category: 'restaurant', our_description: "Downtown Redmond steakhouse — local fine-dining favorite.", featured: false, query: 'Brickhouse Steakhouse Redmond Oregon' },
];

// Better seed-row queries: the existing TODO rows have placeholder
// google_place_ids; we need a real query string to resolve each.
const queryForExistingSlug = {
  'terrebonne-depot':       'Terrebonne Depot Terrebonne Oregon',
  'crux-fermentation':      'Crux Fermentation Project Bend Oregon',
  'deschutes-brewery':      'Deschutes Brewery Public House Bend Oregon',
  'crescent-moon-ranch':    'Crescent Moon Ranch Terrebonne Oregon',
  'smith-rock-state-park':  'Smith Rock State Park Oregon',
};

// Place Details fields we want cached.
const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'shortFormattedAddress',
  'location', 'rating', 'userRatingCount', 'priceLevel', 'priceRange',
  'internationalPhoneNumber', 'nationalPhoneNumber', 'websiteUri',
  'googleMapsUri', 'currentOpeningHours', 'regularOpeningHours',
  'businessStatus', 'primaryType', 'types', 'editorialSummary',
  'photos', 'reviews', 'goodForGroups', 'goodForChildren',
  'allowsDogs', 'reservable', 'servesBreakfast', 'servesLunch',
  'servesDinner', 'servesBrunch', 'takeout', 'delivery', 'dineIn',
  'outdoorSeating', 'accessibilityOptions',
].join(',');

async function searchPlaces(query) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!r.ok) return { ok: false, status: r.status, body: await r.text() };
  const j = await r.json();
  return { ok: true, place: j.places?.[0] ?? null };
}

async function getPlaceDetails(placeId) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
  });
  if (!r.ok) return { ok: false, status: r.status, body: await r.text() };
  return { ok: true, details: await r.json() };
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  // 1. Fetch existing
  const existing = await (await fetch(`${SB_URL}/rest/v1/local_places?select=slug,name_override,category,google_place_id,featured`, { headers: sbHeaders })).json();
  const existingSlugs = new Set(existing.map(p => p.slug));

  // 2. INSERT new rows (skip duplicates)
  const newToInsert = newPlaces.filter(p => !existingSlugs.has(p.slug));
  console.log(`Inserting ${newToInsert.length} new local_places rows (${newPlaces.length - newToInsert.length} skipped as duplicates).`);

  if (!dryRun) {
    for (const p of newToInsert) {
      const row = {
        slug: p.slug,
        name_override: p.name_override,
        google_place_id: 'TODO_PLACE_ID_' + p.slug.replace(/-/g, '_'),
        category: p.category,
        our_description: p.our_description,
        featured: p.featured,
        is_published: true,
        display_order: 50,
      };
      const r = await fetch(`${SB_URL}/rest/v1/local_places`, {
        method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(row),
      });
      if (!r.ok) console.log(`  INSERT failed for ${p.slug}: ${r.status} ${await r.text()}`);
    }
  }

  // 3. Re-fetch full list and resolve every row
  const all = await (await fetch(`${SB_URL}/rest/v1/local_places?select=slug,name_override,category,google_place_id&order=slug`, { headers: sbHeaders })).json();
  console.log(`\nResolving ${all.length} local_places rows…`);

  let resolved = 0, cached = 0, errored = 0;
  const samples = [];
  for (const p of all) {
    // Re-resolve if missing, TODO placeholder, or malformed. Real
    // Google Place IDs start with "ChIJ" / "EhI" / "GhIJ" — they
    // never contain a TODO prefix or URL-fragment characters.
    const id = p.google_place_id || '';
    const isRealLooking = /^(ChIJ|EhI|GhIJ|EkI)[A-Za-z0-9_-]{15,}$/.test(id);
    const needsResolve = !isRealLooking;
    let placeId = p.google_place_id;
    if (needsResolve) {
      const queryFromNew = newPlaces.find(np => np.slug === p.slug)?.query;
      const queryFromExisting = queryForExistingSlug[p.slug];
      const query = queryFromNew ?? queryFromExisting ?? p.name_override;
      const sr = await searchPlaces(query);
      if (!sr.ok || !sr.place) {
        console.log(`  ⚠ Text Search failed for ${p.slug} (${query}) — ${sr.ok ? 'no results' : sr.status}`);
        errored++;
        continue;
      }
      placeId = sr.place.id;
      resolved++;
      await new Promise(r => setTimeout(r, 100));
    }

    const dr = await getPlaceDetails(placeId);
    if (!dr.ok) {
      console.log(`  ⚠ Place Details failed for ${p.slug} (${placeId}): ${dr.status} ${dr.body?.slice(0, 200)}`);
      errored++;
      continue;
    }
    const d = dr.details;
    samples.push({ slug: p.slug, name: d.displayName?.text, addr: d.shortFormattedAddress, rating: d.rating, count: d.userRatingCount, hasHours: !!d.regularOpeningHours, photos: d.photos?.length || 0, reviews: d.reviews?.length || 0 });

    if (!dryRun) {
      const u = await fetch(`${SB_URL}/rest/v1/local_places?slug=eq.${encodeURIComponent(p.slug)}`, {
        method: 'PATCH', headers: sbHeaders,
        body: JSON.stringify({ google_place_id: placeId, cached_data: d, cached_at: new Date().toISOString() }),
      });
      if (u.ok) cached++;
      else console.log(`  ⚠ DB write failed for ${p.slug}: ${u.status} ${await u.text()}`);
    }
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`\n─── RESULTS ───`);
  console.log(`Resolved (Text Search): ${resolved}`);
  console.log(`Cached (Place Details): ${cached}`);
  console.log(`Errored:                ${errored}`);
  console.log(`\n─── SAMPLES (first 5) ───`);
  samples.slice(0, 5).forEach(s => {
    console.log(`  ${s.slug.padEnd(28)} ${s.name?.padEnd(34)} ${s.rating || '?'}★(${s.count || 0}) hrs:${s.hasHours?'✓':'×'} photos:${s.photos} reviews:${s.reviews}`);
  });
  console.log(`\nTotal places: ${all.length}.`);
  if (dryRun) console.log('(dry run — no DB writes)');
})();
