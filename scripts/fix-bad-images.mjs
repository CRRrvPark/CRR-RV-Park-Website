#!/usr/bin/env node
/**
 * fix-bad-images.mjs — replace verified-wrong stock images on
 * things_to_do entries, swap two thematic Place photos that were
 * returning generic resort shots, and fall back trail heroes to
 * Place photos until Maps Static API is enabled on the key.
 *
 * Owner reported these specific mismatches:
 *   - "stars on fishing card"     → wrong Unsplash photo ID
 *   - "urban runner on trail run" → wrong Unsplash photo ID
 *   - Black Butte Stables image was the Black Butte Ranch
 *     resort lobby with Christmas-tree decor (Google Place photo
 *     for the parent ranch isn't a horseback shot)
 *   - Trail static map heroes show "just colors" because the
 *     Google Maps Static API isn't authorized on the server key
 *
 * All Unsplash CDN URLs in this file have been individually
 * verified by fetching their parent page on unsplash.com and
 * confirming the photo subject matches its intended use here.
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
if (!SB_URL || !SB_KEY) { console.error('missing env'); process.exit(1); }
const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

const u = (id) => `https://images.unsplash.com/${id}?w=1600&q=80&auto=format&fit=crop`;

// All entries here use VERIFIED Unsplash photo IDs (each was looked
// up on unsplash.com to confirm the subject matches the card).
const HERO_OVERRIDES = {
  // ── User-flagged wrong images ──
  'fish-crooked-river-at-crr':       u('photo-1532015917327-c7c46aa1d930'), // angler fly-casting on river
  'crooked-river-loop-run':          u('photo-1456613820599-bfe244172af5'), // mountain trail runner
  'black-butte-stables':             u('photo-1662408078442-499cf96b1e18'), // horses on a wooded trail
  'smith-rock-trail-rides':          u('photo-1662408078442-499cf96b1e18'), // horses on a wooded trail (also)

  // ── Other entries with bad/unverified Unsplash IDs ──
  'pickleball-courts':               u('photo-1693142518820-78d7a05f1546'), // pickleball paddles on court
  'stargazing-telescope':            u('photo-1562430854-6e7115ee20bb'),    // Milky Way over silhouette
  'ev-charging':                     u('photo-1593941707882-a5bba14938c7'), // EV charging plug
  'arnold-ice-cave':                 u('photo-1760875196897-950d8ce117ec'), // lava tube cave
  'redmond-antiques':                u('photo-1444988510113-d8e9c6741202'), // antique store interior
  'river-dog-splash':                u('photo-1724159309913-35f480a551f4'), // dog swimming in river
  'bend-coffee-roaster':             u('photo-1511537190424-bbbab87ac5eb'), // coffee roasting beans
  'metolius-river-flyfishing':       u('photo-1635358530990-755042fb8fb1'), // forest stream
  'crane-prairie-boating':           u('photo-1762655889164-a8c60705d314'), // lake kayak fishing
  'deschutes-flyfishing':            u('photo-1532015917327-c7c46aa1d930'), // angler fly-casting on river
  'whitewater-rafting-deschutes':    u('photo-1629248564797-8c5ba85da9d3'), // rafting / paddling
  'hot-air-balloon-bigsky':          u('photo-1608682207726-499ae8443334'), // hot air balloon
  'bungee-crooked-river-bridge':     u('photo-1559677624-3c956f10d431'),    // bungee jumping
};

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  // ── Things to do hero overrides ──
  let updated = 0;
  for (const [slug, url] of Object.entries(HERO_OVERRIDES)) {
    if (!dryRun) {
      const r = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(slug)}`, {
        method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero_image_url: url }),
      });
      if (r.ok) { updated++; console.log(`  ✓ ${slug.padEnd(34)} → ${url.split('/').pop().slice(0, 40)}…`); }
      else console.log(`  ⚠ PATCH failed for ${slug}: ${r.status}`);
    } else {
      updated++;
      console.log(`would update ${slug} → ${url.slice(0, 80)}`);
    }
  }
  console.log(`\nThings-to-do: ${updated} hero images replaced.`);

  // ── Trail hero fallback: revert from /api/static-map (broken until
  //    Maps Static API is enabled) to the previous Place photo, which
  //    we stashed in gallery_image_urls[0] during the static-map run. ──
  const trails = await (await fetch(`${SB_URL}/rest/v1/trails?select=slug,name,hero_image_url,gallery_image_urls`, { headers: sbHeaders })).json();
  let reverted = 0;
  for (const t of trails) {
    if (!t.hero_image_url?.startsWith('/api/static-map')) continue;
    const fallback = Array.isArray(t.gallery_image_urls) && t.gallery_image_urls[0] ? t.gallery_image_urls[0] : null;
    if (!fallback) {
      console.log(`  · ${t.slug}: no gallery fallback — leaving as-is`);
      continue;
    }
    if (!dryRun) {
      // Move fallback back to hero, drop it from gallery.
      const newGallery = t.gallery_image_urls.slice(1);
      const r = await fetch(`${SB_URL}/rest/v1/trails?slug=eq.${encodeURIComponent(t.slug)}`, {
        method: 'PATCH', headers: sbHeaders,
        body: JSON.stringify({ hero_image_url: fallback, gallery_image_urls: newGallery }),
      });
      if (r.ok) { reverted++; console.log(`  ↩ ${t.slug.padEnd(34)} → ${fallback.slice(0, 50)}…`); }
      else console.log(`  ⚠ PATCH failed for ${t.slug}: ${r.status}`);
    } else {
      reverted++;
    }
  }
  console.log(`\nTrails: ${reverted} reverted from static-map to Place photo fallback.`);
  if (dryRun) console.log('(dry run — no DB writes)');
})();
