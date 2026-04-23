#!/usr/bin/env node
/**
 * backfill-trail-static-maps.mjs — replace each trail's hero image
 * with a Google Static Maps terrain view of the trailhead.
 *
 * Why: the previous Google-Place-photo backfill ended up reusing
 * generic "Crooked River Ranch area" photos for several trails
 * (Otter Bench network shares one photo across multiple trails),
 * which the owner flagged. A topographic map of the trailhead is
 * always specific, never reused, and immediately useful — it tells
 * the guest "here's where this trail starts."
 *
 * The previous Place photos move to gallery_image_urls so they
 * still appear lower on the trail's detail page if useful.
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

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const trails = await (await fetch(`${SB_URL}/rest/v1/trails?select=slug,name,trailhead_lat,trailhead_lng,hero_image_url,gallery_image_urls`, { headers: sbHeaders })).json();

  let updated = 0;
  for (const t of trails) {
    if (t.trailhead_lat == null || t.trailhead_lng == null) {
      console.log(`  · skip ${t.slug} (no coords)`);
      continue;
    }
    // Zoom 14 for in-canyon trails, 13 for longer regional trails.
    const longish = ['crooked-river-loop', 'tam-a-lau-trail', 'alder-springs-trail'].includes(t.slug);
    const zoom = longish ? 13 : 14;
    const newHero = `/api/static-map?lat=${t.trailhead_lat.toFixed(6)}&lng=${t.trailhead_lng.toFixed(6)}&zoom=${zoom}&w=1200&h=750`;

    // Demote the previous Place-photo hero into the gallery (front of array)
    // unless it's already there. Skip strings that look like our own static-map
    // URL (idempotent re-runs).
    let newGallery = Array.isArray(t.gallery_image_urls) ? t.gallery_image_urls.slice() : [];
    if (t.hero_image_url && !t.hero_image_url.startsWith('/api/static-map') && !newGallery.includes(t.hero_image_url)) {
      newGallery = [t.hero_image_url, ...newGallery].slice(0, 6);
    }

    console.log(`  ✓ ${t.slug.padEnd(34)} z${zoom}  (gallery: ${newGallery.length})`);
    updated++;

    if (dryRun) continue;
    const u = await fetch(`${SB_URL}/rest/v1/trails?slug=eq.${encodeURIComponent(t.slug)}`, {
      method: 'PATCH', headers: sbHeaders,
      body: JSON.stringify({ hero_image_url: newHero, gallery_image_urls: newGallery }),
    });
    if (!u.ok) console.log(`  ⚠ DB write failed: ${u.status} ${await u.text()}`);
  }
  console.log(`\n${updated}/${trails.length} trails ${dryRun ? 'resolved' : 'written'}.`);
})();
