#!/usr/bin/env node
/**
 * enrich-site-descriptions.mjs — replace the terse one-line site
 * descriptions ("30 Amp Water/Power back-in. Both slides.") with
 * something that reads like a real listing, now that we have actual
 * photos of every site to characterize what each loop looks like.
 *
 * Loop characterizations (drawn from the renamed photos uploaded
 * 2026-04-23):
 *
 *   T-loop  — Walk-in tent sites in a grassy field. Wooden post markers
 *             on the ground, picnic tables on the grass, mature shade
 *             trees scattered through the area. No hookups. Gazebo +
 *             bathhouse a short walk away; canyon rim views west.
 *
 *   A-loop  — Water-electric back-in sites for smaller rigs. Gravel pad
 *             with a power pedestal at the rear; picnic table on its
 *             own astroturf mat. Mature trees frame each site; the
 *             canyon-rim gazebo sits across the green.
 *
 *   B-loop  — 50-amp full-hookup pull-through sites. Smooth asphalt
 *             pad up to 60 ft, dedicated power/water pedestal, picnic
 *             table on adjoining grass. Sage + juniper screens between
 *             sites; sunset framing to the west. Big-rig friendly.
 *
 *   MAGIC   — Special tent site under mature deciduous shade on the
 *             corner of the T loop, named by our regular campers.
 *
 * Each generated description appends a per-site spec line ("32 ft
 * back-in · 30-amp · water + electric") so the listing remains
 * factually grounded. Existing features arrays are preserved.
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
  else if (site.pull_through !== null) parts.push(site.pull_through ? 'pull-through' : 'back-in');
  if (site.amp_service) parts.push(`${site.amp_service}-amp`);
  if (site.site_type === 'pull-through-full' || site.site_type === 'full-hookup') parts.push('full hookups');
  else if (site.site_type === 'water-electric') parts.push('water + electric');
  else if (site.site_type === 'tent') parts.push('tent site');
  return parts.join(' · ');
}

function describeT(site) {
  return (
    "Walk-in tent site in the grassy field on the south end of the park, " +
    "marked by a low wooden post on the ground. Picnic table on the grass, " +
    "mature shade trees scattered between sites, and an unobstructed view of " +
    "the canyon rim at sunset. No hookups — bring a battery and water; the " +
    "gazebo and bathhouse are a short walk."
  );
}

function describeA(site) {
  return (
    "Water + electric back-in site for smaller rigs. Gravel pad with a power/water " +
    "pedestal at the rear; picnic table on its own green astroturf mat beside the " +
    "pad. Mature shade trees frame the site, and the canyon-rim gazebo sits just " +
    "across the open green. Both slide-outs accommodated."
  );
}

function describeB(site) {
  return (
    "50-amp full-hookup pull-through site with a smooth asphalt pad — easy to " +
    "level, easy to back into, easy to leave. Dedicated power and water pedestal " +
    "at the entry edge; picnic table on the adjoining grass strip. Sage and " +
    "juniper screen between sites give a sense of privacy, and the canyon bluff " +
    "and sunset frame to the west. Big-rig friendly to 60 ft, both slides."
  );
}

const SPECIAL = {
  MAGIC:
    "The MAGIC site — a special tent spot tucked beneath mature deciduous trees " +
    "on the corner of the tent loop, named by our regular campers. Soft grass " +
    "under the canopy, plenty of room for a small tent setup, and the most shade " +
    "in the whole tent area."
};

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  // Pull every photographed site — we only enrich rows that have a
  // hero_image_url set (i.e., the 34 sites the owner has photographed).
  const r = await fetch(`${SB_URL}/rest/v1/park_sites?select=site_number,loop,site_type,length_feet,amp_service,pull_through,hero_image_url&hero_image_url=not.is.null`, { headers: sbHeaders });
  const sites = await r.json();
  console.log(`Enriching descriptions for ${sites.length} photographed sites…`);

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
      console.log(`  · skip ${site.site_number} (loop ${site.loop} not characterized)`);
      continue;
    }

    const spec = specLine(site);
    const description = spec ? `${body}\n\n<em>${spec}</em>` : body;

    if (dryRun) { updated++; continue; }

    const u = await fetch(`${SB_URL}/rest/v1/park_sites?site_number=eq.${encodeURIComponent(site.site_number)}`, {
      method: 'PATCH', headers: { ...sbHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    if (u.ok) { updated++; console.log(`  ✓ ${site.site_number}`); }
    else console.log(`  ⚠ ${site.site_number}: ${u.status} ${await u.text()}`);
  }

  console.log(`\n${updated} updated, ${skipped} skipped.${dryRun ? ' (dry run)' : ''}`);
})();
