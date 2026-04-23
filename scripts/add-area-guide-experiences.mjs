#!/usr/bin/env node
/**
 * add-area-guide-experiences.mjs — adds 5 new TwoColumnSection
 * cards on /area-guide for the marquee experiences that were
 * otherwise buried in /things-to-do (bungee, hot air balloon,
 * whitewater rafting, Redmond Expo Center, horseback rides).
 *
 * Each card uses the same prop shape as the existing destination
 * cards (Smith Rock, Newberry, etc.) and links to its corresponding
 * /things-to-do/[slug] detail page for the full profile + tips.
 *
 * Cards are inserted just after "Newberry Volcanic Monument"
 * (the last existing destination card) and before "The larger
 * picture" text block — keeps the editorial flow intact.
 *
 * Re-runnable: skips any card whose `id` already exists.
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

const NEW_CARDS = [
  {
    id: 'area-guide-bungee',
    headline: 'Bungee jump the Crooked River High Bridge',
    label: 'Adventure · 20 min',
    body: "<p>Central Oregon Bungee Adventures runs jumps off the Crooked River High Bridge at Peter Skene Ogden Wayside — a 250-foot drop and reportedly the tallest commercial bungee in North America. The same canyon system that wraps Crooked River Ranch.</p>",
    ctaUrl: '/things-to-do/bungee-crooked-river-bridge',
    ctaLabel: 'Plan the jump →',
    query: 'Peter Skene Ogden State Scenic Viewpoint Oregon',
  },
  {
    id: 'area-guide-balloon',
    headline: 'Sunrise hot air balloon flight',
    label: 'Big Sky Balloon Co · 25 min',
    body: "<p>Big Sky Balloon Co. has been flying out of the Redmond / Bend area since 1993 with a perfect safety record. Sunrise launches over the Cascades, Smith Rock, and the Crooked River canyons. Plan ~3 hours start to finish.</p>",
    ctaUrl: '/things-to-do/hot-air-balloon-bigsky',
    ctaLabel: 'Book a flight →',
    query: 'Big Sky Balloon Company Redmond Oregon',
  },
  {
    id: 'area-guide-rafting',
    headline: 'Whitewater raft the Lower Deschutes',
    label: 'Maupin · 90 min',
    body: "<p>The Lower Deschutes around Maupin runs Class I-IV rapids through high-walled canyon. Half-day, full-day, or multi-day overnight trips. Famous rapids including Boxcar and Oak Springs. Eight+ outfitters operate from Maupin.</p>",
    ctaUrl: '/things-to-do/whitewater-rafting-deschutes',
    ctaLabel: 'See the trip options →',
    query: 'Deschutes River Adventures Maupin Oregon',
  },
  {
    id: 'area-guide-horseback',
    headline: 'Guided horseback rides along the canyon',
    label: 'Smith Rock Trail Rides · 20 min',
    body: "<p>Smith Rock Trail Rides operates from a private ranch adjacent to Smith Rock — same canyon system that wraps CRR. Small private guided rides on horses suited to first-timers. 1.5-hour trips, ages 10+, one tour per day for the personal experience.</p>",
    ctaUrl: '/things-to-do/smith-rock-trail-rides',
    ctaLabel: 'Saddle up →',
    query: 'Smith Rock Trail Rides Terrebonne Oregon',
  },
  {
    id: 'area-guide-expo',
    headline: 'Stay near Deschutes County Expo events',
    label: 'Year-round events · 20 min',
    body: "<p>The Deschutes County Fair & Expo Center hosts the County Fair, Monster Jam-style truck shows, motocross + dirt bike + BMX, livestock + dog shows, gun shows, RV shows, motorhome rallies, wrestling tournaments, conferences, and holiday markets year-round. CRR is one of the closest full-hookup RV parks — bring the rig.</p>",
    ctaUrl: '/things-to-do/redmond-expo-center',
    ctaLabel: 'Plan around an event →',
    query: 'Deschutes County Fair Expo Center Redmond Oregon',
  },
];

// Template based on the existing area-guide TwoColumnSection cards.
function makeBlock(card, photoName) {
  return {
    type: 'TwoColumnSection',
    props: {
      id: card.id,
      headline: card.headline,
      label: card.label,
      body: card.body,
      image: photoName ? `/api/place-photo?name=${encodeURIComponent(photoName)}&w=2400` : '',
      imagePosition: 'right',
      imageObjectFit: 'cover',
      imageBorderRadius: 4,
      ctaUrl: card.ctaUrl,
      ctaLabel: card.ctaLabel,
      shadow: 'none',
      bgColor: '',
      textColor: '',
      borderColor: '#d8ccb7',
      paddingX: 0,
      paddingTop: 0,
      marginTop: 0,
      sectionId: '',
    },
  };
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const r = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.area-guide&select=page_builder_data`, { headers: sbHeaders });
  const [page] = await r.json();
  const pb = page.page_builder_data;
  const existingIds = new Set(pb.content.map(b => b.props?.id).filter(Boolean));

  // Find the insert point: just after the last existing destination
  // card (Newberry) and before the "The larger picture" TextBlock.
  const newberryIdx = pb.content.findIndex(b => b.props?.headline === 'Newberry Volcanic Monument');
  const insertAt = newberryIdx >= 0 ? newberryIdx + 1 : pb.content.length;

  const toInsert = [];
  for (const card of NEW_CARDS) {
    if (existingIds.has(card.id)) {
      console.log(`  · skip ${card.id} (already in page)`);
      continue;
    }
    const photoName = await getFirstPhotoName(card.query);
    if (!photoName) console.log(`  ⚠ ${card.id}: no Google photo for ${card.query} — adding without image`);
    toInsert.push(makeBlock(card, photoName));
    console.log(`  ✓ ${card.id} — ${card.headline}${photoName ? ' (+photo)' : ' (no photo)'}`);
    await new Promise(r => setTimeout(r, 130));
  }

  if (!toInsert.length) { console.log('\nNothing to insert.'); return; }
  pb.content.splice(insertAt, 0, ...toInsert);
  console.log(`\nInserting ${toInsert.length} cards at position ${insertAt}.`);

  if (dryRun) { console.log('(dry run)'); return; }
  const u = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.area-guide`, {
    method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ page_builder_data: pb }),
  });
  if (u.ok) console.log('Saved.');
  else console.log(`  ⚠ DB write failed: ${u.status} ${await u.text()}`);
})();
