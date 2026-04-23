#!/usr/bin/env node
/**
 * backfill-trail-photos.mjs — give each trail a hero_image_url drawn
 * from a relevant Google Place photo via /api/place-photo proxy.
 *
 * Maps trail slug → a Places query that should return a representative
 * photo (the trailhead, the destination, or the park the trail is in).
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

// trail slug → Places query
const QUERIES = {
  'crr-canyon-trail':                'Crooked River Canyon Overlook Trail Terrebonne Oregon',
  'smith-rock-river-trail':          'Smith Rock State Park Oregon',
  'steelhead-falls':                 'Steelhead Falls Trailhead Oregon',
  'crooked-river-loop':              'Crooked River Rim Trail Cove Palisades Oregon',
  'tam-a-lau-trail':                 'Tam-a-lau Trail Cove Palisades Oregon',
  'misery-ridge-trail':              'Misery Ridge Trail Smith Rock Oregon',
  'otter-bench-trail':               'Otter Bench Trailhead Crooked River Ranch Oregon',
  'scout-camp-trail':                'Scout Camp Trailhead Terrebonne Oregon',
  // No Google place for Sand Ridge specifically; fall back to a CRR-area
  // canyon shot via the closest mapped feature (the Otter Bench network it
  // connects to).
  'sand-ridge-trail':                'Otter Bench Trailhead Crooked River Ranch Oregon',
  'crooked-river-canyon-overlook':   'Crooked River Canyon Overlook Trail Terrebonne Oregon',
  'alder-springs-trail':             'Alder Springs Trailhead Oregon',
};

async function getFirstPhotoName(query) {
  const sr = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!sr.ok) return null;
  const sj = await sr.json();
  const placeId = sj.places?.[0]?.id;
  if (!placeId) return null;
  const dr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'photos' },
  });
  if (!dr.ok) return null;
  const d = await dr.json();
  return d.photos?.[0]?.name ?? null;
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const trails = await (await fetch(`${SB_URL}/rest/v1/trails?select=slug,name,hero_image_url`, { headers: sbHeaders })).json();

  let updated = 0;
  for (const t of trails) {
    const q = QUERIES[t.slug];
    if (!q) { console.log(`  · skip ${t.slug} (no query mapped)`); continue; }
    const photoName = await getFirstPhotoName(q);
    if (!photoName) { console.log(`  · ${t.slug} — no photo found`); continue; }
    const heroUrl = `/api/place-photo?name=${encodeURIComponent(photoName)}&w=1600`;
    console.log(`  ✓ ${t.slug.padEnd(34)} → ${photoName.slice(0, 70)}…`);

    if (dryRun) { updated++; continue; }
    const u = await fetch(`${SB_URL}/rest/v1/trails?slug=eq.${encodeURIComponent(t.slug)}`, {
      method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero_image_url: heroUrl }),
    });
    if (u.ok) updated++;
    else console.log(`  ⚠ DB write failed for ${t.slug}: ${u.status} ${await u.text()}`);
    await new Promise(r => setTimeout(r, 120));
  }
  console.log(`\n${updated}/${trails.length} trail photos ${dryRun ? 'resolved' : 'written'}.`);
})();
