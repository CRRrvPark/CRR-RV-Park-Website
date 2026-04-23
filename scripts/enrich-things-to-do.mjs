#!/usr/bin/env node
/**
 * enrich-things-to-do.mjs — give every mappable things_to_do row a
 * substantive description, "good to know" tips, distance from the
 * park, and (where Places has it) an external link + editorial
 * summary appended.
 *
 * Goal: turn a list of titles into something a guest actually wants
 * to read. Each row's `description` becomes 2-4 sentences of context
 * + a short tips list rendered as HTML on /things-to-do/[slug].
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

// ── Curated content per slug ────────────────────────────────────────
// Each row: paragraph of description, 2-4 tips, distance label.
// `query` (when set) is used to look up Place Details for editorial
// summary + external website. Without `query` we skip the API call.
const CURATED = {
  // ── Existing (now with coords) ──
  'lava-river-cave': {
    distance: '40 min south',
    para: "A mile-long lava tube formed by a Newberry Volcano eruption ~80,000 years ago. You walk into the earth on a paved-and-then-rough path, and it's pitch-black inside — the cave has its own ecosystem with year-round cold. Real explorer-feel with no special skills required.",
    tips: ["Bring two flashlights per person — phone lights aren't enough.", "Wear warm layers; cave is 42°F year-round.", "$5 day-use fee. Lantern rental at the entrance ($5).", "Open mid-May through mid-October."],
    query: 'Lava River Cave Bend Oregon',
  },
  'crescent-moon-alpacas': {
    distance: '5 min',
    para: "Working alpaca ranch right outside Terrebonne. Walk among the herd, learn how their fiber gets processed, and shop the on-site store stocked with alpaca yarn, hats, gloves, and ranch-made goods. Owner-operated and very welcoming to families.",
    tips: ["Free to visit; donations welcome.", "Best mornings — alpacas are most active before noon.", "Open daily but call ahead to confirm hours seasonally."],
    query: 'Crescent Moon Ranch Terrebonne Oregon',
  },
  'smith-rock-river-family': {
    distance: '15 min',
    para: "The flat, family-friendly trail along the Crooked River at the base of Smith Rock. You'll see climbers on the walls overhead, kingfishers and herons in the willows, and the iconic Monkey Face spire. Strollers can manage most of it; kids love the river access points.",
    tips: ["$5/day parking at Smith Rock — arrive before 9 AM weekends.", "Public restrooms at the trailhead.", "Stay back from cliff edges; no swimming below Asterisk Pass."],
    query: 'Smith Rock State Park Oregon',
  },
  'richardsons-rock-ranch': {
    distance: '45 min north',
    para: "A working rockhound dig site near Madras famous for thundereggs (geode-like rocks with crystal interiors). Rent tools, dig in their stockpiles, and pay by the pound. They cut and polish on-site if you want a finished piece. Pure kid magic for the right kid.",
    tips: ["Bring sturdy shoes and gloves; sun + dust are real.", "Wash your finds — what looks plain often hides crystals inside when cracked open.", "Closed Tuesdays; cash works best."],
    query: 'Richardson Rock Ranch Madras Oregon',
  },
  'steelhead-swim': {
    distance: '10 min',
    para: "The deep swimming holes just past Steelhead Falls — the area's go-to summer swim spot. Cold mountain water (high 50s even in August) but worth the shock. Easy 0.5-mile walk in from the trailhead.",
    tips: ["Best mid-July to mid-September when water is warmest.", "Cliff jumping happens here — check depths carefully if you participate.", "Bring water shoes; the bank is rocky."],
    query: 'Steelhead Falls Trailhead Oregon',
  },
  'cove-palisades-pontoon': {
    distance: '30 min',
    para: "Lake Billy Chinook is a flooded canyon between three rivers (Crooked, Deschutes, Metolius), and Cove Palisades Marina rents pontoons by the half-day or full-day. Spend the afternoon floating between basalt cliffs with the boys at the helm.",
    tips: ["Reserve in advance for July and August.", "Lifejackets included; bring food + drinks.", "Marina also rents kayaks and SUPs if a pontoon is overkill."],
    query: 'Cove Palisades Marina Oregon',
  },
  'high-desert-museum': {
    distance: '50 min',
    para: "More than a museum — it's an indoor-outdoor exploration of the Oregon desert with live animals (otters, raptors, reptiles), a recreated frontier town, native cultural exhibits, and rotating art shows. Easily a half-day with kids; adults stay engaged too.",
    tips: ["Allow 3-4 hours minimum for the full visit.", "Members of AAM-reciprocal museums get free entry.", "Café on-site; outdoor exhibits are stroller-friendly."],
    query: 'High Desert Museum Bend Oregon',
  },
  'steelhead-falls-hike': {
    distance: '10 min',
    para: "Easy 2-mile out-and-back to the falls — gentle terrain, kid- and dog-friendly, and one of the area's most popular short hikes (4.7★, 1,600+ AllTrails reviews). Falls are modest height but dramatic against the canyon wall.",
    tips: ["Free trailhead parking — small lot, fills on weekends.", "Dogs welcome on leash.", "Best March-November; ice on the canyon wall in winter."],
    query: 'Steelhead Falls Trailhead Oregon',
  },
  'misery-ridge-hike': {
    distance: '15 min',
    para: "The classic Smith Rock loop. Steep switchbacks up the ridge (the \"misery\" — 1,000+ ft gain in under a mile), then panoramic views over Monkey Face spire, then a knee-friendly descent and flat river walk back. The signature Smith Rock experience.",
    tips: ["Park before 8 AM on weekends — lot fills fast.", "Sturdy shoes; loose gravel on the descent.", "No water fountains on trail; bring 2L+ in summer."],
    query: 'Smith Rock State Park Oregon',
  },
  'tam-a-lau-hike': {
    distance: '30 min',
    para: "6.6-mile loop at Cove Palisades that climbs to the top of \"the peninsula\" between two arms of Lake Billy Chinook. Ridge views span the Cascades on clear days. Open year-round but very exposed — early starts and lots of water in summer.",
    tips: ["Day-use fee at Cove Palisades.", "Zero shade; bring 2L+ water in summer.", "Dogs welcome on leash."],
    query: 'Tam-a-lau Trail Cove Palisades Oregon',
  },
  'lake-billy-chinook-paddle': {
    distance: '30 min',
    para: "Lake Billy Chinook's three arms (Crooked, Deschutes, Metolius) are kayak and SUP heaven — basalt cliffs on every side, calm water in the morning, occasional eagles overhead. Launch at the Cove Palisades day-use area or rent from the marina.",
    tips: ["Mornings are calmest — afternoon winds pick up.", "Sun is brutal on the water; reapply sunscreen.", "Multiple launch points — Crooked River arm is the closest from CRR."],
    query: 'Cove Palisades State Park Oregon',
  },
  'mountain-biking-terrebonne': {
    distance: '15 min',
    para: "Cline Buttes Recreation Area is the local MTB destination — a network of singletrack across high desert ridges with everything from beginner-friendly loops to technical descents. Free, undeveloped, and rarely crowded.",
    tips: ["Free, no permits.", "Best March-June and September-November (avoid summer heat).", "Bring lots of water — no facilities."],
    query: 'Cline Buttes Recreation Area Terrebonne Oregon',
  },
  'climbing-lesson-smith-rock': {
    distance: '15 min',
    para: "Smith Rock is the birthplace of American sport climbing, and several local guides offer beginner lessons that include all gear, a basic safety briefing, and 2-3 hours of supervised climbing on real walls. No experience needed.",
    tips: ["Book ahead — guides fill weekends weeks out.", "Wear comfortable athletic clothes; closed-toe shoes for the approach.", "Cliffside Climbing and First Ascent are the most-recommended outfitters."],
    query: 'Smith Rock State Park Oregon',
  },
  'watch-monkey-face-climbers': {
    distance: '15 min',
    para: "Monkey Face is Smith Rock's iconic 350-foot tower with a face-shaped summit — and you can sit on a viewpoint and watch climbers work routes up it without doing any climbing yourself. Bring binoculars; it's surprisingly hypnotic.",
    tips: ["Best viewpoint is the spur trail off Misery Ridge.", "Mornings have the best light; afternoons get better climbing action.", "Sturdy shoes for the approach."],
    query: 'Monkey Face Smith Rock Oregon',
  },
  'deschutes-dog-public-lands': {
    distance: '40 min',
    para: "The Deschutes National Forest covers 1.6 million acres south and west of CRR, and most of it is open to off-leash dogs (with voice control). Trails range from Tumalo Falls' easy paved path to the Cascade Lakes Wilderness. A dog person's paradise.",
    tips: ["Leash required at trailheads; off-leash with voice control on most trails.", "Always carry water — desert is unforgiving.", "Watch for cheatgrass in summer (bad for dogs' paws and ears)."],
    query: 'Deschutes National Forest Oregon',
  },
  'smith-rock-dog-trails': {
    distance: '15 min',
    para: "Smith Rock allows dogs on most trails (including Misery Ridge and the River Trail) as long as they're on a 6-foot leash. Be ready for sun, rocky terrain, and fellow dogs — it's a popular spot.",
    tips: ["6-foot leash required (no retractable leashes).", "Bring water for your dog; canyon walls hold heat.", "$5 parking fee."],
    query: 'Smith Rock State Park Oregon',
  },
  'bend-brewery-tour': {
    distance: '40 min',
    para: "Bend has 25+ breweries packed into a town of 100K — including the original Deschutes Brewery Public House, Crux Fermentation Project, Boneyard, Bevel, 10 Barrel, Worthy, Bend Brewing, and many more. Walking, biking, and even guided shuttle tours are easy options.",
    tips: ["Bend Brew Bus and Cycle Pub run group tours if you don't want to drive.", "Most brewpubs have substantial food menus — not just bar snacks.", "The official Bend Ale Trail passport (free, online) earns you a Silipint after 10 stops."],
    query: 'Deschutes Brewery Public House Bend Oregon',
  },
  'cascade-lakes-scenic-byway': {
    distance: '50 min to byway start',
    para: "66-mile loop through the Cascades west of Bend, passing ten alpine lakes (Sparks, Devils, Cultus, Lava, Hosmer, Elk, and more) plus pull-offs for Mt Bachelor, Broken Top, and the Three Sisters. Each lake has its own character — Sparks is quiet and reflective, Cultus has a beach, Hosmer is fly-fishing-only.",
    tips: ["Open Memorial Day through October (snow closes the upper byway in winter).", "Allow 4-6 hours for the full loop with stops; bring food and water.", "Limited cell service — download maps offline."],
    query: 'Cascade Lakes Scenic Byway Oregon',
  },
  'christmas-valley-drive': {
    distance: '90 min south',
    para: "An eccentric and beautiful detour into Oregon's Outback. The Christmas Valley area has lava tubes (Derrick Cave), an actual sand dune system, the Crack-in-the-Ground volcanic fissure, and salt flats. Very few people, very weird landscapes.",
    tips: ["Gas up before leaving Bend or LaPine.", "High-clearance vehicle recommended for some sites.", "Bring water and food; very few services."],
    query: 'Christmas Valley Oregon',
  },
  'crater-lake-drive': {
    distance: '2.5 hours south',
    para: "America's deepest lake (1,943 ft) — a sapphire-blue volcanic caldera that has to be seen to be understood. The 33-mile Rim Drive opens late June and offers viewpoints every few miles. Sinnott Memorial overlook is the classic stop.",
    tips: ["Rim Drive only open late June through mid-October.", "Park entrance fee: $30/vehicle (or use America the Beautiful pass).", "Allow a full day from CRR — long drive each way is part of it."],
    query: 'Crater Lake National Park Oregon',
  },
  'newberry-obsidian-flows': {
    distance: '60 min south',
    para: "Newberry National Volcanic Monument is a still-active volcanic complex with two crater lakes (Paulina and East), the Big Obsidian Flow (a 7,000-year-old river of glass), and the Lava Lands Visitor Center. The obsidian flow is one of the most unusual short hikes in Oregon — you walk on volcanic glass.",
    tips: ["$5/day vehicle pass at the Visitor Center.", "Obsidian is sharp — wear closed shoes.", "Caldera road typically opens mid-May through October."],
    query: 'Newberry National Volcanic Monument Oregon',
  },
  'peter-skene-ogden': {
    distance: '20 min north',
    para: "A roadside state wayside on Highway 97 where you can walk out and look down 300 feet into the Crooked River Gorge — the same canyon system that wraps the ranch. Two historic bridges span the gorge (one for car traffic, one a 1926 steel arch closed to vehicles but open to walkers).",
    tips: ["Free; no fees.", "The pedestrian-only Crooked River Bridge is a few hundred feet north.", "Watch for hawks and falcons hunting in the gorge."],
    query: 'Peter Skene Ogden State Scenic Viewpoint Oregon',
  },
  'redmond-antiques': {
    distance: '20 min south',
    para: "Downtown Redmond's antique district has a half-dozen multi-vendor antique malls within walking distance — Western memorabilia, mid-century furniture, vintage tools, books. A weekend afternoon kind of activity.",
    tips: ["Most shops open 10-5; closed Mondays often.", "Free parking on side streets.", "Combine with lunch at one of the downtown restaurants (Brickhouse, Diego's, etc.)."],
    query: 'Downtown Redmond Oregon',
  },
  'terrebonne-depot': {
    distance: '5 min',
    para: "Restored historic train depot in Terrebonne, now a wine bar + small bites + local goods shop. Owners host wine tastings, live music nights, and seasonal events. Walk-distance from the park if you're up for it.",
    tips: ["Hours vary by season — check before heading out.", "Patio is great in shoulder season (May-June, Sept-Oct).", "Wine + small plates more than full dinner."],
    query: 'Terrebonne Depot Terrebonne Oregon',
  },
  'sisters-downtown': {
    distance: '40 min west',
    para: "Sisters is a small Western-themed town on the way into the Cascades — false-front buildings, art galleries, the famous Sisters Quilt Show in July, Sisters Folk Festival in September, and a half-dozen good restaurants. Walkable and pleasant.",
    tips: ["Free street parking; can fill on event weekends.", "Best stops: Sisters Bakery, Hop & Brew, Stitchin' Post (quilt store).", "Allow 2-3 hours for casual exploring."],
    query: 'Sisters Oregon',
  },
  'mt-bachelor-skiing': {
    distance: '60 min west',
    para: "Pacific Northwest's largest ski resort by skiable acres. Family-friendly mountain with terrain for all levels — beginner runs around the base, intermediate cruisers in the middle, expert glades and bowls higher up. Long season (typically late Nov through May).",
    tips: ["Buy tickets online in advance for best prices.", "Lower mountain often has better snow when upper is windblown.", "Sno-park pass required at parking lots ($5/day or season pass)."],
    query: 'Mt Bachelor Ski Resort Oregon',
  },
  'snowshoeing': {
    distance: '60 min west',
    para: "The sno-parks west of Bend (Dutchman Flat, Wanoga, Edison) all maintain free snowshoe trails through old-growth forest. Quiet, easy, and very different from summer hiking. Some sno-parks have warming huts.",
    tips: ["Sno-park permit required ($5/day or season).", "Free snowshoe rentals at the Tumalo Visitor Center on weekends in winter.", "Best snow December through March."],
    query: 'Dutchman Flat Sno-Park Oregon',
  },
  'smith-rock-picnic': {
    distance: '15 min',
    para: "The footbridge over the Crooked River at Smith Rock makes a perfect picnic spot — water below, climbers overhead, rock formations in every direction. Picnic tables are limited; many people just grab a flat rock.",
    tips: ["$5/day parking at Smith Rock.", "No grills — pack a sandwich, not a BBQ.", "Pack out all trash; the park is busy and it adds up."],
    query: 'Smith Rock State Park Oregon',
  },

  // ── New 11 ──
  'cline-falls-viewpoint': {
    distance: '15 min south',
    para: "A small but pretty waterfall on the Deschutes River with picnic tables and a short interpretive walk. The bridge over the river is photogenic at golden hour. Almost always uncrowded.",
    tips: ["Free; no fees.", "Picnic tables on a first-come basis.", "Combine with lunch in nearby Tumalo or Sisters."],
    query: 'Cline Falls State Scenic Viewpoint Oregon',
  },
  'tumalo-falls': {
    distance: '40 min west',
    para: "97-foot waterfall in the Bend foothills with the easiest payoff-per-effort ratio in Central Oregon — a 100-yard paved path from the parking lot to the main viewpoint. Longer trails continue past the falls for full-day options.",
    tips: ["Sno-park permit required December-March; free rest of year.", "Last 3 miles of the access road are gravel but passenger-car friendly.", "Arrive before 10 AM weekends — lot fills."],
    query: 'Tumalo Falls Day Use Area Bend Oregon',
  },
  'black-butte-summit': {
    distance: '50 min west',
    para: "A perfectly conical extinct volcano just outside Sisters with a 4-mile out-and-back trail to a historic 1934 fire lookout at the summit. Views span every Cascade peak from Mt Hood to Mt Bachelor on clear days.",
    tips: ["Free trailhead parking; rough access road (gravel, drivable).", "1,500 ft elevation gain — moderate but steady.", "Best June through October; snow lingers higher into spring."],
    query: 'Black Butte Trailhead Sisters Oregon',
  },
  'painted-hills': {
    distance: '1.5 hours northeast',
    para: "Iconic banded hills at the John Day Fossil Beds — yellow, ochre, red, and black layers stacked from millions of years of volcanic ash and minerals. Several short trails (Painted Hills Overlook, Carroll Rim, Painted Cove) showcase different vantage points.",
    tips: ["Free entry.", "Late afternoon and morning have the best light for photos.", "No services in the immediate area; gas up in Mitchell or Prineville before heading in."],
    query: 'Painted Hills John Day Fossil Beds Oregon',
  },
  'boyd-cave': {
    distance: '50 min south',
    para: "Undeveloped lava tube in the Newberry volcanic system — about 1,800 feet you can walk through. No guide, no fee, no railings. Bring two flashlights per person; if your batteries die, you're in pitch black.",
    tips: ["Free, but rough access road (high clearance helps).", "Bring sturdy shoes; floor is uneven volcanic rock.", "Cave is 42°F year-round — wear layers."],
    query: 'Boyd Cave Bend Oregon',
  },
  'arnold-ice-cave': {
    distance: '40 min south',
    para: "Lava tube near Bend with year-round ice formations — even in summer there's a permanent ice floor. More rugged access than Lava River Cave (no improvements, no rangers), so it feels more like spelunking.",
    tips: ["Bring two flashlights and a helmet if possible.", "Floor is icy and slippery year-round; trekking poles help.", "Some sections require crawling — not for the claustrophobic."],
    query: 'Arnold Ice Cave Bend Oregon',
  },
  'petersen-rock-garden': {
    distance: '15 min south',
    para: "A quirky, hand-built sculpture park assembled by Danish immigrant Rasmus Petersen between 1935 and 1952 from rocks, geodes, and minerals collected within a 100-mile radius. Miniature castles, towers, bridges, and a small museum. Pure roadside-Americana magic, especially for kids.",
    tips: ["Free; donations welcome.", "Open dawn to dusk year-round.", "Peacocks roam the grounds — gentle but noisy."],
    query: 'Petersen Rock Garden Redmond Oregon',
  },
  'pilot-butte': {
    distance: '35 min south',
    para: "A 500-ft cinder cone right inside Bend with a 1-mile loop trail to the summit. From the top: 360° views of every major Cascade peak (Mt Hood to Mt Bachelor) plus all of Bend below. Surprisingly dramatic for a 1-mile hike.",
    tips: ["Free parking and entry.", "Paved road also goes to the summit if hiking isn't an option.", "Sunrise and sunset are spectacular; bring a windbreaker."],
    query: 'Pilot Butte State Scenic Viewpoint Bend Oregon',
  },
  'sun-mountain-fun': {
    distance: '40 min south',
    para: "Bend's family fun center — arcade, mini-golf, bumper boats, go-karts, and laser tag under one roof (and an outdoor area). Reliable kid-win on a hot day, a cold day, or any day a parent needs a break.",
    tips: ["Buy day-pass packages instead of pay-per-ride for better value.", "Birthday party packages are popular — book ahead.", "Snack bar on-site; no outside food."],
    query: 'Sun Mountain Fun Center Bend Oregon',
  },
  'tumalo-state-park': {
    distance: '35 min south',
    para: "Small Deschutes River state park with gentle swim beach, picnic areas, walk-in tent sites, and a paved riverwalk. Less dramatic than Smith Rock but much more relaxing for a half-day with kids.",
    tips: ["Day-use fee ($5/vehicle) or use Oregon State Parks pass.", "Water is cold — high 50s most of summer.", "Cottonwoods provide good shade for the picnic area."],
    query: 'Tumalo State Park Bend Oregon',
  },
  'redmond-expo-center': {
    distance: '20 min south',
    para: "The Deschutes County Fair & Expo Center in Redmond hosts the Deschutes County Fair (early August), plus year-round RV shows, concerts, rodeos, gun shows, dog shows, antique shows, and conventions. Worth checking the calendar before any trip.",
    tips: ["Calendar: deschutesfair.com/expo-events.", "Free parking on most event days.", "Restaurants in downtown Redmond ~5 minutes away."],
    query: 'Deschutes County Fair Expo Center Redmond Oregon',
  },
};

const DETAIL_FIELDS = 'id,websiteUri,editorialSummary,googleMapsUri';

async function getPlaceDetailsByQuery(query) {
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
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
  });
  if (!dr.ok) return null;
  return await dr.json();
}

function buildHtml(c, googleSummary) {
  const tipsHtml = c.tips.map(t => `<li>${t}</li>`).join('');
  let html = `<p>${c.para}</p>\n<h3>Good to know</h3>\n<ul>\n${tipsHtml}\n</ul>`;
  if (googleSummary) {
    html += `\n<p class="text-muted" style="font-size:.85rem;font-style:italic;margin-top:1rem;">Google's editorial: ${googleSummary}</p>`;
  }
  return html;
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const all = await (await fetch(`${SB_URL}/rest/v1/things_to_do?select=slug,title&order=slug`, { headers: sbHeaders })).json();

  let enriched = 0;
  let skipped = 0;
  for (const row of all) {
    const c = CURATED[row.slug];
    if (!c) { skipped++; continue; }

    let externalLink = null, editorial = null;
    if (c.query) {
      const d = await getPlaceDetailsByQuery(c.query);
      if (d) {
        externalLink = d.websiteUri || d.googleMapsUri || null;
        editorial = d.editorialSummary?.text || null;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    const update = {
      description: buildHtml(c, editorial),
      details_html: buildHtml(c, editorial),
      distance_from_park: c.distance,
      external_link: externalLink,
    };

    if (dryRun) {
      console.log(`\n${row.slug}  [${c.distance}]  ${externalLink ? '🔗 ' + externalLink.slice(0, 60) : '(no external link)'}`);
      console.log('  ', c.para.slice(0, 120) + '…');
      enriched++;
      continue;
    }

    const r = await fetch(`${SB_URL}/rest/v1/things_to_do?slug=eq.${encodeURIComponent(row.slug)}`, {
      method: 'PATCH', headers: sbHeaders, body: JSON.stringify(update),
    });
    if (r.ok) enriched++;
    else console.log(`  ⚠ failed for ${row.slug}: ${r.status} ${await r.text()}`);
  }

  console.log(`\nEnriched ${enriched}/${all.length} (${skipped} skipped — on-property or not curated).`);
  if (dryRun) console.log('(dry run — no DB writes)');
})();
