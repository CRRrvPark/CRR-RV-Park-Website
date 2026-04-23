#!/usr/bin/env node
/**
 * fix-area-guide-photos.mjs — replace duplicate / inappropriate
 * destination-card images on the /area-guide page with photos that
 * actually match each card.
 *
 * Strategy:
 *   - Destination-specific cards (Steelhead Falls, Bend, Sisters,
 *     Redmond, Mt Bachelor, High Desert Museum, Newberry, Crooked
 *     River Fishing) → use a Google Place photo of the actual place
 *     via /api/place-photo proxy.
 *   - Thematic / category cards (Local Dining & Drinks) → use a
 *     hand-picked Unsplash stock URL.
 *   - Cards that already have appropriate local photos (Smith Rock,
 *     CRR golf course, Seasonal Highlights gazebo) are left alone.
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

// Block ID → action.
// "place" actions resolve a Google Place photo via Text Search.
// "stock" actions use a hardcoded Unsplash CDN URL.
const ACTIONS = {
  // The block IDs here come from the area-guide page_builder_data;
  // the lookup is by the Puck "id" prop on each block (set at the
  // time the block was originally created in the editor).
  // We match by `headline` text since that's stable too.
  'Steelhead Falls & Canyon Trails':       { type: 'place',  query: 'Steelhead Falls Trailhead Oregon' },
  'Crooked River Fishing':                 { type: 'place',  query: 'Lower Crooked River Bowman Dam Prineville Oregon' },
  'Local Dining & Drinks':                 { type: 'stock',  url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop' },
  'Bend':                                  { type: 'place',  query: 'Bend Oregon' },
  'Sisters':                               { type: 'place',  query: 'Sisters Oregon downtown' },
  'Redmond':                               { type: 'place',  query: 'Downtown Redmond Oregon' },
  'Mt. Bachelor & Skiing':                 { type: 'place',  query: 'Mt Bachelor Ski Resort Oregon' },
  'High Desert Museum':                    { type: 'place',  query: 'High Desert Museum Bend Oregon' },
  'Newberry Volcanic Monument':            { type: 'place',  query: 'Newberry National Volcanic Monument Oregon' },
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
  const r = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.area-guide&select=page_builder_data`, { headers: sbHeaders });
  const [page] = await r.json();
  const pb = page.page_builder_data;
  const content = pb.content;

  let touched = 0;
  for (let i = 0; i < content.length; i++) {
    const b = content[i];
    const headline = b.props?.headline;
    if (!headline) continue;
    const action = ACTIONS[headline];
    if (!action) continue;

    let newUrl = null;
    if (action.type === 'stock') {
      newUrl = action.url;
    } else if (action.type === 'place') {
      const photoName = await getFirstPhotoName(action.query);
      if (!photoName) {
        console.log(`  ⚠ no photo found for "${headline}" (query: ${action.query})`);
        continue;
      }
      newUrl = `/api/place-photo?name=${encodeURIComponent(photoName)}&w=1200`;
      await new Promise(r => setTimeout(r, 120));
    }
    const before = b.props.image || '(no image)';
    b.props.image = newUrl;
    // Clean up the wrong field name from the prior run.
    delete b.props.imageUrl;
    console.log(`  "${headline}"`);
    console.log(`    before: ${before}`);
    console.log(`    after:  ${newUrl.slice(0, 80)}${newUrl.length > 80 ? '…' : ''}`);
    touched++;
  }

  console.log(`\n${touched} cards updated.`);
  if (dryRun) { console.log('(dry run — no DB write)'); return; }

  const u = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.area-guide`, {
    method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ page_builder_data: pb }),
  });
  if (u.ok) console.log('Saved.');
  else console.log(`  ⚠ DB write failed: ${u.status} ${await u.text()}`);
})();
