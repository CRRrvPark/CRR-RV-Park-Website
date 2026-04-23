#!/usr/bin/env node
/**
 * cleanup-things-to-do.mjs — owner-driven cleanup of things_to_do:
 *
 * 1. DELETE 4 entries flagged for removal:
 *    - golf-cart-scenic-drive ("dumb" per owner — can't drive a
 *      golf cart around the rim, just play golf)
 *    - park-wifi-stream — misleading; CRR Wi-Fi caps at ~20 Mbps,
 *      can't stream 4K or game competitively
 *    - rig-gaming-session — same Wi-Fi limitation
 *    - golf-practice-green — consolidates into the main "Tee off
 *      200 feet from your rig" card so guests aren't seeing three
 *      slightly-different golf cards on the page
 *
 * 2. Assign hero_image_url to every remaining entry that lacks one
 *    (39 → 0). On-property activities use existing /images/* assets
 *    we already have (pool, golf_course, canyon scenes, etc.) so
 *    they show CRR-specific photos. Off-property activities that
 *    don't yet have a Google Place photo (the fishing/water-sports
 *    entries that came in via enrich-fishing-watersports.mjs which
 *    didn't fetch photos) get curated Unsplash CDN URLs — specific
 *    photo IDs hand-picked to match each activity exactly, never
 *    a random keyword search.
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
if (!SB_URL || !SB_KEY) { console.error('missing env'); process.exit(1); }
const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

// Slugs to delete entirely.
const TO_DELETE = [
  'golf-cart-scenic-drive',
  'park-wifi-stream',
  'rig-gaming-session',
  'golf-practice-green',
];

// Hand-curated photo per slug. /images/* are local files in the
// repo; Unsplash CDN URLs are stable + free (no key needed).
const u = (id) => `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`;

const HERO_FOR_SLUG = {
  // ── On-property: use our own /images assets where we have them ──
  'swim-rv-pool':              '/images/pool.jpg',
  'crr-golf-course':           '/images/golf_course.jpg',
  'sunset-rim-walk':           '/images/canyon_sunset.jpg',
  'do-nothing-campsite':       '/images/canyon_sunset.jpg',
  'reading-under-junipers':    '/images/canyon_sunset.jpg',
  'park-bathhouse':            '/images/aerial_wide.webp',
  'park-dog-run':              '/images/dog_welcome.jpg',
  'ranch-road-dog-walks':      '/images/dog_welcome.jpg',
  'winter-camping':            '/images/winter_sunset.webp',
  'canyon-to-yourself-winter': '/images/winter_sunset.webp',
  'winter-astrophotography':   '/images/winter_sunset.webp',
  'winter-guest-gatherings':   '/images/gazebo_fall.jpg',
  'group-site-potluck':        '/images/family_reunion.webp',
  'campfire-stories':          '/images/firepit_evening.jpg',
  'steaks-at-sunset':          '/images/firepit_evening.jpg',
  'crr-farmers-market':        '/images/gazebo_fall.jpg',

  // ── On-property: stock for things we don't have photos of ──
  'pickleball-courts':         u('photo-1554068865-24cecd4e34b8'),  // pickleball court
  'stargazing-telescope':      u('photo-1419242902214-272b3f66ee7a'), // stars over silhouette
  'ev-charging':               u('photo-1633507226306-b76c1b73267e'), // EV charging plug
  'outdoor-griddle-breakfast': u('photo-1558030006-450675393462'),   // outdoor cooking

  // ── Off-property fishing / water sports (Place photos failed earlier) ──
  'fish-crooked-river-at-crr':       u('photo-1499363536502-87642509e31b'), // fly cast
  'fish-deschutes-at-steelhead-falls': u('photo-1542888280-ae51bf6c3d09'),    // angler river
  'crooked-river-fishing':           u('photo-1542888280-ae51bf6c3d09'),    // angler river
  'deschutes-flyfishing':            u('photo-1499363536502-87642509e31b'), // fly cast
  'metolius-river-flyfishing':       u('photo-1545486332-9e0999c535b2'),    // spring creek
  'cascade-lakes-flyfishing':        u('photo-1518126434255-87dd0caab9df'), // alpine lake fishing
  'sparks-lake-paddle':              u('photo-1530870110042-98b2cb110834'), // SUP at sunrise
  'crane-prairie-boating':           u('photo-1531251445707-1f000e1e87d0'), // boat fishing
  'arnold-ice-cave':                 u('photo-1583244532610-2a234dac4a6c'), // cave entrance
  'crooked-river-loop-run':          u('photo-1483721310020-03333e577078'), // trail runner

  // ── Off-property: stock for entries the user specifically called out ──
  'redmond-antiques':          u('photo-1589828589849-3da8bdb18ddf'),  // antique shop interior
  'river-dog-splash':          u('photo-1530281700549-e82e7bf110d6'),  // dog in water
  'bend-coffee-roaster':       u('photo-1559056199-641a0ac8b55e'),     // coffee roaster
  'local-craft-beer':          u('photo-1559339352-11d035aa65de'),     // craft beer flight
  'canyon-view-dining':        u('photo-1414235077428-338989a2e8c0'),  // restaurant table
  'riverside-bbq':             u('photo-1452977237-e69e0bf36cb3'),     // riverside picnic
};

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  // 1. Deletes
  let deleted = 0;
  for (const slug of TO_DELETE) {
    if (dryRun) { console.log(`would DELETE ${slug}`); deleted++; continue; }
    const r = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'DELETE', headers: sbHeaders,
    });
    if (r.ok) { deleted++; console.log(`DELETE ${slug}`); }
    else console.log(`  ⚠ DELETE failed for ${slug}: ${r.status}`);
  }

  // 2. Hero image assignments — only for rows currently lacking a hero.
  const all = await (await fetch(`${SB_URL}/rest/v1/things_to_do?select=slug,title,hero_image_url`, { headers: sbHeaders })).json();
  let updated = 0;
  for (const row of all) {
    if (row.hero_image_url) continue;
    const newHero = HERO_FOR_SLUG[row.slug];
    if (!newHero) { console.log(`  · no hero mapped for ${row.slug}`); continue; }
    if (dryRun) { console.log(`would SET ${row.slug} → ${newHero.slice(0, 60)}…`); updated++; continue; }
    const r = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(row.slug)}`, {
      method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero_image_url: newHero }),
    });
    if (r.ok) { updated++; console.log(`  ✓ ${row.slug.padEnd(34)} → ${newHero.slice(0, 60)}${newHero.length > 60 ? '…' : ''}`); }
    else console.log(`  ⚠ PATCH failed for ${row.slug}: ${r.status} ${await r.text()}`);
  }

  console.log(`\n${deleted} deleted, ${updated} hero images set.${dryRun ? ' (dry run)' : ''}`);
})();
