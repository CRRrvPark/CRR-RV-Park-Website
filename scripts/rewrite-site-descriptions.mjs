#!/usr/bin/env node
/**
 * rewrite-site-descriptions.mjs — second pass on park-site copy.
 *
 * The first generation (commit 812a292) was factually correct but
 * read like a spec sheet — owner feedback: "uselessly flat. I'd
 * lose bookings for those." Same content here gets rewritten in
 * a warmer, sensory, postcard-style voice modeled on the owner's
 * own example:
 *
 *   "32 foot RV site beneath the canopy of 2 old trees. Relax
 *   in your site just feet away from the golf course. Let the
 *   kids run in the grass, play catch, or walk to the saltwater
 *   swimming pool. As the sun's setting light plays through the
 *   leaves in the evening, breathe in the fresh air and let
 *   life's stress fade to distant memory."
 *
 * The "astroturf" mention from the previous pass is also removed
 * (owner: drop it). Tone goals per loop:
 *
 *   T-loop  Quiet tent camping in a grassy field, mature shade,
 *           canyon-rim sunsets, walks to gazebo and pool.
 *   A-loop  Smaller-rig back-in, easy walk to golf + pool, kids
 *           and dogs in the grass, stress fades with the light.
 *   B-loop  Big-rig pull-through, smooth pad, sage-and-juniper
 *           privacy, sunset framing west, room to stretch out.
 *   MAGIC   Special tent spot under the deepest deciduous shade.
 *
 * Each description ends with a small italic spec line so the
 * factual data is still surfaced for guests who want to confirm
 * length / amp / hookup type at a glance.
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

function specLine(site) {
  const parts = [];
  if (site.length_feet) parts.push(`${site.length_feet} ft ${site.pull_through ? 'pull-through' : 'back-in'}`);
  else if (site.pull_through !== null && site.site_type !== 'tent') parts.push(site.pull_through ? 'pull-through' : 'back-in');
  if (site.amp_service) parts.push(`${site.amp_service}-amp`);
  if (site.site_type === 'pull-through-full' || site.site_type === 'full-hookup') parts.push('full hookups');
  else if (site.site_type === 'water-electric') parts.push('water + electric');
  else if (site.site_type === 'tent') parts.push('tent site, no hookups');
  return parts.join(' · ');
}

// Tent loop — grassy, shaded, quiet, canyon-rim sunsets.
function describeT(site) {
  return (
    "Pitch your tent in CRR's grassy south field — soft turf underfoot, " +
    "shade trees scattered through the loop, and just enough quiet that " +
    "you'll hear the wind shift through the leaves. Set up the camp chairs, " +
    "let the kids run between sites, and walk over to the saltwater pool, the " +
    "gazebo, or the courts whenever you feel like it. As the day winds down, " +
    "the sunset slips slow over the canyon rim to the west and the air cools " +
    "just enough to remind you you're in the high desert. No hookups at the " +
    "site itself, but the park's Wi-Fi reaches the loop — so it's just the " +
    "canopy of the trees, the sky, and everything you came out here to find."
  );
}

// Smaller-rig water+electric back-ins next to golf + pool.
function describeA(site) {
  const lengthBit = site.length_feet
    ? `A ${site.length_feet}-foot back-in site for smaller rigs and travel trailers, `
    : "A back-in site for smaller rigs and travel trailers, ";
  return (
    lengthBit +
    "tucked beneath mature shade trees with the canyon-rim gazebo just across " +
    "the open green. Hook up to power and water, set the picnic table where " +
    "the light's right, and you're a few-minute walk from the saltwater pool, " +
    "the courts, the dog run, and the golf course. Let the kids play catch in " +
    "the grass between sites, watch the long evening light filter through the " +
    "leaves, breathe in the high-desert air, and let the stress of the road " +
    "fade with the falling sun. Both slide-outs accommodated."
  );
}

// Big-rig 50-amp full-hookup pull-throughs.
function describeB(site) {
  const lengthBit = site.length_feet
    ? `${site.length_feet} feet of smooth asphalt pull-through `
    : "A smooth asphalt pull-through ";
  return (
    lengthBit +
    "— long enough for big rigs, easy enough you'll be set up and unwinding " +
    "before the afternoon turns to evening. Sage and juniper screens between " +
    "the sites give you privacy; mature trees frame the view; the canyon bluff " +
    "and the sunset settle in to the west. Step outside the rig and the kids " +
    "are a short walk from the pool and the courts; you're a few minutes from " +
    "the golf course; the gazebo and bathhouses are right around the bend. " +
    "Hook up, level once, breathe in the high-desert air — this is the kind of " +
    "site that makes a long trip feel restful."
  );
}

const SPECIAL = {
  MAGIC:
    "The MAGIC site — our regulars named it. A special tent spot tucked beneath " +
    "the deepest deciduous shade on the corner of the tent loop, with soft grass " +
    "under the canopy and the most cover from the afternoon sun in the whole " +
    "tent area. Quiet, intimate, a little hidden from the rest of the park, and " +
    "just far enough from everything that you'll feel like you found a secret. " +
    "It earns its name."
};

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  const r = await fetch(`${SB_URL}/rest/v1/park_sites?select=site_number,loop,site_type,length_feet,amp_service,pull_through,hero_image_url&hero_image_url=not.is.null`, { headers: sbHeaders });
  const sites = await r.json();
  console.log(`Rewriting descriptions for ${sites.length} photographed sites…`);

  let updated = 0, skipped = 0;
  for (const site of sites) {
    let body;
    if (SPECIAL[site.site_number]) {
      body = SPECIAL[site.site_number];
    } else if (site.loop === 'T') {
      body = describeT(site);
    } else if (site.loop === 'A') {
      body = describeA(site);
    } else if (site.loop === 'B') {
      body = describeB(site);
    } else {
      skipped++;
      continue;
    }

    const spec = specLine(site);
    const description = spec ? `<p>${body}</p>\n<p style="font-size:.85rem;color:var(--muted,#665040);font-style:italic;margin-top:1.1rem;">${spec}</p>` : `<p>${body}</p>`;

    if (dryRun) { updated++; continue; }

    const u = await fetch(`${SB_URL}/rest/v1/park_sites?site_number=eq.${encodeURIComponent(site.site_number)}`, {
      method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ description }),
    });
    if (u.ok) { updated++; }
    else console.log(`  ⚠ ${site.site_number}: ${u.status} ${await u.text()}`);
  }

  console.log(`${updated} updated, ${skipped} skipped.${dryRun ? ' (dry run)' : ''}`);
})();
