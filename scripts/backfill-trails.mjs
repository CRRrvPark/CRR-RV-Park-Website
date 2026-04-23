#!/usr/bin/env node
/**
 * backfill-trails.mjs — populate the trails table to 10+ published rows
 * with AllTrails links + accurate distance/elevation/season/hazards.
 *
 * Source data is hand-assembled from AllTrails listings (URL + verified
 * stats) plus owner intent. Coords come from the Places API. The script
 * is idempotent: re-running just refreshes fields, never duplicates.
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
  if (!r.ok) return { ok: false, status: r.status, body: await r.text() };
  const j = await r.json();
  return { ok: true, place: j.places?.[0] ?? null };
}

// ── Trail data ──────────────────────────────────────────────────────
// Each row is upserted by slug. coordsQuery is what we search Places
// for to get trailhead lat/lng. external_link is the AllTrails URL.
//
// Difficulty is constrained to: easy / moderate / hard.
// Season is free-text (e.g. "Mar–Nov" or "Year-round").

const trails = [
  // ── ENRICH EXISTING (slugs match what's already in the DB) ───────
  {
    slug: 'crr-canyon-trail',
    name: 'CRR Canyon Trail (on-property)',
    summary: "Crooked River Ranch's home trail — a short, accessible canyon-rim walk right from the park with views down into the gorge.",
    description: "The signature on-property trail. Wide gravel path along the canyon rim suitable for casual walks at sunrise/sunset. Connects to the broader CRR trail network for longer outings (Otter Bench, Hollywood, Pinnacle).",
    distance_miles: 1.5,
    elevation_gain_feet: 80,
    difficulty: 'easy',
    is_on_property: true,
    pet_friendly: true,
    kid_friendly: true,
    season: 'Year-round',
    parking_info: 'Park anywhere in the RV park; trail entry at the canyon-rim end of each loop.',
    hazards: 'Steep canyon edge — supervise children and dogs.',
    external_link: 'https://www.crookedriverranch.com/recreation/page/hiking-trails',
    drive_time_from_park: 'On-site',
    coordsQuery: 'Crooked River Ranch RV Park Terrebonne Oregon',
  },
  {
    slug: 'smith-rock-river-trail',
    name: 'Smith Rock State Park Canyon Trail',
    summary: "Easy 3.4-mile flat walk along the Crooked River at the base of Smith Rock — climbers overhead, kingfishers in the willows.",
    description: "The flat, family-friendly route at Smith Rock. Hugs the river the entire way with stunning views of the rock formations and active climbers on the walls. Good for kids, dogs (on leash), and anyone wanting Smith Rock scenery without the Misery Ridge climb.",
    distance_miles: 3.4,
    elevation_gain_feet: 200,
    difficulty: 'easy',
    is_on_property: false,
    pet_friendly: true,
    kid_friendly: true,
    season: 'Year-round',
    parking_info: '$5/day parking fee at Smith Rock State Park. Lot fills early on summer weekends — arrive before 9 AM.',
    hazards: 'Loose rock from climbers above; rattlesnakes in summer (rare but possible).',
    external_link: 'https://www.alltrails.com/trail/us/oregon/smith-rock-state-park-canyon-trail',
    drive_time_from_park: '15 min',
    coordsQuery: 'Smith Rock State Park Oregon',
  },
  {
    slug: 'steelhead-falls',
    name: 'Steelhead Falls',
    summary: "Quick 2-mile out-and-back to a picturesque Deschutes waterfall + swim holes — one of the area's most popular short hikes (4.7★, 1,600+ reviews).",
    description: "Easy hike to a 20-foot waterfall on the Deschutes River. Beyond the falls are several deep swim holes that are popular in summer for cooling off. Short enough for kids, scenic enough for everyone, and dog-friendly on leash.",
    distance_miles: 2.0,
    elevation_gain_feet: 170,
    difficulty: 'easy',
    is_on_property: false,
    pet_friendly: true,
    kid_friendly: true,
    season: 'Mar–Nov',
    parking_info: 'Free trailhead parking off NW River Road. Lot is small — overflow on the road.',
    hazards: 'Steep drop at the falls overlook; cold water in swim holes year-round.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/steelhead-falls',
    drive_time_from_park: '10 min',
    coordsQuery: 'Steelhead Falls Trailhead Terrebonne Oregon',
  },
  {
    slug: 'crooked-river-loop',
    name: 'Crooked River Rim Trail (Cove Palisades)',
    summary: "Long 7-mile rim loop at Cove Palisades with sweeping views of the Crooked River canyon and Lake Billy Chinook.",
    description: "Longer counterpart to the Tam-a-lau Trail at Cove Palisades. Rim-walk with constant views into the canyon and across to Mt Jefferson on clear days. Exposed and dry — bring water and start early in summer.",
    distance_miles: 7.0,
    elevation_gain_feet: 900,
    difficulty: 'hard',
    is_on_property: false,
    pet_friendly: true,
    kid_friendly: false,
    season: 'Mar–Jun, Sep–Nov (avoid summer heat)',
    parking_info: 'Day-use fee at Cove Palisades State Park ($5/day or annual pass).',
    hazards: 'No shade, no water on trail. Heat exhaustion risk in summer; rattlesnakes in warm months.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/crooked-river-rim-trail-at-cove-palisades',
    drive_time_from_park: '30 min',
    coordsQuery: 'Cove Palisades State Park Crooked River Day Use Oregon',
  },
  {
    slug: 'tam-a-lau-trail',
    name: 'Tam-a-lau Trail (Cove Palisades)',
    summary: "6.6-mile loop climbing to a plateau with views of the Crooked-Deschutes confluence and Lake Billy Chinook.",
    description: "Popular Cove Palisades hike that gains the rim of \"the peninsula\" between two arms of Lake Billy Chinook. Top-of-plateau views span the Cascades on clear days. Open year-round but very exposed — early starts and lots of water in summer.",
    distance_miles: 6.6,
    elevation_gain_feet: 823,
    difficulty: 'moderate',
    is_on_property: false,
    pet_friendly: true,
    kid_friendly: false,
    season: 'Year-round (avoid mid-summer heat)',
    parking_info: 'Day-use fee at Cove Palisades State Park.',
    hazards: 'Zero shade; bring 2L+ water per person in summer.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/tam-a-lau-trail-at-cove-palisades-state-park',
    drive_time_from_park: '30 min',
    coordsQuery: 'Tam-a-lau Trail Cove Palisades Oregon',
  },
  {
    slug: 'misery-ridge-trail',
    name: 'Misery Ridge & River Trail Loop (Smith Rock)',
    summary: "The classic Smith Rock loop: 3.6 miles of steep ridge climb, panoramic summit views, and an easy river walk back. 4.9★ from 9,000+ reviews — the most popular hike in central Oregon.",
    description: "Steep switchback climb up the ridge (the \"misery\" part — gain 1,000+ ft in under a mile), then ridge views over Monkey Face spire, then a knee-friendly descent and flat river walk back. The signature Smith Rock experience. Park early; the lot fills by 8 AM on weekends.",
    distance_miles: 3.6,
    elevation_gain_feet: 1100,
    difficulty: 'hard',
    is_on_property: false,
    pet_friendly: true,
    kid_friendly: false,
    season: 'Year-round (icy patches Dec–Feb)',
    parking_info: '$5/day at Smith Rock State Park. Arrive before 8 AM weekends.',
    hazards: 'Steep exposed ridge; loose gravel; full sun; falls have happened — stay on trail.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/misery-ridge-and-river-trail--2',
    drive_time_from_park: '15 min',
    coordsQuery: 'Smith Rock State Park Oregon',
  },

  // ── INSERT NEW (CRR-area trails the owner specifically called out) ──
  {
    slug: 'otter-bench-trail',
    name: 'Otter Bench & Pink Trail (to the Crooked River)',
    summary: "4.4-mile out-and-back from the CRR plateau down to the Crooked River through Otter Bench's juniper-and-rim country.",
    description: "Mostly flat walking across the high desert bench with sweeping canyon views, then a steep drop to the river at the end. Quiet — far less crowded than Smith Rock. Good for hikers, horses, and mountain bikers. No shade and no water on trail; bring more than you think.",
    distance_miles: 4.4,
    elevation_gain_feet: 656,
    difficulty: 'moderate',
    is_on_property: true,
    pet_friendly: true,
    kid_friendly: false,
    season: 'Jan–Jun (avoid summer heat)',
    parking_info: 'Free trailhead parking inside Crooked River Ranch. No restrooms.',
    hazards: 'Steep final descent to river; loose footing; rattlesnakes in warm months.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/crooked-river-via-otter-bench-and-pink-trail',
    drive_time_from_park: '5 min (within CRR)',
    coordsQuery: 'Otter Bench Trailhead Crooked River Ranch Oregon',
  },
  {
    slug: 'scout-camp-trail',
    name: 'Scout Camp Trail',
    summary: "Short but tough 2.3-mile loop dropping steeply into the Deschutes Canyon with dramatic river and basalt views.",
    description: "One of the more underrated hikes in the area. Compressed into a small footprint: stunning canyon views, fascinating columnar basalt, wildflowers in spring. The descent is steep with loose footing — proper boots recommended. Climb back out is the workout.",
    distance_miles: 2.3,
    elevation_gain_feet: 700,
    difficulty: 'moderate',
    is_on_property: true,
    pet_friendly: true,
    kid_friendly: false,
    season: 'Mar–Jun (best wildflowers in May)',
    parking_info: 'Free trailhead parking; rough access road, high-clearance recommended.',
    hazards: 'Steep, narrow, loose rock on descent; rattlesnakes; full sun.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/scout-camp-trail',
    drive_time_from_park: '10 min (within CRR area)',
    coordsQuery: 'Scout Camp Trailhead Terrebonne Oregon',
  },
  {
    slug: 'sand-ridge-trail',
    name: 'Sand Ridge Trail',
    summary: "Quiet high-desert ridge trail through CRR's juniper country — connects to the broader Otter Bench trail network.",
    description: "A lesser-traveled route on the CRR plateau. Mostly flat ridge walking through sage and juniper with intermittent canyon views. Often combined with Otter Bench for a longer day.",
    distance_miles: 3.0,
    elevation_gain_feet: 250,
    difficulty: 'easy',
    is_on_property: true,
    pet_friendly: true,
    kid_friendly: true,
    season: 'Sep–Jun (avoid summer)',
    parking_info: 'Trailhead inside Crooked River Ranch — no facilities.',
    hazards: 'Full sun; no water on trail.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/sand-ridge-trail',
    drive_time_from_park: '5 min (within CRR)',
    coordsQuery: 'Sand Ridge Trail Crooked River Ranch Oregon',
  },
  {
    slug: 'crooked-river-canyon-overlook',
    name: 'Crooked River Canyon Overlook Trail',
    summary: "2.1-mile out-and-back to a dramatic Crooked River canyon overlook — short, scenic, very accessible.",
    description: "Quick payoff hike with one of the best canyon overlooks in the area. Gentle terrain except the final approach to the rim. Good photo spot at sunset.",
    distance_miles: 2.1,
    elevation_gain_feet: 492,
    difficulty: 'moderate',
    is_on_property: true,
    pet_friendly: true,
    kid_friendly: true,
    season: 'Feb–Sep',
    parking_info: 'Free trailhead parking inside CRR.',
    hazards: 'Unfenced canyon edge at overlook — keep kids and dogs close.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/crooked-river-canyon-overlook-trail',
    drive_time_from_park: '5 min (within CRR)',
    coordsQuery: 'Crooked River Canyon Overlook Trail Terrebonne Oregon',
  },
  {
    slug: 'alder-springs-trail',
    name: 'Alder Springs Trail',
    summary: "5.8-mile out-and-back to a hidden desert oasis at the confluence of Whychus Creek and the Deschutes River.",
    description: "Lesser-known central Oregon gem. Hike descends through layered geology to a true desert oasis — cottonwoods, springs, and creek crossings. Wildflowers in spring, eagles overhead. Bring water shoes for creek crossings; high-clearance vehicle helps for the access road.",
    distance_miles: 5.8,
    elevation_gain_feet: 750,
    difficulty: 'moderate',
    is_on_property: false,
    pet_friendly: true,
    kid_friendly: false,
    season: 'Late spring + early fall (winter road closures)',
    parking_info: 'Free; rough access road, high-clearance recommended; no facilities.',
    hazards: 'Slippery creek crossings; rough trail in spots; rattlesnakes.',
    external_link: 'https://www.alltrails.com/trail/us/oregon/alder-springs-trail',
    drive_time_from_park: '40 min',
    coordsQuery: 'Alder Springs Trailhead Crooked River National Grassland Oregon',
  },
];

// ── Main ────────────────────────────────────────────────────────────
(async () => {
  const dryRun = process.argv.includes('--dry-run');

  // Fetch existing slugs
  const existingRes = await fetch(`${SB_URL}/rest/v1/trails?select=slug,name`, { headers: sbHeaders });
  const existing = await existingRes.json();
  const existingSlugs = new Set(existing.map(t => t.slug));

  const updates = [];
  const inserts = [];

  for (const t of trails) {
    const r = await searchPlaces(t.coordsQuery);
    if (!r.ok || !r.place) {
      console.log(`  ⚠ no Places result for ${t.slug} (query: "${t.coordsQuery}") — skipping`);
      continue;
    }
    // Split hazards on "; " — schema is text[] in Postgres.
    const hazardsArr = (t.hazards || '').split(/;\s*/).map(s => s.trim()).filter(Boolean);
    const row = {
      slug: t.slug,
      name: t.name,
      summary: t.summary,
      description: t.description,
      distance_miles: t.distance_miles,
      elevation_gain_feet: t.elevation_gain_feet,
      difficulty: t.difficulty,
      is_on_property: t.is_on_property,
      pet_friendly: t.pet_friendly,
      kid_friendly: t.kid_friendly,
      season: t.season,
      parking_info: t.parking_info,
      hazards: hazardsArr,
      external_link: t.external_link,
      drive_time_from_park: t.drive_time_from_park,
      trailhead_lat: r.place.location.latitude,
      trailhead_lng: r.place.location.longitude,
      is_published: true,
    };
    if (existingSlugs.has(t.slug)) updates.push(row);
    else inserts.push(row);
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`\n─── UPDATES (${updates.length}) ───`);
  for (const u of updates) console.log(`  ${u.slug.padEnd(34)} ${u.distance_miles}mi · ${u.difficulty} · ${u.elevation_gain_feet}ft @ ${u.trailhead_lat.toFixed(4)},${u.trailhead_lng.toFixed(4)}`);
  console.log(`\n─── INSERTS (${inserts.length}) ───`);
  for (const i of inserts) console.log(`  ${i.slug.padEnd(34)} ${i.distance_miles}mi · ${i.difficulty} · ${i.elevation_gain_feet}ft @ ${i.trailhead_lat.toFixed(4)},${i.trailhead_lng.toFixed(4)}`);

  if (dryRun) { console.log('\n(dry run — no DB writes)'); return; }

  let okPatch = 0, okInsert = 0;
  for (const u of updates) {
    const r = await fetch(`${SB_URL}/rest/v1/trails?slug=eq.${encodeURIComponent(u.slug)}`, {
      method: 'PATCH', headers: sbHeaders, body: JSON.stringify(u),
    });
    if (r.ok) okPatch++; else console.log(`  PATCH failed for ${u.slug}: ${r.status} ${await r.text()}`);
  }
  for (const i of inserts) {
    const r = await fetch(`${SB_URL}/rest/v1/trails`, {
      method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(i),
    });
    if (r.ok) okInsert++; else console.log(`  INSERT failed for ${i.slug}: ${r.status} ${await r.text()}`);
  }
  console.log(`\nPATCHed ${okPatch}/${updates.length}, INSERTed ${okInsert}/${inserts.length}.`);
})();
