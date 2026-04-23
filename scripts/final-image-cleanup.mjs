#!/usr/bin/env node
/**
 * final-image-cleanup.mjs — final pass on things_to_do images +
 * two targeted deletions, per owner feedback 2026-04-23:
 *
 * - Horseback + fishing images must be "super generic" (no
 *   distinctive scenery that would mislead guests about what
 *   they'll find). Replaces every horseback and fishing hero
 *   with a close-up / tackle / portrait shot that can't be
 *   mistaken for a specific location.
 * - Book + do-nothing images need to be close-up subject shots,
 *   not canyon scenery.
 * - Sisters image was zoomed on treetops — swapped for a
 *   small-town-main-street stock that actually looks like a town.
 * - Bungee card goes back to the Google Place photo of the High
 *   Bridge at Peter Skene Ogden (shows the actual bridge, not a
 *   random bungee jumper somewhere else).
 * - DELETE: sparks-lake-paddle, outdoor-griddle-breakfast
 * - steaks-at-sunset gets the outdoor-griddle image before the
 *   griddle card is deleted.
 *
 * Every new Unsplash URL here was individually verified by
 * fetching its parent page on unsplash.com and confirming the
 * subject matches its card use.
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

const u = (id) => `https://images.unsplash.com/${id}?w=1600&q=80&auto=format&fit=crop`;

// Generic Unsplash photos — verified via unsplash.com page lookup.
const GENERIC = {
  horse:   u('photo-1657276649138-c22b20b03d99'), // single horse close-up face
  fishing: u('photo-1750944730385-c99159c4baee'), // fly-fishing flies on white surface
  book:    u('photo-1517770413964-df8ca61194a6'), // open book, bokeh background
  relax:   u('photo-1547691596-3e05ca9177e7'),    // person in hammock outdoors
  griddle: u('photo-1762596670506-74f1182c4617'), // sausages + eggs on grill
  mainStreet: u('photo-1558964580-2235801d7edb'), // small-town brick storefronts
};

// Bungee Place photo (Peter Skene Ogden / the High Bridge itself).
const BUNGEE_PLACE_PHOTO = 'places/ChIJP0JN4abXvlQRB87qXcM_mOs/photos/AU_ZVEHmEBVG9NgVOZQICvHDrg12VZe07BXuiovVdc6ADwJxxdT5XAHs0bKwWiccAZTpzeRcZ7DCBd9vhBlrNUkry_xOjqGXj2qHl66U5Eo03-0IPME99G4UdFaD3NLNScNriHXV6awjJdV5cfsXVMsQkKCmerflDF_26EK1vQlKZ_Wzs25vmFUgRf5O5U8p7cAvtyRurVbVVsz_KFeCzoxoIrICy8Szh0iqkajeV1LJ0WifhS7zWQLoTwHl5C7oK7-WaboOgGcCHAILFdGSCQpY3IvK61fUpxOrXnofzg5ARrvLQ7P3-5oaIAAeKTh7X2XgnO6fSKNQwhuFX9T4QOzA6b';
const BUNGEE_PLACE_URL = `/api/place-photo?name=${encodeURIComponent(BUNGEE_PLACE_PHOTO)}&w=2400`;

const HERO_OVERRIDES = {
  // Horseback — super generic horse portrait (no scenery)
  'smith-rock-trail-rides':      GENERIC.horse,
  'black-butte-stables':         GENERIC.horse,

  // Fishing — super generic fly-fishing tackle close-up
  'fish-crooked-river-at-crr':         GENERIC.fishing,
  'fish-deschutes-at-steelhead-falls': GENERIC.fishing,
  'crooked-river-fishing':             GENERIC.fishing,
  'deschutes-flyfishing':              GENERIC.fishing,
  'metolius-river-flyfishing':         GENERIC.fishing,
  'cascade-lakes-flyfishing':          GENERIC.fishing,

  // Book + doing nothing — subject close-ups, no landscape
  'reading-under-junipers':      GENERIC.book,
  'do-nothing-campsite':         GENERIC.relax,

  // Steaks card inherits the griddle photo since we're deleting griddle
  'steaks-at-sunset':            GENERIC.griddle,

  // Sisters downtown — the Google Place photo was zoomed on tree
  // tops; small-town main street stock is more honest to the card
  'sisters-downtown':            GENERIC.mainStreet,

  // Bungee card goes back to the Google Place photo of the actual
  // high bridge at Peter Skene Ogden (owner asked for this one
  // NOT to be stock — they want the real place image)
  'bungee-crooked-river-bridge': BUNGEE_PLACE_URL,
};

const TO_DELETE = [
  'sparks-lake-paddle',
  'outdoor-griddle-breakfast',
];

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  // 1. Image overrides
  let updated = 0;
  for (const [slug, url] of Object.entries(HERO_OVERRIDES)) {
    if (dryRun) { updated++; continue; }
    const r = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero_image_url: url }),
    });
    if (r.ok) { updated++; console.log(`  ✓ ${slug.padEnd(36)} → ${url.slice(0, 70)}${url.length > 70 ? '…' : ''}`); }
    else console.log(`  ⚠ PATCH failed for ${slug}: ${r.status}`);
  }

  // 2. Deletions
  let deleted = 0;
  for (const slug of TO_DELETE) {
    if (dryRun) { deleted++; continue; }
    const r = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'DELETE', headers: sbHeaders,
    });
    if (r.ok) { deleted++; console.log(`  🗑 DELETED ${slug}`); }
    else console.log(`  ⚠ DELETE failed for ${slug}: ${r.status}`);
  }

  // 3. Count remaining published things_to_do rows with coords
  //    (what shows on the map / public page).
  const all = await (await fetch(`${SB_URL}/rest/v1/things_to_do?select=slug,lat,lng,is_published`, { headers: sbHeaders })).json();
  const publicCount = all.filter(r => r.is_published).length;
  const mapCount = all.filter(r => r.is_published && r.lat != null && r.lng != null).length;

  console.log(`\n${updated} images updated · ${deleted} rows deleted.`);
  console.log(`Remaining things_to_do: ${publicCount} published total, ${mapCount} mappable.`);
  if (dryRun) console.log('(dry run — no DB writes)');
})();
