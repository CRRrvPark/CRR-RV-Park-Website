#!/usr/bin/env node
/**
 * bootstrap-park-map.mjs — one-shot migration to seed the park_maps row.
 *
 * Reads the current map image URL from the existing `__park_map_config`
 * pseudo-page (where the admin's been storing it as
 * `map_image_url=<url>` inside meta_description) and inserts it as an
 * active park_maps row.
 *
 * If park_maps already has an active row, skip. Idempotent.
 *
 * Natural width/height are unknown without fetching the image and
 * probing it — we leave them at 1600x1200 defaults since the SVG
 * overlay uses a normalised viewBox anyway and natural dimensions are
 * only used by the admin editor (Phase 3) for click-coord math. The
 * upload UI in Phase 3 will update them correctly.
 *
 * Usage:
 *   node scripts/bootstrap-park-map.mjs           # DRY-RUN
 *   node scripts/bootstrap-park-map.mjs --apply   # write to DB
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('');

  // Skip if park_maps already has an active row
  const { data: existing } = await sb
    .from('park_maps').select('id, slug, image_url').eq('is_active', true);
  if (existing && existing.length > 0) {
    console.log('park_maps already has an active row — nothing to do:');
    for (const r of existing) console.log(`  · ${r.slug} → ${r.image_url}`);
    return;
  }

  // Read the legacy URL from __park_map_config
  const { data: cfg } = await sb
    .from('pages').select('meta_description').eq('slug', '__park_map_config').maybeSingle();
  const raw = cfg?.meta_description?.trim() || '';
  const match = raw.match(/^map_image_url=(.+)$/);
  if (!match) {
    console.log(`No legacy map image URL found in __park_map_config (meta_description: ${JSON.stringify(raw)}).`);
    console.log('Nothing to bootstrap. Admin will upload via the new editor in Phase 3.');
    return;
  }

  const imageUrl = match[1].trim();
  const row = {
    slug: 'default',
    title: 'Crooked River Ranch — Park Map',
    image_url: imageUrl,
    natural_width: 1600,
    natural_height: 1200,
    is_active: true,
    priority: 0,
    notes: 'Bootstrapped from legacy __park_map_config.meta_description. Natural dimensions are defaults; will be updated when the admin editor re-uploads.',
  };

  console.log('Would insert active park_maps row:');
  console.log(`  slug: ${row.slug}`);
  console.log(`  image_url: ${row.image_url}`);
  console.log(`  natural: ${row.natural_width}×${row.natural_height} (placeholder — editor will correct)`);
  console.log(`  is_active: true`);

  if (!apply) {
    console.log('');
    console.log('(Dry-run. Pass --apply to insert.)');
    return;
  }

  const { data: inserted, error } = await sb.from('park_maps').insert(row).select('id,slug').single();
  if (error) { console.error('✗', error.message); process.exit(1); }
  console.log(`\n✓ inserted park_maps row ${inserted.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
