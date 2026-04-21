#!/usr/bin/env node
/**
 * set-reviews-link.mjs — one-shot: write the canonical Google reviews
 * URL into every page's ReviewsSection.reviewsLink field.
 *
 * Why do this vs. just relying on the fallback in PuckRenderer.astro:
 * with the value stored on the DB row, the URL appears in the Visual
 * Editor's right panel (the `reviewsLink` field) — so owners see it,
 * can edit it, and the URL is explicit rather than an invisible default.
 *
 * Stores the URL *trimmed* to just the canonical parameters Google
 * actually needs: `q=` (query slug) and `si=` (base64 place ID). The
 * browser-session params (sxsrf, ved, biw, bih, dpr, ictx, sca_esv)
 * from the raw "copy link" URL are stripped — they were snapshots of
 * the owner's browser state when copying, not necessary for Google to
 * resolve the Knowledge Panel reviews drawer.
 *
 * Idempotent: if a ReviewsSection already has a non-empty reviewsLink
 * that isn't the old placeholder, leave it alone. Only fills in blanks
 * and the obsolete `/maps/place/Crooked+River+Ranch+RV+Park/` default.
 *
 * Usage:
 *   node scripts/set-reviews-link.mjs           # dry-run
 *   node scripts/set-reviews-link.mjs --apply   # write to DB
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const REVIEWS_URL = 'https://www.google.com/search?q=crooked+river+ranch+rv+park&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOaxz-Wa7jb_95ElogqVVpkGrvX3PFXXWIYQiDFelErQ9QQDbJjqpe8ig1hJV3mU4HLSnBpn_GB838KNAuGcAbLVBdoYGwl03XMluXbveXREDWKzs6g%3D%3D';

// Any prior value that matches one of these is considered "not set by
// the owner" and will be overwritten. Anything else is left alone.
const OBSOLETE_DEFAULTS = new Set([
  '',
  'https://www.google.com/maps/place/Crooked+River+Ranch+RV+Park/',
]);

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (write to DB)' : 'DRY-RUN'}`);
  console.log('');

  const { data: pages, error } = await sb
    .from('pages')
    .select('id, slug, page_builder_data');
  if (error) { console.error('! fetch failed:', error.message); process.exit(1); }

  let totalReviewsSections = 0;
  let wouldUpdate = 0;
  const writes = [];

  for (const page of pages) {
    const data = page.page_builder_data;
    if (!data || !Array.isArray(data.content)) continue;
    let anyChange = false;
    const nextContent = data.content.map((item) => {
      if (!item || item.type !== 'ReviewsSection') return item;
      totalReviewsSections++;
      const current = typeof item.props?.reviewsLink === 'string' ? item.props.reviewsLink : '';
      if (!OBSOLETE_DEFAULTS.has(current.trim())) {
        console.log(`  · ${page.slug}: ReviewsSection has custom reviewsLink (${current.slice(0, 60)}…) — keeping`);
        return item;
      }
      console.log(`  + ${page.slug}: writing canonical reviewsLink (was: ${JSON.stringify(current)})`);
      wouldUpdate++;
      anyChange = true;
      return { ...item, props: { ...item.props, reviewsLink: REVIEWS_URL } };
    });
    if (anyChange) writes.push({ id: page.id, slug: page.slug, data: { ...data, content: nextContent } });
  }

  console.log('');
  console.log(`Summary: ${totalReviewsSections} ReviewsSections found, ${wouldUpdate} would be updated`);

  if (!apply) {
    console.log('(Dry-run. Pass --apply to write.)');
    return;
  }

  for (const w of writes) {
    const { error: upErr } = await sb
      .from('pages')
      .update({ page_builder_data: w.data, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    if (upErr) { console.error(`! write failed for ${w.slug}: ${upErr.message}`); continue; }
    console.log(`  ✓ wrote ${w.slug}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
