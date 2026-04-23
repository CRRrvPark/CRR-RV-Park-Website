#!/usr/bin/env node
/**
 * enrich-fishing-watersports.mjs — substantive fishing & water-sports
 * content for things_to_do, with safety notes about the Crooked River
 * canyon being hike-in-only from CRR.
 *
 * Restores the two fishing entries the owner had previously skipped
 * (now wanted with depth), adds 3 new fishing entries, enriches 2
 * existing boating entries, and adds 2 new boating entries.
 *
 * Same pattern as enrich-things-to-do.mjs: each entry has a curated
 * paragraph + tips + distance, with descriptions pitched at people
 * who actually came here to fish/boat.
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

const SAFETY_NOTE = "<p style=\"background:#fff3e6;border-left:3px solid #c4622d;padding:.6rem .9rem;margin-top:1rem;font-size:.88rem;\"><strong>Safety:</strong> The Crooked River canyon directly below CRR (visible from the rim) is hike-in only via Otter Bench, Scout Camp, or Lone Pine trails. Do <strong>not</strong> attempt to launch a boat from the property — the canyon is unsafe for any watercraft. All boating destinations below are reached via separate access roads.</p>";

// Each entry: target slug + full payload. `mode` decides PATCH (existing)
// vs INSERT (new). `displayOrder` controls sort on the public page —
// lower numbers = earlier; CRR-local fishing/boating sorts first.
const ENTRIES = [
  // ── CRR-LOCAL FISHING (closest to your site, no long drives) ────
  {
    mode: 'insert', slug: 'fish-crooked-river-at-crr',
    title: 'Fish the Crooked River canyon below CRR',
    category: 'active',
    displayOrder: 10,
    distance: 'Hike-in from CRR trailheads',
    para: "The Lower Crooked River runs through the canyon at the foot of CRR's plateau, with no road access — you hike down. The Otter Bench trail system (7.4 miles of trails on the bench above the gorge) is the only way in, with the Otter Bench trailhead inside the ranch. ODFW surveys show 4,000-7,000 redband rainbow trout per mile in the 8-mile tailwater section here. Light fishing pressure because the access is hike-only, so the fish that are here are willing.",
    tips: [
      "<strong>Species:</strong> Wild redband rainbow trout (the dominant fish here), mountain whitefish, occasional bull trout.",
      "<strong>Access:</strong> Otter Bench trailhead, inside Crooked River Ranch. The trail descends into the gorge — steep on the way back out.",
      "<strong>Bring:</strong> Sturdy boots, lots of water, sun protection. No shade. Pack out all gear.",
      "<strong>Fly tackle:</strong> Standard tailwater patterns work — pheasant tails, copper johns, BWO/PMD mayflies, midges in cooler months. Light setup (3-5 wt) for these fish.",
      "<strong>Spinners:</strong> Small Panther Martins, Rooster Tails, Mepps for non-fly anglers.",
      "<strong>Regulations:</strong> Bull trout must be released; rainbow trout over 20\" must be released. <strong>Always verify current ODFW Central Zone regulations.</strong>",
    ],
    safety: false,
    query: 'Otter Bench Trailhead Crooked River Ranch Oregon',
  },
  {
    mode: 'insert', slug: 'fish-deschutes-at-steelhead-falls',
    title: 'Fish the Middle Deschutes at Steelhead Falls',
    category: 'active',
    displayOrder: 12,
    distance: '10 min drive + short walk',
    para: "Steelhead Falls is on the Middle Deschutes, ~10 minutes from CRR. The Steelhead Falls trailhead is also one of the three CRR-area BLM trailheads (along with Otter Bench on the Crooked, and Scout Camp on the Middle Deschutes a bit farther downstream). Fishing the pools above and below the falls, plus the runs along the trail, is a popular near-the-park option that doesn't require a hike-in epic.",
    tips: [
      "<strong>Species:</strong> Wild redband rainbow trout primarily; occasional brown trout in deeper holes; bull trout possible (release).",
      "<strong>Access:</strong> Drive 10 min from CRR to the Steelhead Falls trailhead, then walk 0.5 mi to the falls. Fishable pools both above and below.",
      "<strong>Tackle:</strong> Light-to-medium rod. Standard middle Deschutes flies (caddis, mayflies, small streamers) or small spinners.",
      "<strong>Best times:</strong> Morning + evening hatches in summer; midday in winter.",
      "<strong>Regulations:</strong> Middle Deschutes regulations vary by section and season. <strong>Always verify current ODFW Central Zone rules before fishing</strong> — limits, bait restrictions, and seasonal closures change.",
      "<strong>Note:</strong> Steelhead Falls is also a popular swimming spot in summer; fishing pressure is lower in the morning before swimmers arrive.",
    ],
    safety: false,
    query: 'Steelhead Falls Trailhead Oregon',
  },

  // ── REGIONAL FISHING (worth a drive) ────────────────────────────
  {
    mode: 'patch', slug: 'crooked-river-fishing',
    title: 'Trout fishing on the Lower Crooked River',
    category: 'active',
    distance: '45 min east',
    para: "The Lower Crooked River below Bowman Dam (Prineville) is open to fishing year-round and holds a self-sustaining population of wild redband rainbow trout plus mountain whitefish. Tailwater flows from the dam keep the river fishable through every season. Excess hatchery steelhead are released into this stretch and are sometimes caught.",
    tips: [
      "<strong>Species:</strong> Wild redband rainbow trout, mountain whitefish, occasional released steelhead. Bull trout possible (passage now exists at Opal Springs).",
      "<strong>Regulations (verify ODFW current rules):</strong> All rainbow trout over 20 inches must be released unharmed. Bull trout must be released. Tagged steelhead carry green or orange dorsal tags — report catch to Bend ODFW (541) 388-6363 or Prineville ODFW (541) 447-5111.",
      "<strong>Flies:</strong> Pheasant tail nymphs, copper johns, BWO and PMD mayflies (small sizes), midges through winter, dries during caddis hatches.",
      "<strong>Spinners:</strong> Standard small spinners work for conventional anglers (Panther Martin, Rooster Tail, Mepps).",
      "<strong>Best times:</strong> Dawn and last 90 min of light. Year-round fishery; trout most active spring + fall.",
      "<strong>Access:</strong> Drive to Prineville, then up Ochoco Reservoir / Crooked River Hwy toward Bowman Dam. Multiple BLM and Forest Service pull-offs and small campgrounds along the river.",
      "<strong>License:</strong> Oregon fishing license required. Always check the current ODFW Sport Fishing Regulations before fishing — rules change.",
    ],
    safety: true,
    query: 'Lower Crooked River Bowman Dam Prineville Oregon',
  },
  {
    mode: 'patch', slug: 'deschutes-flyfishing',
    title: 'Fly fish the Lower Deschutes (Maupin)',
    category: 'active',
    distance: '90 min north',
    para: "The Lower Deschutes around Maupin is one of the Pacific Northwest's iconic fly-fishing rivers — wild redband trout year-round, returning summer steelhead, and the famous salmonfly hatch in late spring. Wadeable in many spots; drift boats open up the deeper canyon water.",
    tips: [
      "<strong>Species:</strong> Wild redband rainbow trout, summer steelhead (typically June-October), bull trout (catch & release).",
      "<strong>Trout flies:</strong> Salmonflies (late May-June), golden stones, PMDs, caddis, October caddis in fall, streamers.",
      "<strong>Steelhead:</strong> Swing flies (e.g. purple peril, green-butt skunk), indicator nymph rigs, eggs in fall.",
      "<strong>Guide services:</strong> Many outfitters operate out of Maupin offering half- and full-day drift-boat trips. Book ahead during salmonfly + steelhead seasons.",
      "<strong>Regulations:</strong> Oregon license required. Catch & release for native rainbows on most sections; barbless hooks; steelhead requires a Columbia River Basin Endorsement. <strong>Always verify current ODFW regulations before fishing.</strong>",
    ],
    safety: true,
    query: 'Maupin Oregon Lower Deschutes',
  },
  {
    mode: 'insert', slug: 'metolius-river-flyfishing',
    title: 'Fly fish the Metolius near Camp Sherman',
    category: 'active',
    distance: '50 min west',
    para: "Crystal-clear spring creek that flows out of the ground near Camp Sherman at near-full strength — never warm, never high, never low. Holds wild rainbow, brown, and threatened bull trout. The entire river is catch-and-release, and from Bridge 99 upstream is restricted to fly angling only with barbless hooks. Technical fishing on educated trout in glass-clear water — one of the most demanding rivers in Oregon and one of the most beautiful.",
    tips: [
      "<strong>Species:</strong> Wild redband rainbow, brown trout, threatened bull trout (must be released — federally protected).",
      "<strong>Regulations (verify ODFW):</strong> Catch & release entire river. Fly-only with barbless hooks above Bridge 99. Closed to all fishing above Allingham Bridge from November to late May to protect spawning trout.",
      "<strong>Flies:</strong> Small mayflies (PMDs, BWOs in tiny sizes), green drakes in June, October caddis in fall, technical nymph rigs.",
      "<strong>Why it's hard:</strong> Crystal-clear water + educated wild fish + steady flows = drag-free drifts on 6X tippet.",
      "<strong>Best times:</strong> Hatches mid-day to evening, May through October. Year-round flow.",
      "<strong>Access:</strong> Multiple Forest Service campgrounds + pull-offs along the river road from Camp Sherman north toward Bridge 99.",
    ],
    safety: false,
    query: 'Camp Sherman Oregon Metolius River',
  },
  {
    mode: 'insert', slug: 'cascade-lakes-flyfishing',
    title: 'Fly fish the Cascade Lakes (Sparks, Hosmer, Crane Prairie)',
    category: 'active',
    distance: '90 min west',
    para: "A handful of high-elevation lakes along the Cascade Lakes Scenic Byway with totally different fishing characters. Hosmer is a classic stillwater, fly-only, with cruising rainbows. Sparks is shallow and weedy with damselfly hatches. Crane Prairie is bigger water with monster cranebow rainbows that grow to 24+ inches.",
    tips: [
      "<strong>Species:</strong> Rainbow (cranebows on Crane Prairie), brook trout, brown trout (Crane Prairie).",
      "<strong>Best technique:</strong> Float tube or pontoon boat. Indicator nymphing with chironomids, damselfly nymphs.",
      "<strong>Hosmer:</strong> Fly-only, single barbless. Sight-fish to cruising rainbows.",
      "<strong>Sparks:</strong> Damselfly hatches mid-summer; calibaetis mayflies most of season.",
      "<strong>Crane Prairie:</strong> Big water — boats helpful. Cranebows feed on chironomids + leeches.",
      "<strong>Best season:</strong> Late June through September (snow closes byway in winter).",
    ],
    safety: false,
    query: 'Hosmer Lake Oregon',
  },

  // ── WATER SPORTS ────────────────────────────────────────────────
  {
    mode: 'patch', slug: 'cove-palisades-pontoon',
    title: 'Pontoon Lake Billy Chinook from Cove Palisades Marina',
    category: 'families',
    distance: '30 min north',
    para: "Lake Billy Chinook is a flooded canyon at the confluence of three rivers — the Crooked, Deschutes, and Metolius — with sheer basalt walls and three distinct arms to explore. Cove Palisades Marina rents pontoons (and other boats) for the day. Easy boats for families with built-in shade. Each river arm has its own character.",
    tips: [
      "<strong>Reserve early</strong> for July and August — pontoons can fill out weekends in advance.",
      "<strong>Each arm is different:</strong> Crooked is closest and rugged; Deschutes is long with classic canyon views; Metolius is cold and glassy.",
      "<strong>Bring:</strong> Food, drinks, sunscreen, towels — marina has snacks, not full meals.",
      "<strong>Lifejackets are typically included with rental;</strong> tubing/water-ski add-ons available.",
      "<strong>Fishing on Lake Billy Chinook:</strong> Bull trout are present and must be released (protected). Kokanee are popular by trolling (e.g. Wedding Rings, dodgers). Smallmouth bass in the coves on jigs and plastics. <strong>Always check current ODFW regulations.</strong>",
      "<strong>Day-use fee</strong> on top of rental — Cove Palisades is an Oregon State Park.",
    ],
    safety: true,
    query: 'Cove Palisades Marina Oregon',
  },
  {
    mode: 'patch', slug: 'lake-billy-chinook-paddle',
    title: 'Kayak or paddleboard Lake Billy Chinook',
    category: 'active',
    distance: '30 min north',
    para: "Lake Billy Chinook's three arms are kayak and SUP heaven — basalt cliffs on every side, calm water in the morning, occasional eagles overhead. Launch at the Cove Palisades day-use area or rent from the marina. The Crooked River arm is the closest from CRR and the most dramatic for a half-day paddle.",
    tips: [
      "<strong>Mornings are calmest</strong> — afternoon winds pick up reliably by 1-2 PM.",
      "<strong>Sun is brutal on the water</strong> — reapply sunscreen every hour.",
      "<strong>Multiple launch points</strong> — Crooked arm closest from CRR, Deschutes arm has more services.",
      "<strong>Fishing from kayak:</strong> Smallmouth bass on jigs in the coves (summer afternoons), kokanee trolling June-Aug.",
      "<strong>Rentals:</strong> Cove Palisades Marina rents kayaks + SUPs by the hour or half-day.",
    ],
    safety: true,
    query: 'Cove Palisades State Park Oregon',
  },
  {
    mode: 'insert', slug: 'sparks-lake-paddle',
    title: 'Paddle Sparks Lake at sunrise',
    category: 'active',
    distance: '90 min west',
    para: "Sparks Lake is a shallow alpine lake along the Cascade Lakes Byway with reflections of South Sister and Mt Bachelor in glass-flat water at sunrise — one of the most photographed spots in central Oregon. Motors are limited to a 10 mph speed cap and most people paddle. Fly-only fishery for cutthroat (and some lingering brook trout from earlier stocking).",
    tips: [
      "<strong>Boating:</strong> Motors allowed but capped at 10 mph; fishing only when motor is off. Most visitors paddle (kayak, SUP, canoe).",
      "<strong>Best at sunrise</strong> — wind picks up by 9-10 AM most summer days.",
      "<strong>Open seasonally</strong> — Cascade Lakes Byway typically opens late May/Memorial Day; closes with snow in fall.",
      "<strong>Fishing:</strong> Fly fishing only. Featured species is cutthroat trout (introduced); brook trout still present from pre-1997 stocking.",
      "<strong>Rentals:</strong> Pick up paddleboards/kayaks in Bend before driving up — none on the lake.",
      "<strong>Mosquitoes</strong> can be intense June through mid-July. Bring DEET.",
    ],
    safety: false,
    query: 'Sparks Lake Oregon',
  },
  {
    mode: 'insert', slug: 'crane-prairie-boating',
    title: 'Boat + fish Crane Prairie Reservoir',
    category: 'active',
    distance: '90 min west',
    para: "Crane Prairie is the big water on the Cascade Lakes Byway — about 4,940 acres with 24 miles of shoreline at 4,450 feet elevation. Famous for the \"cranebows\" — rainbow trout that regularly hit the 4-5 pound range with double-digit fish caught every year. The lake is shallow (15 ft average) and weedy, perfect for big trout to graze. Several Forest Service campgrounds on the shoreline.",
    tips: [
      "<strong>Species:</strong> Rainbow trout (cranebows — 4-5 lb common, 10+ lb every year, record over 19 lb), kokanee, brown trout, brook trout.",
      "<strong>Tackle (fly):</strong> Chironomids and leeches under indicators are the classic Crane Prairie rig.",
      "<strong>Tackle (conventional):</strong> Trolling Wedding Rings or Triple Teasers for kokanee; small spinners for trout.",
      "<strong>Boat ramps:</strong> Quinn River Day Use, Rock Creek Day Use, and Crane Prairie Resort (rentals + supplies).",
      "<strong>Season:</strong> Approximately April 22 through October 31 (verify current ODFW dates).",
      "<strong>Campgrounds:</strong> Quinn River, Crane Prairie, Rock Creek — Forest Service, mostly first-come.",
      "<strong>Mosquitoes</strong> can be intense early in the season.",
    ],
    safety: false,
    query: 'Crane Prairie Reservoir Oregon',
  },
];

const DETAIL_FIELDS = 'id,websiteUri,googleMapsUri,location';

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
  return { id: p.id, lat: d.location?.latitude ?? p.location.latitude, lng: d.location?.longitude ?? p.location.longitude, websiteUri: d.websiteUri, googleMapsUri: d.googleMapsUri };
}

function buildHtml(e) {
  const tipsHtml = e.tips.map(t => `<li>${t}</li>`).join('\n  ');
  let html = `<p>${e.para}</p>\n<h3>Good to know</h3>\n<ul>\n  ${tipsHtml}\n</ul>`;
  if (e.safety) html += '\n' + SAFETY_NOTE;
  return html;
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  for (const e of ENTRIES) {
    const place = await getPlaceByQuery(e.query);
    if (!place) { console.log(`  ⚠ no place for ${e.slug}`); continue; }
    const html = buildHtml(e);
    const externalLink = place.websiteUri || place.googleMapsUri || null;

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
        ...(e.displayOrder ? { display_order: e.displayOrder } : {}),
      };
      console.log(`PATCH ${e.slug.padEnd(32)} @ ${place.lat.toFixed(4)},${place.lng.toFixed(4)}`);
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
        icon: '🎣',
        external_link: externalLink,
        distance_from_park: e.distance,
        is_published: true,
        display_order: e.displayOrder ?? 50,
      };
      console.log(`INSERT ${e.slug.padEnd(31)} @ ${place.lat.toFixed(4)},${place.lng.toFixed(4)}`);
      if (!dryRun) {
        const r = await fetch(`${SB_URL}/rest/v1/things_to_do`, {
          method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(row),
        });
        if (!r.ok) console.log(`  ⚠ INSERT failed: ${r.status} ${await r.text()}`);
      }
    }
    await new Promise(r => setTimeout(r, 120));
  }
  console.log(`\nDone. (${dryRun ? 'dry run — no DB writes' : 'live'})`);
})();
