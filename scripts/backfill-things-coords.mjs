#!/usr/bin/env node
/**
 * backfill-things-coords.mjs — one-shot script that resolves every
 * off-property `things_to_do` row to a Google Place ID + lat/lng and
 * writes the result back to Supabase.
 *
 * On-property items (skipList below) and intentionally ambiguous
 * titles are SKIPPED — they stay without coords so they show in the
 * list view but don't clutter the Area Guide map.
 *
 * Usage: node scripts/backfill-things-coords.mjs
 * Needs: .env with GOOGLE_PLACES_API_KEY + PUBLIC_SUPABASE_URL +
 *        SUPABASE_SERVICE_ROLE_KEY.
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
  console.error('Missing env: need PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY in .env');
  process.exit(1);
}

const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

// ── Curation rules ──────────────────────────────────────────────────
// Slugs to SKIP entirely — on-property activities + community-scoped
// events that don't map to a specific external pin. They stay in the
// list view but don't show on the map.
const skipSlugs = new Set([
  // families (on-property)
  'pickleball-courts', 'stargazing-telescope', 'swim-rv-pool',
  // rvers (all on-property)
  'crr-golf-course', 'do-nothing-campsite', 'ev-charging',
  'golf-cart-scenic-drive', 'golf-practice-green', 'outdoor-griddle-breakfast',
  'park-bathhouse', 'park-wifi-stream', 'reading-under-junipers',
  'sunset-rim-walk',
  // dogs (on-property)
  'park-dog-run', 'ranch-road-dog-walks',
  // winter (on-property)
  'canyon-to-yourself-winter', 'rig-gaming-session', 'winter-astrophotography',
  'winter-camping', 'winter-guest-gatherings',
  // food_community (on-property / ambiguous "any local spot")
  'campfire-stories', 'canyon-view-dining', 'group-site-potluck',
  'local-craft-beer', 'riverside-bbq', 'steaks-at-sunset',
  'bend-coffee-roaster',
  // day_trippers (CRR community-area, no specific external pin)
  'crr-farmers-market',
  // Owner flagged "not really worth note" 2026-04-23 — drop from map
  'deschutes-flyfishing', 'crooked-river-loop-run',
  'crooked-river-fishing', 'river-dog-splash',
]);

// New things_to_do rows to insert (owner-curated additions 2026-04-23).
// Resolved via Places API like everything else; written via INSERT.
const newThings = [
  // Cool spots most don't know about
  { slug: 'cline-falls-viewpoint', title: 'Visit the Cline Falls State Scenic Viewpoint', category: 'families',     summary: "Pretty Deschutes River viewpoint just minutes from Redmond — picnic tables, easy access, almost always uncrowded.", query: 'Cline Falls State Scenic Viewpoint Oregon' },
  { slug: 'tumalo-falls',          title: 'Hike to Tumalo Falls',                          category: 'active',       summary: "97-foot waterfall in the Bend foothills with an easy paved path or a longer loop.",                       query: 'Tumalo Falls Day Use Area Bend Oregon' },
  { slug: 'black-butte-summit',    title: 'Climb the Black Butte summit trail',            category: 'active',       summary: "Panoramic Cascades view from a historic fire-lookout butte near Sisters.",                              query: 'Black Butte Trailhead Sisters Oregon' },
  { slug: 'painted-hills',         title: 'See the Painted Hills',                         category: 'day_trippers', summary: "Iconic banded hills at John Day Fossil Beds National Monument — about a 1.5-hour drive.",               query: 'Painted Hills John Day Fossil Beds Oregon' },
  // Caves
  { slug: 'boyd-cave',             title: 'Explore Boyd Cave',                             category: 'active',       summary: "Undeveloped lava tube near Bend — bring your own flashlight, no fee, real adventure feel.",             query: 'Boyd Cave Bend Oregon' },
  { slug: 'arnold-ice-cave',       title: 'Explore Arnold Ice Cave',                       category: 'active',       summary: "Lava tube with year-round ice formations — more rugged access than Lava River Cave.",                  query: 'Arnold Ice Cave Bend Oregon' },
  // Kid magic
  { slug: 'petersen-rock-garden',  title: 'Visit Petersen Rock Garden',                    category: 'families',     summary: "Quirky homemade stone castles + sculpture park ~10 min south on Hwy 97. Free, almost no one knows about it.", query: 'Petersen Rock Garden Redmond Oregon' },
  { slug: 'pilot-butte',           title: 'Climb Pilot Butte',                             category: 'families',     summary: "Easy 1-mile loop to the top of a small volcano right inside Bend — sweeping Cascades view.",            query: 'Pilot Butte State Scenic Viewpoint Bend Oregon' },
  { slug: 'sun-mountain-fun',      title: 'Spend a day at Sun Mountain Fun Center',        category: 'families',     summary: "Bend's arcade, mini-golf, bumper boats, and go-karts — a guaranteed kid win on a too-hot or too-cold day.", query: 'Sun Mountain Fun Center Bend Oregon' },
  { slug: 'tumalo-state-park',     title: 'Swim and picnic at Tumalo State Park',          category: 'families',     summary: "Gentle Deschutes River swim hole + picnic area ~25 min away. Easy with kids of any age.",               query: 'Tumalo State Park Bend Oregon' },
  // Venue
  { slug: 'redmond-expo-center',   title: 'Catch an event at the Deschutes County Expo',   category: 'day_trippers', summary: "The Deschutes County Fair & Expo Center hosts the county fair, RV shows, concerts, rodeos, and gun shows year-round.", query: 'Deschutes County Fair & Expo Center Redmond Oregon' },
];

// (local_places additions are handled in a separate script —
//  scripts/backfill-local-places.mjs — since they need full Place
//  Details fetches + cached_data writes, not just lat/lng.)

// Slug → override query. For items where stripping verbs from the
// title gives Google too little to work with, or would resolve to
// the wrong thing.
const queryOverrides = {
  'crooked-river-fishing':       'Crooked River Day Use Area Oregon',
  'deschutes-flyfishing':        'Deschutes River Maupin Oregon',
  'crooked-river-loop-run':      'Crooked River Rim Trail Terrebonne Oregon',
  'river-dog-splash':            'Crooked River Terrebonne Oregon',
  'smith-rock-dog-trails':       'Smith Rock State Park Oregon',
  'richardsons-rock-ranch':      'Richardsons Rock Ranch Madras Oregon',
  'bend-brewery-tour':           'Deschutes Brewery Public House Bend Oregon',
  'mt-bachelor-skiing':          'Mt Bachelor Ski Resort Oregon',
  'snowshoeing':                 'Dutchman Flat Sno-Park Oregon',
  'climbing-lesson-smith-rock':  'Smith Rock State Park Oregon',
  'watch-monkey-face-climbers':  'Monkey Face Smith Rock Oregon',
  'mountain-biking-terrebonne':  'Cline Buttes Recreation Area Terrebonne Oregon',
  'lava-river-cave':             'Lava River Cave Bend Oregon',
  'deschutes-dog-public-lands':  'Deschutes National Forest Oregon',
  'cascade-lakes-scenic-byway':  'Cascade Lakes Scenic Byway Oregon',
  'peter-skene-ogden':           'Peter Skene Ogden State Scenic Viewpoint Oregon',
  'smith-rock-picnic':           'Smith Rock State Park Oregon',
  'steelhead-swim':              'Steelhead Falls Trailhead Oregon',
  'steelhead-falls-hike':        'Steelhead Falls Trailhead Oregon',
  'cove-palisades-pontoon':      'Cove Palisades State Park Oregon',
  'lake-billy-chinook-paddle':   'Lake Billy Chinook Oregon',
  'crescent-moon-alpacas':       'Crescent Moon Ranch Terrebonne Oregon',
  'high-desert-museum':          'High Desert Museum Bend Oregon',
  'smith-rock-river-family':     'Smith Rock State Park Oregon',
  'misery-ridge-hike':           'Misery Ridge Trail Smith Rock Oregon',
  'tam-a-lau-hike':              'Tam-a-lau Trail Cove Palisades Oregon',
  'crater-lake-drive':           'Crater Lake National Park Oregon',
  'newberry-obsidian-flows':     'Newberry Volcanic National Monument Oregon',
  'christmas-valley-drive':      'Christmas Valley Oregon',
  'redmond-antiques':            'Downtown Redmond Oregon',
  'sisters-downtown':            'Sisters Oregon',
  'terrebonne-depot':            'Terrebonne Depot Terrebonne Oregon',
};

// Fallback: strip common verbs so "Hike Misery Ridge at Smith Rock"
// → "Misery Ridge at Smith Rock".
function cleanQuery(title) {
  return title.replace(/^(Hike|Drive to|Drive the|Stroll|Visit the?|Explore|Watch|Walk|Tour|Camp|Take|Bike|Rent|Kayak|Paddle|Play|Trail run|Ski|Snowboard|Snowshoe|Shop(?: the)?|Shop|Jump into|Feed|Hunt|Fish(?: for)?|Fly fish)\s+/i, '').trim();
}

async function searchPlaces(query) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!r.ok) {
    return { ok: false, status: r.status, body: await r.text() };
  }
  const j = await r.json();
  return { ok: true, place: j.places?.[0] ?? null };
}

// ── Main ────────────────────────────────────────────────────────────
(async () => {
  // Fetch all rows (only want to touch ones without coords)
  const r = await fetch(`${SB_URL}/rest/v1/things_to_do?select=id,slug,title,category,lat,lng&order=category,title`, { headers: sbHeaders });
  const rows = await r.json();

  const dryRun = process.argv.includes('--dry-run');
  const skipped = [];
  const resolved = [];
  const notFound = [];
  const errored = [];

  for (const row of rows) {
    if (row.lat != null && row.lng != null) {
      // already has coords — respect existing data
      continue;
    }
    if (skipSlugs.has(row.slug)) {
      skipped.push({ slug: row.slug, title: row.title, reason: 'on-property or ambiguous' });
      continue;
    }
    const query = queryOverrides[row.slug] ?? (cleanQuery(row.title) + ' Oregon');
    const res = await searchPlaces(query);
    if (!res.ok) {
      errored.push({ slug: row.slug, title: row.title, status: res.status, body: res.body.slice(0, 200) });
      continue;
    }
    if (!res.place) {
      notFound.push({ slug: row.slug, title: row.title, query });
      continue;
    }
    const p = res.place;
    resolved.push({
      slug: row.slug,
      title: row.title,
      query,
      foundName: p.displayName?.text,
      address: p.formattedAddress,
      lat: p.location.latitude,
      lng: p.location.longitude,
      place_id: p.id,
    });
    // gentle rate-limit
    await new Promise(r => setTimeout(r, 120));
  }

  console.log('\n─── RESOLVED ───');
  for (const r of resolved) {
    console.log(`  ${r.slug.padEnd(30)} → ${r.foundName?.padEnd(40)} @ ${r.lat.toFixed(4)},${r.lng.toFixed(4)}`);
  }
  console.log(`\n─── SKIPPED (${skipped.length} on-property/ambiguous) ───`);
  for (const s of skipped) console.log(`  ${s.slug.padEnd(30)} · ${s.title}`);
  if (notFound.length) {
    console.log(`\n─── NOT FOUND (${notFound.length}) ───`);
    for (const n of notFound) console.log(`  ${n.slug} — query: "${n.query}"`);
  }
  if (errored.length) {
    console.log(`\n─── ERRORED (${errored.length}) ───`);
    for (const e of errored) console.log(`  ${e.slug} [${e.status}]: ${e.body}`);
  }

  // ── Resolve coords for the new things_to_do rows ────────────────
  const newResolved = [];
  for (const t of newThings) {
    const res = await searchPlaces(t.query);
    if (!res.ok) { errored.push({ slug: t.slug, title: t.title, status: res.status, body: res.body.slice(0, 200) }); continue; }
    if (!res.place) { notFound.push({ slug: t.slug, title: t.title, query: t.query }); continue; }
    const p = res.place;
    newResolved.push({ ...t, lat: p.location.latitude, lng: p.location.longitude, foundName: p.displayName?.text, address: p.formattedAddress });
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`\n─── NEW THINGS TO INSERT (${newResolved.length}) ───`);
  for (const r of newResolved) {
    console.log(`  ${r.slug.padEnd(28)} → ${r.foundName?.padEnd(40)} @ ${r.lat.toFixed(4)},${r.lng.toFixed(4)}  [${r.category}]`);
  }

  console.log(`\nSummary: ${resolved.length} existing rows resolved, ${newResolved.length} new rows ready to INSERT, ${skipped.length} skipped, ${notFound.length} not found, ${errored.length} errored.`);

  if (dryRun) {
    console.log('\n(dry run — no DB writes)');
    return;
  }

  // ── Write existing rows ─────────────────────────────────────────
  let updated = 0;
  for (const r of resolved) {
    const u = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(r.slug)}`, {
      method: 'PATCH',
      headers: sbHeaders,
      body: JSON.stringify({ lat: r.lat, lng: r.lng }),
    });
    if (u.ok) updated++;
    else console.log(`  PATCH failed for ${r.slug}: ${u.status}`);
  }
  console.log(`\nPATCHed ${updated}/${resolved.length} existing things_to_do rows.`);

  // ── Insert new rows ─────────────────────────────────────────────
  let inserted = 0;
  for (const r of newResolved) {
    const row = {
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      category: r.category,
      personas: [r.category],
      lat: r.lat,
      lng: r.lng,
      icon: r.icon ?? '📍',
      is_published: true,
      display_order: 50,
    };
    const u = await fetch(`${SB_URL}/rest/v1/things_to_do`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (u.ok) inserted++;
    else console.log(`  INSERT failed for ${r.slug}: ${u.status} ${await u.text()}`);
  }
  console.log(`INSERTed ${inserted}/${newResolved.length} new things_to_do rows.`);
})();
