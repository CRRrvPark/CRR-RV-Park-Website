#!/usr/bin/env node
/**
 * fix-amenities-page.mjs — three fixes on the /amenities page:
 *
 * 1. Delete the "Park Layout" HtmlEmbed (amenities-park-map). Park
 *    Map now lives at /park-map and gets its own top-level nav link
 *    — no need to embed a static JPG of the map here.
 *
 * 2. Replace amenities-dining's image (canyon_sunset.jpg) with an
 *    actual food/community Unsplash photo. Sunset over the canyon
 *    has nothing to do with "Food, drinks, and community".
 *
 * 3. Clear the explicit imageWidth/imageHeight on every TwoColumnSection
 *    on the page. Those forced dimensions were the cause of the
 *    "cropped image that shows nothing" complaint — the renderer
 *    stretches the image to those exact pixel sizes regardless of
 *    natural aspect ratio. Letting the browser pick the height from
 *    the natural ratio keeps the whole image visible.
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
const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

// Unsplash dining/community shot — beer flight + light over a wood table.
// CDN URL is stable and free. (Same approach as fix-area-guide-photos.)
const DINING_IMAGE = 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1400&q=80&auto=format&fit=crop';

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const r = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.amenities&select=page_builder_data`, { headers: sbHeaders });
  const [page] = await r.json();
  const pb = page.page_builder_data;

  const beforeLen = pb.content.length;

  // 1. Drop the embedded park-map section.
  pb.content = pb.content.filter(b => b.props?.id !== 'amenities-park-map');
  const removed = beforeLen - pb.content.length;
  console.log(`Removed ${removed} HtmlEmbed (amenities-park-map).`);

  // 2 + 3. Walk all TwoColumnSection blocks; replace dining image; clear forced dims.
  for (const b of pb.content) {
    if (b.type !== 'TwoColumnSection') continue;
    const id = b.props?.id;
    if (id === 'amenities-dining') {
      console.log(`amenities-dining: image '${b.props.image}' → Unsplash food/community shot`);
      b.props.image = DINING_IMAGE;
    }
    if (b.props?.imageWidth || b.props?.imageHeight) {
      console.log(`${id}: clearing imageWidth=${b.props.imageWidth} imageHeight=${b.props.imageHeight} → natural ratio`);
      b.props.imageWidth = 0;
      b.props.imageHeight = 0;
    }
  }

  if (dryRun) { console.log('\n(dry run)'); return; }
  const u = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.amenities`, {
    method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ page_builder_data: pb }),
  });
  console.log(u.ok ? 'Saved.' : `⚠ DB write failed: ${u.status} ${await u.text()}`);
})();
