#!/usr/bin/env node
/**
 * enrich-experience-adventures.mjs — adds the "experience-based"
 * adventures the owner specifically called out (bungee jumping, hot
 * air balloons, whitewater rafting, horseback riding) and rewrites
 * the existing redmond-expo-center entry with SEO-focused copy that
 * names the recurring event types people actually search for.
 *
 * Same shape as the other enrich scripts: each entry gets a
 * paragraph + tips + verified distance from CRR + external link
 * (from Places API where available) + hero photo via /api/place-photo.
 * All distances are wall-clock driving from the CRR RV Park, not
 * straight-line geographic distance.
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

const ENTRIES = [
  // ── BUNGEE (super close to CRR — Peter Skene Ogden Wayside) ─────
  {
    mode: 'insert', slug: 'bungee-crooked-river-bridge',
    title: 'Bungee jump the Crooked River High Bridge',
    category: 'active',
    icon: '🪂',
    displayOrder: 8,
    distance: '20 min north',
    para: "Central Oregon Bungee Adventures runs jumps off the Crooked River High Bridge at Peter Skene Ogden State Scenic Viewpoint — a 250-foot drop and reportedly the tallest commercial bungee in North America. The historic 1926 steel arch bridge sits 295 feet above the Crooked River canyon (the same canyon that wraps Crooked River Ranch). Their cord rig anchors to a custom-built platform that extends out over the western edge.",
    tips: [
      "<strong>Operator:</strong> Central Oregon Bungee Adventures — <a href=\"https://oregonbungee.com\" target=\"_blank\" rel=\"noopener noreferrer\">oregonbungee.com</a> / <a href=\"tel:5416685867\">541-668-JUMP</a>.",
      "<strong>Reservations strongly recommended</strong> — operating days/seasons vary; confirm before driving over.",
      "<strong>Where:</strong> Peter Skene Ogden State Scenic Viewpoint on Hwy 97 (the same wayside guests visit for the canyon overlook).",
      "<strong>Drop:</strong> ~250 feet, free-fall onto the bungee. Pricing posted on operator's site.",
      "<strong>What to bring:</strong> Closed-toe shoes, ID, and a clear head — they brief everyone before the jump.",
      "<strong>Spectators welcome.</strong> The wayside parking and viewpoint are free, even if you're just along for the show.",
    ],
    safety: false,
    query: 'Peter Skene Ogden State Scenic Viewpoint Oregon',
  },

  // ── HORSEBACK (right next door — same canyon system as CRR) ─────
  {
    mode: 'insert', slug: 'smith-rock-trail-rides',
    title: 'Guided horseback rides along the Crooked River canyon',
    category: 'families',
    icon: '🐎',
    displayOrder: 9,
    distance: '20 min',
    para: "Smith Rock Trail Rides operates from a private ranch adjacent to Smith Rock State Park — same canyon system that wraps Crooked River Ranch. Small, private guided rides on horses suited to first-timers (the guide is a professional horseman). Trips run about 1.5 hours and access areas of the canyon that aren't on the public trail map. They book one tour per day for a more personal experience.",
    tips: [
      "<strong>Operator:</strong> Smith Rock Trail Rides — book ahead, only one tour per day.",
      "<strong>Ride length:</strong> ~1.5 hours per outing.",
      "<strong>Age requirement:</strong> 10 and up.",
      "<strong>What to wear:</strong> Long pants, closed-toe shoes (boots ideal), a hat — high desert sun is intense.",
      "<strong>Skill level:</strong> Beginners welcome — guide handles instruction and pace.",
      "<strong>Sunrise + sunset rides</strong> book up first; weekends fill weeks ahead.",
    ],
    safety: false,
    query: 'Smith Rock Trail Rides Terrebonne Oregon',
  },
  {
    mode: 'insert', slug: 'black-butte-stables',
    title: 'Trail rides at Black Butte Stables (Sisters)',
    category: 'families',
    icon: '🐎',
    displayOrder: 16,
    distance: '45 min west',
    para: "Black Butte Ranch sits 15 minutes northwest of Sisters in classic ponderosa-pine country, with the Three Sisters and Mt Washington close enough to feel them. Their stables run guided trail rides for beginner and intermediate riders — 3.3 to 7 mile loops, typically 1-2 hours.",
    tips: [
      "<strong>Skill levels:</strong> Beginner + intermediate trips. Lessons available for first-timers.",
      "<strong>Dress:</strong> Long pants, closed-toe shoes, sun hat, water.",
      "<strong>Reservations:</strong> Book in advance — peak season can fill out weeks ahead.",
      "<strong>Combine with:</strong> A Sisters lunch and the drive past Camp Sherman + the Metolius River.",
    ],
    safety: false,
    query: 'Black Butte Ranch Sisters Oregon',
  },

  // ── HOT AIR BALLOON ────────────────────────────────────────────
  {
    mode: 'insert', slug: 'hot-air-balloon-bigsky',
    title: 'Sunrise hot air balloon flight over Central Oregon',
    category: 'families',
    icon: '🎈',
    displayOrder: 18,
    distance: '25 min south (launch from Redmond)',
    para: "Big Sky Balloon Co. has been flying out of the Redmond / Bend area since 1993 with a perfect safety record. Their launches run from a Redmond field at first light. The full experience is about three hours including the launch crew briefing, the ~1 hour flight itself (winds dictate the actual route — that's part of the magic), and a champagne toast at landing. Cascades to the west, Smith Rock + Crooked River canyons below.",
    tips: [
      "<strong>Operator:</strong> Big Sky Balloon Co. (since 1993, perfect safety record).",
      "<strong>Total time block:</strong> Plan ~3 hours from arrival to landing.",
      "<strong>Sunrise launch only</strong> — wind conditions are calmest at dawn.",
      "<strong>Reserve well in advance:</strong> July and August book months out; flights weather-dependent.",
      "<strong>Dress in layers:</strong> Cool at altitude even in summer; the burner above keeps you warm.",
      "<strong>Alt operator:</strong> Cascade Balloon Company also serves Central Oregon out of Bend.",
    ],
    safety: false,
    query: 'Big Sky Balloon Company Redmond Oregon',
  },

  // ── WHITEWATER RAFTING (worth the drive) ───────────────────────
  {
    mode: 'insert', slug: 'whitewater-rafting-deschutes',
    title: 'Whitewater raft the Lower Deschutes (Maupin)',
    category: 'active',
    icon: '🛶',
    displayOrder: 22,
    distance: '90 min north',
    para: "The Lower Deschutes around Maupin runs Class I-IV rapids through high-walled canyon, and at least eight outfitters operate out of Maupin offering everything from half-day floats to multi-day overnight expeditions. Famous rapids include Boxcar and Oak Springs. Suitable for first-timers on the half-day trips; full days bring bigger water and a packed lunch on the river.",
    tips: [
      "<strong>Half-day:</strong> The classic intro trip — ~3 hours on the water, hits the named rapids.",
      "<strong>Full-day:</strong> Adds more river miles + a riverside lunch.",
      "<strong>Multi-day:</strong> Camp on the river — special permit usually included via the outfitter.",
      "<strong>Known outfitters:</strong> Deschutes River Adventures, Imperial River Co, River Drifters, Sage Canyon, Sun Country Tours, Tributary Whitewater, ROW Adventures, High Country Expeditions.",
      "<strong>Season:</strong> April through October (water is cold early in the season).",
      "<strong>What to bring:</strong> Quick-dry clothes, sturdy water shoes (no flip-flops), sunscreen, dry layer for after.",
      "<strong>Best for:</strong> Families with kids 6+ on calmer trips, thrill-seekers on full-day.",
    ],
    safety: false,
    query: 'Maupin Oregon Deschutes River',
  },

  // ── REDMOND EXPO CENTER — heavy SEO rewrite ─────────────────────
  {
    mode: 'patch', slug: 'redmond-expo-center',
    title: 'Stay near Deschutes County Fair & Expo Center events',
    category: 'day_trippers',
    icon: '🎪',
    displayOrder: 24,
    distance: '20 min south',
    para: "The Deschutes County Fair & Expo Center in Redmond is Central Oregon's main events venue and hosts a nonstop calendar of fairs, motorsports, concerts, livestock shows, and tournaments year-round. Crooked River Ranch RV Park is one of the closest full-hookup RV parks to the Expo — about 20 minutes north on Hwy 97. If you're traveling for an event at the Expo, you can park your rig here and drive in fresh each morning instead of staying in a chain hotel parking lot.",
    tips: [
      "<strong>Recurring annual events at the Expo:</strong> Deschutes County Fair (early August), Sisters Folk Festival overflow, monster truck shows (Monster Jam-style), motocross + dirt bike races, BMX, livestock + horse shows, dog shows, gun shows, RV shows, motorhome rallies, wrestling tournaments + cheer competitions, school athletic events, large business + trade conferences, holiday markets.",
      "<strong>Planning around an event:</strong> Check the Expo's events calendar at <a href=\"https://expo.deschutes.org\" target=\"_blank\" rel=\"noopener noreferrer\">expo.deschutes.org</a> — most major events publish 6+ months out.",
      "<strong>Why stay at CRR vs. a Redmond hotel:</strong> Full hookup RV sites + golf course adjacent + canyon-rim quiet, all 20 minutes from the Expo. Brings the rig instead of leaving it home.",
      "<strong>Parking + access at the Expo:</strong> Free parking on most event days; expect heavier traffic on big-event Saturdays.",
      "<strong>Dining nearby:</strong> Downtown Redmond restaurants are 5 minutes from the Expo (Brickhouse Steakhouse, Hola! Pelican Bay, plus several breweries).",
      "<strong>Book ahead for big events:</strong> County Fair week + headline concerts will fill area RV parks weeks in advance.",
    ],
    safety: false,
    query: 'Deschutes County Fair Expo Center Redmond Oregon',
  },
];

const DETAIL_FIELDS = 'id,websiteUri,googleMapsUri,location,photos';

async function getPlaceByQuery(query) {
  const sr = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'places.id,places.location' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!sr.ok) return null;
  const sj = await sr.json();
  const p = sj.places?.[0];
  if (!p) return null;
  const dr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(p.id)}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
  });
  if (!dr.ok) return { id: p.id, lat: p.location.latitude, lng: p.location.longitude };
  const d = await dr.json();
  return {
    id: p.id,
    lat: d.location?.latitude ?? p.location.latitude,
    lng: d.location?.longitude ?? p.location.longitude,
    websiteUri: d.websiteUri,
    googleMapsUri: d.googleMapsUri,
    photoName: d.photos?.[0]?.name,
    photoNames: (d.photos ?? []).slice(0, 5).map(p => p.name),
  };
}

function buildHtml(e) {
  const tipsHtml = e.tips.map(t => `<li>${t}</li>`).join('\n  ');
  return `<p>${e.para}</p>\n<h3>Good to know</h3>\n<ul>\n  ${tipsHtml}\n</ul>`;
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  for (const e of ENTRIES) {
    const place = await getPlaceByQuery(e.query);
    if (!place) { console.log(`  ⚠ no place for ${e.slug}`); continue; }
    const html = buildHtml(e);
    const externalLink = place.websiteUri || place.googleMapsUri || null;
    const heroUrl = place.photoName ? `/api/place-photo?name=${encodeURIComponent(place.photoName)}&w=1200` : null;
    const galleryUrls = (place.photoNames ?? []).slice(1).map(n => `/api/place-photo?name=${encodeURIComponent(n)}&w=1600`);

    if (e.mode === 'patch') {
      const update = {
        title: e.title,
        category: e.category,
        summary: e.para.slice(0, 240),
        description: html,
        details_html: html,
        distance_from_park: e.distance,
        external_link: externalLink,
        lat: place.lat,
        lng: place.lng,
        is_published: true,
        ...(heroUrl ? { hero_image_url: heroUrl } : {}),
        ...(galleryUrls.length ? { gallery_image_urls: galleryUrls } : {}),
        ...(e.icon ? { icon: e.icon } : {}),
        ...(e.displayOrder ? { display_order: e.displayOrder } : {}),
      };
      console.log(`PATCH ${e.slug.padEnd(34)} @ ${place.lat.toFixed(4)},${place.lng.toFixed(4)}  ${heroUrl ? '+photo' : '(no photo)'}`);
      if (!dryRun) {
        const r = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(e.slug)}`, {
          method: 'PATCH', headers: sbHeaders, body: JSON.stringify(update),
        });
        if (!r.ok) console.log(`  ⚠ PATCH failed: ${r.status} ${await r.text()}`);
      }
    } else {
      const row = {
        slug: e.slug,
        title: e.title,
        summary: e.para.slice(0, 240),
        description: html,
        details_html: html,
        category: e.category,
        personas: [e.category],
        lat: place.lat,
        lng: place.lng,
        icon: e.icon ?? '📍',
        external_link: externalLink,
        distance_from_park: e.distance,
        is_published: true,
        display_order: e.displayOrder ?? 50,
        hero_image_url: heroUrl,
        gallery_image_urls: galleryUrls,
      };
      console.log(`INSERT ${e.slug.padEnd(33)} @ ${place.lat.toFixed(4)},${place.lng.toFixed(4)}  ${heroUrl ? '+photo' : '(no photo)'}`);
      if (!dryRun) {
        const r = await fetch(`${SB_URL}/rest/v1/things_to_do`, {
          method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(row),
        });
        if (!r.ok) console.log(`  ⚠ INSERT failed: ${r.status} ${await r.text()}`);
      }
    }
    await new Promise(r => setTimeout(r, 130));
  }
  console.log(`\nDone. (${dryRun ? 'dry run — no DB writes' : 'live'})`);
})();
