#!/usr/bin/env node
/**
 * fix-area-guide-quality.mjs — three things on /area-guide:
 *
 * 1. Bump every /api/place-photo URL on the page from w=1200 to
 *    w=2400. The 1200-width images were rendering blurry on
 *    desktop where the card's actual rendered width is ~700px and
 *    Retina screens demand 2x.
 *
 * 2. Replace the ExploreGridSection ("From your canyon rim
 *    basecamp.") cards' images with proper destination photos.
 *    The "Fly Fishing & Hiking" card was using golf_course.jpg
 *    (clearly wrong). Bend and Sisters were using
 *    central_oregon.jpg / canyon_day.jpg (also wrong).
 *
 * 3. Clear every imageWidth/imageHeight on TwoColumnSection +
 *    ExploreGridSection cards so images render at their natural
 *    aspect ratio instead of getting stretched/cropped to fixed
 *    pixel dimensions (same fix as scripts/fix-amenities-page.mjs).
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

// ExploreGrid card title → action.
// "place" actions resolve via Google Places. "stock" uses Unsplash.
const GRID_ACTIONS = {
  'Smith Rock State Park':  { type: 'place', query: 'Smith Rock State Park Oregon' },
  'Bend':                   { type: 'place', query: 'Bend Oregon downtown' },
  'Sisters':                { type: 'place', query: 'Sisters Oregon downtown' },
  'Fly Fishing & Hiking':   { type: 'stock', url: 'https://images.unsplash.com/photo-1499363536502-87642509e31b?w=2400&q=80&auto=format&fit=crop' },
};

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const r = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.area-guide&select=page_builder_data`, { headers: sbHeaders });
  const [page] = await r.json();
  const pb = page.page_builder_data;

  // 1. Bump every existing /api/place-photo URL from w=1200 to w=2400.
  let bumpedUrls = 0;
  const json = JSON.stringify(pb);
  const bumped = json.replace(/(\/api\/place-photo\?[^"']*?)w=1200/g, (m, p1) => {
    bumpedUrls++;
    return p1 + 'w=2400';
  });
  const reparsed = JSON.parse(bumped);
  pb.content = reparsed.content;
  console.log(`Bumped ${bumpedUrls} place-photo URLs from w=1200 to w=2400.`);

  // 2. Update ExploreGrid card images.
  let gridUpdates = 0;
  for (const block of pb.content) {
    if (block.type !== 'ExploreGridSection') continue;
    if (!Array.isArray(block.props?.cards)) continue;
    for (const card of block.props.cards) {
      const action = GRID_ACTIONS[card.title];
      if (!action) continue;
      let newImg = null;
      if (action.type === 'stock') {
        newImg = action.url;
      } else if (action.type === 'place') {
        const photoName = await getFirstPhotoName(action.query);
        if (!photoName) {
          console.log(`  ⚠ no Google photo for "${card.title}" (query: ${action.query})`);
          continue;
        }
        newImg = `/api/place-photo?name=${encodeURIComponent(photoName)}&w=2400`;
        await new Promise(r => setTimeout(r, 130));
      }
      console.log(`  card "${card.title}": ${card.image} → ${newImg.slice(0, 70)}${newImg.length > 70 ? '…' : ''}`);
      card.image = newImg;
      // Also reset alt to something appropriate (the old alt text may
      // describe the old image, e.g. "Golf course canyon views").
      card.alt = card.title;
      gridUpdates++;
    }
  }
  console.log(`Updated ${gridUpdates} ExploreGrid cards.`);

  // 3. Clear forced imageWidth/imageHeight everywhere on the page.
  let cleared = 0;
  for (const block of pb.content) {
    if (block.type === 'TwoColumnSection') {
      if (block.props?.imageWidth || block.props?.imageHeight) {
        block.props.imageWidth = 0;
        block.props.imageHeight = 0;
        cleared++;
      }
    } else if (block.type === 'ExploreGridSection' && Array.isArray(block.props?.cards)) {
      for (const card of block.props.cards) {
        if (card.imageWidth || card.imageHeight) {
          card.imageWidth = 0;
          card.imageHeight = 0;
          cleared++;
        }
      }
    }
  }
  console.log(`Cleared forced dims on ${cleared} blocks/cards.`);

  if (dryRun) { console.log('\n(dry run)'); return; }
  const u = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.area-guide`, {
    method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ page_builder_data: pb }),
  });
  console.log(u.ok ? 'Saved.' : `⚠ DB write failed: ${u.status} ${await u.text()}`);
})();
