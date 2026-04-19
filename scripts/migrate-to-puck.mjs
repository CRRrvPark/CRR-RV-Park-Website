#!/usr/bin/env node
/**
 * migrate-to-puck.mjs — converts existing section/block content into Puck JSON.
 *
 * For each page in the database:
 *   1. Load all sections + content_blocks
 *   2. Map each section to a Puck component with the right props
 *   3. Write the JSON to pages.page_builder_data
 *   4. Set use_page_builder = true
 *   5. Create a 'migration' version snapshot
 *
 * Safe to run multiple times — it overwrites page_builder_data each time.
 *
 * Usage:
 *   node scripts/migrate-to-puck.mjs            # migrate all pages
 *   node scripts/migrate-to-puck.mjs index      # migrate just the home page
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const targetSlug = process.argv[2] || null;

// ─── Section type → Puck component name mapping ───

const SECTION_TO_PUCK = {
  hero:          'HeroSection',
  trust_bar:     'TrustBarSection',
  two_col:       'TwoColumnSection',
  interlude:     'InterludeSection',
  card_grid:     'CardGridSection',
  amenity_grid:  'AmenityGridSection',
  explore_grid:  'ExploreGridSection',
  site_cards:    'SiteCardsSection',
  reviews:       'ReviewsSection',
  cta_banner:    'CtaBannerSection',
  text_block:    'TextBlock',
  events_widget: 'EventsWidgetSection',
  reserve_form:  'ReserveFormSection',
  rates_table:   'RatesTableSection',
  feature_list:  'FeatureListSection',
};

// ─── Block key → Puck prop name mapping per section type ───

function mapBlocksToProps(sectionType, blocks) {
  const b = {};
  for (const block of blocks) {
    b[block.key] = block;
  }

  const text = (key, fallback = '') => b[key]?.value_text ?? fallback;
  const html = (key, fallback = '') => b[key]?.value_html ?? b[key]?.value_text ?? fallback;
  const json = (key, fallback = '[]') => {
    const v = b[key]?.value_json;
    return typeof v === 'string' ? v : JSON.stringify(v ?? JSON.parse(fallback));
  };
  const num  = (key, fallback = 0) => b[key]?.value_number ?? fallback;
  const bool = (key, fallback = false) => b[key]?.value_boolean ?? fallback;
  const img  = (key) => b[key]?.value_image_url ?? '';
  const imgAlt = (key) => b[key]?.value_image_alt ?? '';

  switch (sectionType) {
    case 'hero':
      return {
        eyebrow: text('eyebrow'),
        headlineLine1: text('headline_line1'),
        headlineLine2Italic: text('headline_line2_italic'),
        subtitle: html('subtitle'),
        ctaPrimaryLabel: text('cta_primary_label'),
        ctaPrimaryUrl: text('cta_primary_url'),
        ctaSecondaryLabel: text('cta_secondary_label'),
        ctaSecondaryUrl: text('cta_secondary_url'),
        backgroundImageUrl: img('background_image'),
      };

    case 'trust_bar':
      return {
        items: json('items', '[]'),
      };

    case 'two_col':
      return {
        label: text('label'),
        headline: text('headline'),
        headlineItalic: text('headline_italic'),
        body: html('body'),
        featureList: json('feature_list', '[]'),
        image: img('image'),
        imageAlt: imgAlt('image'),
        imageCaption: text('image_caption'),
        imagePosition: bool('image_left') ? 'left' : 'right',
        ctaLabel: text('cta_label'),
        ctaUrl: text('cta_url'),
      };

    case 'interlude':
      return {
        eyebrow: text('eyebrow'),
        headline: html('headline'),
        body: html('body'),
        credit: text('credit'),
        backgroundImageUrl: img('background_image'),
        ctaLabel: text('cta_label'),
        ctaUrl: text('cta_url'),
      };

    case 'card_grid':
    case 'amenity_grid':
      return {
        label: text('label'),
        headline: text('headline'),
        headlineItalic: text('headline_italic'),
        cards: json('cards', '[]'),
      };

    case 'site_cards':
      return {
        label: text('label'),
        headline: text('headline'),
        headlineItalic: text('headline_italic'),
        intro: html('intro'),
        cards: json('cards', '[]'),
      };

    case 'explore_grid':
      return {
        label: text('label'),
        headline: text('headline'),
        headlineItalic: text('headline_italic'),
        intro: html('intro'),
        cards: json('cards', '[]'),
      };

    case 'reviews':
      return {
        label: text('label'),
        headline: text('headline'),
        headlineItalic: text('headline_italic'),
        rating: text('rating', '5.0'),
        reviewsLink: text('reviews_link'),
        reviews: json('reviews', '[]'),
      };

    case 'cta_banner':
      return {
        headline: text('headline'),
        body: html('body'),
        ctaLabel: text('cta_label'),
        ctaUrl: text('cta_url'),
        darkBackground: bool('dark_background', true) ? 'true' : 'false',
      };

    case 'text_block':
      return {
        label: text('label'),
        headline: text('headline'),
        body: html('body'),
        alignment: 'left',
        maxWidth: 'medium',
      };

    case 'events_widget':
      return {
        heading: text('heading', 'Upcoming Events'),
        limit: num('limit', 5),
        showLinkToAll: bool('show_link_to_all', true) ? 'yes' : 'no',
      };

    case 'reserve_form':
      return {
        label: text('label'),
        headline: text('headline'),
        headlineItalic: text('headline_italic'),
        body: html('body'),
        formName: text('form_name'),
      };

    case 'rates_table':
      return {
        label: text('label'),
        headline: text('headline'),
        rows: json('rows', '[]'),
      };

    case 'feature_list':
      return {
        label: text('label'),
        headline: text('headline'),
        features: json('features', '[]'),
      };

    default:
      console.warn(`  ⚠ Unknown section type: ${sectionType} — skipping`);
      return null;
  }
}

// ─── Main ───

async function migratePage(page) {
  console.log(`\n📄 Migrating: ${page.slug} (${page.title})`);

  // Load sections with blocks
  const { data: sections, error } = await sb
    .from('sections')
    .select('*, content_blocks(*)')
    .eq('page_id', page.id)
    .eq('is_visible', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error(`  ✗ Failed to load sections: ${error.message}`);
    return false;
  }

  if (!sections || sections.length === 0) {
    console.log('  ⊘ No visible sections — skipping');
    return false;
  }

  // Build Puck content array
  const content = [];
  let idx = 0;
  for (const section of sections) {
    const puckType = SECTION_TO_PUCK[section.type];
    if (!puckType) {
      console.warn(`  ⚠ No Puck mapping for section type "${section.type}" (key: ${section.key}) — skipped`);
      continue;
    }

    const props = mapBlocksToProps(section.type, section.content_blocks || []);
    if (!props) continue;

    content.push({
      type: puckType,
      props: {
        id: `${puckType}-${idx}`,
        ...props,
      },
    });
    idx++;
    console.log(`  ✓ ${section.display_order} ${section.type} → ${puckType} (${(section.content_blocks || []).length} blocks)`);
  }

  const puckData = {
    content,
    root: { props: { title: page.title } },
    zones: {},
  };

  // Write to database
  const { error: updateErr } = await sb
    .from('pages')
    .update({
      page_builder_data: puckData,
      use_page_builder: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', page.id);

  if (updateErr) {
    console.error(`  ✗ Failed to write page_builder_data: ${updateErr.message}`);
    return false;
  }

  // Create version snapshot
  const jsonStr = JSON.stringify(puckData);
  const { error: verErr } = await sb.from('page_versions').insert({
    page_id: page.id,
    data: puckData,
    reason: 'migration',
    label: `Migrated from legacy sections`,
    byte_size: Buffer.byteLength(jsonStr, 'utf8'),
  });
  if (verErr) {
    console.warn(`  ⚠ Version snapshot failed (non-fatal): ${verErr.message}`);
  }

  console.log(`  ✓ Wrote ${content.length} components (${(jsonStr.length / 1024).toFixed(1)} KB)`);
  return true;
}

async function main() {
  console.log('🔄 Puck Migration — converting sections/blocks → Puck JSON\n');

  let query = sb.from('pages').select('id, slug, title').order('display_order');
  if (targetSlug) query = query.eq('slug', targetSlug);

  const { data: pages, error } = await query;
  if (error || !pages) {
    console.error('Failed to load pages:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${pages.length} page(s) to migrate.`);

  let ok = 0, fail = 0, skip = 0;
  for (const page of pages) {
    const result = await migratePage(page);
    if (result === true) ok++;
    else if (result === false) skip++;
    else fail++;
  }

  console.log(`\n✅ Done. Migrated: ${ok}, Skipped: ${skip}, Failed: ${fail}`);
  console.log('\nNext steps:');
  console.log('  1. Open /admin/builder/index to verify the home page loaded correctly');
  console.log('  2. Rebuild + deploy to Netlify');
  console.log('  3. Visit the live site to confirm PuckRenderer produces the right output');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
