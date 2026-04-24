#!/usr/bin/env node
/**
 * upload-site-photos.mjs — upload renamed park-site JPEGs from
 * C:\Users\mathe\Downloads\rv-site-photos-jpg\ to Supabase Storage
 * and set each park_sites.hero_image_url to the resulting public URL.
 *
 * Mapping (filename → site_number):
 *   T-N.jpg     → site_number "TN"  (loop T)
 *   A-N.jpg     → site_number "AN"  (loop A; default)
 *   A-N_alt.jpg → site_number "AN"  (PREFERRED over A-N.jpg when present —
 *                                    owner: the alt shots are zoomed-out
 *                                    framing the RV pad + grass, more
 *                                    representative than the close pedestal
 *                                    shots in the originals)
 *   MAGIC.jpg   → site_number "MAGIC"
 *
 * Skipped: *_dup.jpg (duplicate photo of same site),
 *          unknown_*.jpg (no site sign visible in frame — owner to ID),
 *          gazebo.jpg (not a site row).
 *
 * Idempotent — re-running re-uploads (upsert) and re-assigns. Storage
 * paths are stable per site_number so the same photo never duplicates.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
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
const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
const PHOTOS_DIR = 'C:\\Users\\mathe\\Downloads\\rv-site-photos-jpg';
const BUCKET = 'media';

// Translate a JPEG filename to (site_number, isAlt).
// Returns null if the file should be skipped entirely.
function mapFilenameToSite(name) {
  const stem = name.replace(/\.jpg$/i, '');
  if (stem.endsWith('_dup')) return null;
  if (stem.startsWith('unknown_')) return null;
  if (stem === 'gazebo') return null;
  if (stem === 'MAGIC') return { site: 'MAGIC', alt: false };
  // Loop-letter prefixed (T-9, A-12, B-3, C-7, D-25 …) with optional
  // _alt suffix or iPhone parenthesized duplicate suffix like B-7(2).
  // The duplicate variants are treated as skipped (the un-parenthesized
  // file wins for hero assignment).
  if (/^([A-Z])-(\d+)\(\d+\)$/.test(stem)) return null; // duplicate take
  const altMatch = stem.match(/^([A-Z])-(\d+)_alt$/);
  if (altMatch) return { site: altMatch[1] + altMatch[2], alt: true };
  const mainMatch = stem.match(/^([A-Z])-(\d+)$/);
  if (mainMatch) return { site: mainMatch[1] + mainMatch[2], alt: false };
  return null;
}

async function uploadToStorage(localPath, storagePath) {
  const bytes = readFileSync(localPath);
  const url = `${SB_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(storagePath)}`;
  // PUT with x-upsert:true overwrites cleanly on re-runs.
  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...sbHeaders, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: bytes,
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`upload ${storagePath}: ${r.status} ${body.slice(0, 200)}`);
  }
  return `${SB_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(storagePath)}`;
}

async function setSiteHero(siteNumber, publicUrl) {
  const r = await fetch(`${SB_URL}/rest/v1/park_sites?site_number=eq.${encodeURIComponent(siteNumber)}`, {
    method: 'PATCH',
    headers: { ...sbHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hero_image_url: publicUrl }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`PATCH ${siteNumber}: ${r.status} ${body.slice(0, 200)}`);
  }
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const files = readdirSync(PHOTOS_DIR).filter(n => /\.jpg$/i.test(n)).sort();

  // Build the assignment plan first. When BOTH A-N.jpg and A-N_alt.jpg
  // exist for the same site, the alt wins (owner's preference).
  const planBySite = new Map();
  const skipped = [];
  for (const name of files) {
    const m = mapFilenameToSite(name);
    if (!m) { skipped.push(name); continue; }
    const existing = planBySite.get(m.site);
    if (!existing || (m.alt && !existing.alt)) {
      planBySite.set(m.site, { ...m, file: name });
    }
  }

  // Verify each target site exists in the DB before uploading (so we
  // don't waste storage on names that won't map).
  const wantSites = Array.from(planBySite.keys());
  const dbR = await fetch(`${SB_URL}/rest/v1/park_sites?select=site_number&site_number=in.(${wantSites.map(encodeURIComponent).join(',')})`, { headers: sbHeaders });
  const dbRows = await dbR.json();
  const dbSites = new Set(dbRows.map(r => r.site_number));
  const missing = wantSites.filter(s => !dbSites.has(s));
  if (missing.length) console.log(`⚠ Sites not in DB (will skip): ${missing.join(', ')}`);

  console.log(`\n─── PLAN (${planBySite.size - missing.length} sites) ───`);
  for (const [site, m] of planBySite) {
    if (!dbSites.has(site)) continue;
    console.log(`  ${site.padEnd(6)} ← ${m.file}${m.alt ? '  (alt preferred)' : ''}`);
  }
  console.log(`\nSkipped files: ${skipped.length}  (${skipped.slice(0, 6).join(', ')}${skipped.length > 6 ? '…' : ''})`);

  if (dryRun) { console.log('\n(dry run — no uploads or DB writes)'); return; }

  let uploaded = 0, assigned = 0, errors = 0;
  for (const [site, m] of planBySite) {
    if (!dbSites.has(site)) continue;
    const localPath = `${PHOTOS_DIR}\\${m.file}`;
    const storagePath = `sites/${site}.jpg`;
    try {
      const publicUrl = await uploadToStorage(localPath, storagePath);
      uploaded++;
      await setSiteHero(site, publicUrl);
      assigned++;
      console.log(`  ✓ ${site.padEnd(6)} ← ${m.file}`);
    } catch (e) {
      errors++;
      console.log(`  ✗ ${site}: ${e.message}`);
    }
  }
  console.log(`\nUploaded ${uploaded}, assigned ${assigned}, errors ${errors}.`);
})();
