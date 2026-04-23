#!/usr/bin/env node
/**
 * backfill-photos.mjs — give every mappable things_to_do row a real
 * hero_image_url drawn from Google Place Photos. Also replaces the
 * obviously-duplicated destination-card images on the area-guide
 * page_builder content with photos pulled from the matching place.
 *
 * Image source: we resolve the row's Google place_id (from existing
 * lat/lng + a label query), call Place Details with photos field,
 * take the first photo's resource name, and store the URL of our
 * own proxy endpoint (/api/place-photo?name=...) so the API key
 * stays server-side.
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

// Same query map as enrich-things-to-do — keyed by slug.
const QUERY = {
  'lava-river-cave': 'Lava River Cave Bend Oregon',
  'crescent-moon-alpacas': 'Crescent Moon Ranch Terrebonne Oregon',
  'smith-rock-river-family': 'Smith Rock State Park Oregon',
  'richardsons-rock-ranch': 'Richardson Rock Ranch Madras Oregon',
  'steelhead-swim': 'Steelhead Falls Trailhead Oregon',
  'cove-palisades-pontoon': 'Cove Palisades Marina Oregon',
  'high-desert-museum': 'High Desert Museum Bend Oregon',
  'steelhead-falls-hike': 'Steelhead Falls Trailhead Oregon',
  'misery-ridge-hike': 'Smith Rock State Park Oregon',
  'tam-a-lau-hike': 'Tam-a-lau Trail Cove Palisades Oregon',
  'lake-billy-chinook-paddle': 'Cove Palisades State Park Oregon',
  'mountain-biking-terrebonne': 'Cline Buttes Recreation Area Terrebonne Oregon',
  'climbing-lesson-smith-rock': 'Smith Rock State Park Oregon',
  'watch-monkey-face-climbers': 'Monkey Face Smith Rock Oregon',
  'deschutes-dog-public-lands': 'Deschutes National Forest Oregon',
  'smith-rock-dog-trails': 'Smith Rock State Park Oregon',
  'bend-brewery-tour': 'Deschutes Brewery Public House Bend Oregon',
  'cascade-lakes-scenic-byway': 'Cascade Lakes Scenic Byway Oregon',
  'christmas-valley-drive': 'Christmas Valley Oregon',
  'crater-lake-drive': 'Crater Lake National Park Oregon',
  'newberry-obsidian-flows': 'Newberry National Volcanic Monument Oregon',
  'peter-skene-ogden': 'Peter Skene Ogden State Scenic Viewpoint Oregon',
  'redmond-antiques': 'Downtown Redmond Oregon',
  'terrebonne-depot': 'Terrebonne Depot Terrebonne Oregon',
  'sisters-downtown': 'Sisters Oregon',
  'mt-bachelor-skiing': 'Mt Bachelor Ski Resort Oregon',
  'snowshoeing': 'Dutchman Flat Sno-Park Oregon',
  'smith-rock-picnic': 'Smith Rock State Park Oregon',
  'cline-falls-viewpoint': 'Cline Falls State Scenic Viewpoint Oregon',
  'tumalo-falls': 'Tumalo Falls Day Use Area Bend Oregon',
  'black-butte-summit': 'Black Butte Trailhead Sisters Oregon',
  'painted-hills': 'Painted Hills John Day Fossil Beds Oregon',
  'boyd-cave': 'Boyd Cave Bend Oregon',
  'arnold-ice-cave': 'Arnold Ice Cave Bend Oregon',
  'petersen-rock-garden': 'Petersen Rock Garden Redmond Oregon',
  'pilot-butte': 'Pilot Butte State Scenic Viewpoint Bend Oregon',
  'sun-mountain-fun': 'Sun Mountain Fun Center Bend Oregon',
  'tumalo-state-park': 'Tumalo State Park Bend Oregon',
  'redmond-expo-center': 'Deschutes County Fair Expo Center Redmond Oregon',
};

async function searchPlace(query) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.places?.[0]?.id ?? null;
}

async function getPhotos(placeId) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'photos' },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.photos ?? null;
}

function photoProxyUrl(name, w = 1200) {
  return `/api/place-photo?name=${encodeURIComponent(name)}&w=${w}`;
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const all = await (await fetch(`${SB_URL}/rest/v1/things_to_do?select=slug,title,hero_image_url,lat,lng&order=slug`, { headers: sbHeaders })).json();

  let resolved = 0, written = 0, skipped = 0;
  for (const row of all) {
    const q = QUERY[row.slug];
    if (!q) { skipped++; continue; }
    if (row.hero_image_url) { skipped++; continue; }

    const placeId = await searchPlace(q);
    if (!placeId) { console.log(`  ⚠ no place for ${row.slug}`); continue; }
    const photos = await getPhotos(placeId);
    if (!photos || !photos.length) { console.log(`  ⚠ no photos for ${row.slug}`); continue; }
    const heroName = photos[0].name;
    const heroUrl = photoProxyUrl(heroName, 1200);

    // Pick a couple more for the gallery (best-effort).
    const galleryNames = photos.slice(1, 5).map(p => p.name);
    const galleryUrls = galleryNames.map(n => photoProxyUrl(n, 1600));

    resolved++;
    console.log(`  ✓ ${row.slug.padEnd(28)} → ${heroName.slice(0, 70)}…`);

    if (dryRun) continue;

    const u = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(row.slug)}`, {
      method: 'PATCH', headers: sbHeaders,
      body: JSON.stringify({ hero_image_url: heroUrl, gallery_image_urls: galleryUrls }),
    });
    if (u.ok) written++;
    else console.log(`  ⚠ DB write failed for ${row.slug}: ${u.status} ${await u.text()}`);
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`\n${resolved} resolved, ${written} written, ${skipped} skipped (already has hero or not curated).`);
  if (dryRun) console.log('(dry run)');
})();
