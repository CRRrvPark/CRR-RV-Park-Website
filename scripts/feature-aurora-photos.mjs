#!/usr/bin/env node
/**
 * feature-aurora-photos.mjs — make the home page's "Dark Skies" interlude
 * feature the three real guest aurora photos as a proper photo band.
 *
 * Background: an earlier pass put the aurora shots into a small thumbnail
 * gallery floated *over* the section's nebula hero image. That read as
 * cramped decoration. This script reworks the same InterludeSection so the
 * photographs are the feature: a calm night-sky backdrop, the poetic copy
 * on top, and the three aurora photos shown large in their own grid below
 * (each opens full-size in the site lightbox). The renderer drops the hero
 * background image automatically whenever a gallery is present, so the
 * photos never sit behind a darkened overlay again.
 *
 * Idempotent. Run `node scripts/feature-aurora-photos.mjs --dry-run` first
 * to preview, then without the flag to write.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const text = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  return text.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).reduce((a, l) => {
    const i = l.indexOf('=');
    if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    return a;
  }, {});
}

const env = loadEnv();
const SB_URL = env.PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

const EYEBROW = 'Dark Skies';
const HEADLINE = "The canyon by day<br>is dramatic. At night,<br>it's <em>something else.</em>";
const BODY =
  'On the nights the aurora reaches this far south, the canyon rim has a front-row seat. ' +
  'A guest stepped out of their RV and caught these — the northern lights over the park, ' +
  'no light pollution in the frame. Just sky.';
const CREDIT = 'Northern lights over the park — photographed by guest Chris Olson';
const GALLERY = [
  { image: '/images/aurora.jpg', alt: 'An RV beneath green and magenta northern lights at Crooked River Ranch RV Park' },
  { image: '/images/aurora_junipers.jpg', alt: 'Aurora glowing teal and purple behind lit juniper trees at the park' },
  { image: '/images/aurora_rim.jpg', alt: 'Purple aurora over the canyon rim with distant valley lights' },
];

// Identify the Dark Skies interlude among possibly-several InterludeSections.
function isDarkSkiesInterlude(item) {
  if (!item || item.type !== 'InterludeSection' || !item.props) return false;
  const id = String(item.props.id || '').toLowerCase();
  const eyebrow = String(item.props.eyebrow || '').toLowerCase();
  const bg = String(item.props.backgroundImageUrl || '').toLowerCase();
  const hay = `${id} ${eyebrow} ${bg}`;
  return /star|dark|night|nebula|aurora/.test(hay);
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  const r = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.index&select=page_builder_data`, { headers: sbHeaders });
  const [page] = await r.json();
  if (!page || !page.page_builder_data) {
    console.error('Home page has no page_builder_data — nothing to update.');
    process.exit(1);
  }
  const pb = page.page_builder_data;
  if (!Array.isArray(pb.content)) {
    console.error('page_builder_data.content is not an array — aborting.');
    process.exit(1);
  }

  const interludes = pb.content.filter((b) => b?.type === 'InterludeSection');
  let targets = pb.content.filter(isDarkSkiesInterlude);
  // Fallback: if nothing matched by keyword but there's exactly one
  // interlude on the page, it's the one we mean.
  if (targets.length === 0 && interludes.length === 1) targets = interludes;

  if (targets.length === 0) {
    console.error(`No Dark Skies InterludeSection found (page has ${interludes.length} interlude section(s)). Aborting.`);
    process.exit(1);
  }

  for (const item of targets) {
    const p = item.props;
    console.log(`Updating InterludeSection id=${p.id || '(none)'}:`);
    console.log(`  backgroundImageUrl '${p.backgroundImageUrl || ''}' → '' (photos become the visual)`);
    console.log(`  gallery → ${GALLERY.length} aurora photo(s)`);
    p.eyebrow = EYEBROW;
    p.headline = HEADLINE;
    p.body = BODY;
    p.credit = CREDIT;
    p.gallery = GALLERY;
    // Drop the hero background + its lightbox toggle — the renderer paints a
    // calm night-sky gradient whenever a gallery is present.
    p.backgroundImageUrl = '';
    p.bgLightbox = false;
  }

  if (dryRun) {
    console.log('\n(dry run — no write)');
    return;
  }

  const u = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.index`, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify({ page_builder_data: pb, use_page_builder: true, updated_at: new Date().toISOString() }),
  });
  console.log(u.ok ? 'Saved.' : `⚠ DB write failed: ${u.status} ${await u.text()}`);
})();
