#!/usr/bin/env node
/**
 * add-page-ctas.mjs — one-shot addition of strategically placed CTA
 * banners to /golf-course and /group-sites.
 *
 * Owner feedback 2026-04-20:
 *   • /golf-course: "needs at least 2 more CTA buttons on it"
 *   • /group-sites: "need one more CTA button strategically placed"
 *
 * What this adds:
 *
 *   /golf-course:
 *     - mid-page CTA after the "gorge" two-column section
 *       ("Book your canyon rim golf stay")
 *     - another CTA after the "walking distance" TextBlock
 *       ("Check availability")
 *     (The page already had the "Make it a golf getaway" banner and the
 *      final "Book your canyon rim site" dark banner; now there are 4.)
 *
 *   /group-sites:
 *     - mid-page CTA after the "included" two-column section
 *       ("See group site options")
 *     (The page already had the final "Ready to rally your crew?" dark
 *      banner; now there are 2.)
 *
 * Idempotent: skips pages where the new CTA ids already exist in content.
 *
 * Usage:
 *   node scripts/add-page-ctas.mjs           # dry-run, both pages
 *   node scripts/add-page-ctas.mjs --apply   # write to DB
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const FIREFLY_URL = 'https://app.fireflyreservations.com/signin/AQAAAAAA9T9Yop9j';

// Base prop shape shared by every CtaBannerSection.
function cta({ id, headline, body, ctaLabel, ctaUrl, darkBackground }) {
  return {
    type: 'CtaBannerSection',
    props: {
      id,
      sectionId: '',
      bgColor: '', textColor: '',
      marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, paddingX: 0,
      borderWidth: 0, borderColor: '#d8ccb7', borderRadius: 0, shadow: 'none',
      headline,
      body,
      ctaLabel,
      ctaUrl,
      darkBackground: darkBackground ? 'true' : 'false',
    },
  };
}

/**
 * Insert `insert` into `content` immediately after the first item whose
 * `id` matches `afterId`. Returns { changed, content } — `changed` is
 * false when the anchor wasn't found OR the new id already exists.
 */
function insertAfter(content, afterId, insert) {
  if (content.some((c) => c?.props?.id === insert.props.id)) {
    return { changed: false, content };
  }
  const idx = content.findIndex((c) => c?.props?.id === afterId);
  if (idx === -1) return { changed: false, content };
  const next = [...content.slice(0, idx + 1), insert, ...content.slice(idx + 1)];
  return { changed: true, content: next };
}

const PLANS = {
  'golf-course': [
    {
      afterId: 'golf-course-gorge',
      block: cta({
        id: 'golf-course-mid-cta',
        headline: 'Book your canyon rim golf stay.',
        body: '<p>Full hookups from $62/night · $10 off 18 holes · walk to the first tee in minutes. Open year-round.</p>',
        ctaLabel: 'Reserve Your Site',
        ctaUrl: FIREFLY_URL,
        darkBackground: false,
      }),
    },
    {
      afterId: 'golf-course-walking',
      block: cta({
        id: 'golf-course-availability-cta',
        headline: 'Check availability.',
        body: '<p>Sites book up fastest in summer and on weekends around Smith Rock climbing season. See what\'s open for your dates.</p>',
        ctaLabel: 'See Availability',
        ctaUrl: FIREFLY_URL,
        darkBackground: true,
      }),
    },
  ],
  'group-sites': [
    {
      afterId: 'group-sites-included',
      block: cta({
        id: 'group-sites-mid-cta',
        headline: 'See group site options.',
        body: '<p>Pull-through sites up to 65\', shared amenities, discounted group rates. Check availability for your dates.</p>',
        ctaLabel: 'Check Group Availability',
        ctaUrl: FIREFLY_URL,
        darkBackground: false,
      }),
    },
  ],
};

async function processSlug(slug, plans) {
  const { data: page, error } = await sb
    .from('pages')
    .select('id, slug, page_builder_data')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!page) {
    console.log(`  ? ${slug}: page row not found — skipping`);
    return { changed: false };
  }
  const data = page.page_builder_data;
  if (!data || !Array.isArray(data.content)) {
    console.log(`  ? ${slug}: no page_builder_data.content — skipping`);
    return { changed: false };
  }

  let content = data.content;
  let anyChange = false;
  const addedIds = [];
  const skippedAnchors = [];

  for (const plan of plans) {
    const res = insertAfter(content, plan.afterId, plan.block);
    if (res.changed) {
      content = res.content;
      anyChange = true;
      addedIds.push(plan.block.props.id);
    } else if (content.some((c) => c?.props?.id === plan.block.props.id)) {
      // Already present — idempotent skip.
    } else {
      skippedAnchors.push(plan.afterId);
    }
  }

  console.log(
    `  ${anyChange ? '+' : '.'} ${slug}: ${addedIds.length ? 'added ' + addedIds.join(', ') : 'no insert'}`
      + (skippedAnchors.length ? ` (couldn't anchor to: ${skippedAnchors.join(', ')})` : '')
      + ` — total items: ${content.length}`,
  );

  if (!apply || !anyChange) return { changed: anyChange };

  const next = { ...data, content };
  const { error: upErr } = await sb
    .from('pages')
    .update({ page_builder_data: next, updated_at: new Date().toISOString() })
    .eq('id', page.id);
  if (upErr) throw upErr;
  return { changed: true };
}

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (write to DB)' : 'DRY-RUN'}`);
  console.log('');
  for (const [slug, plans] of Object.entries(PLANS)) {
    await processSlug(slug, plans);
  }
  if (!apply) {
    console.log('');
    console.log('(Dry-run. Pass --apply to write the added CTA sections to the DB.)');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
