#!/usr/bin/env node
/**
 * seed-legacy-pages.mjs
 *
 * Upserts the 7 legacy static Astro pages into `pages.page_builder_data` so
 * the Visual Editor at /admin/builder/<slug> can render AND edit them.
 *
 * The corresponding .astro files should be deleted after this runs so the
 * dynamic `[slug].astro` route takes over and serves the DB-backed content.
 *
 * Skipped: `index` (home). The home page already has legacy sections/blocks
 * in the DB via the older section-based schema; overwriting it with an
 * isolated hero would wipe 10 existing sections. Home needs its own pass
 * that reads the sections table and rebuilds page_builder_data faithfully.
 *
 * Requires (from .env):
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/seed-legacy-pages.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

loadDotenv(resolve(ROOT, '.env'));

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const { default: pages } = await import(pathToFileURL(resolve(__dirname, 'legacy-pages-data.mjs')).href);

const SKIP_SLUGS = new Set(['index']); // see header

async function rest(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

async function findPageBySlug(slug) {
  const rows = await rest(`pages?slug=eq.${encodeURIComponent(slug)}&select=id,slug,use_page_builder`, 'GET');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function seedOne(entry) {
  const { slug, title, meta_description, canonical_url, og_image, hero_preload, schemas, page_builder_data } = entry;
  const existing = await findPageBySlug(slug);

  const payload = {
    title,
    meta_description,
    canonical_url,
    og_image,
    hero_preload,
    schemas,
    page_builder_data,
    use_page_builder: true,
  };

  if (existing) {
    await rest(`pages?id=eq.${existing.id}`, 'PATCH', payload);
    return { slug, action: 'updated', hadBuilderAlready: !!existing.use_page_builder };
  }

  // Row missing — insert. display_order defaults to 0; slug uniqueness is enforced.
  await rest('pages', 'POST', { slug, is_published: true, ...payload });
  return { slug, action: 'inserted', hadBuilderAlready: false };
}

function loadDotenv(path) {
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      val = val.replace(/\s+#.*$/, '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env optional
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const toSeed = pages.filter((p) => !SKIP_SLUGS.has(p.slug));
  console.log(`Seeding ${toSeed.length} page(s). Skipping: ${[...SKIP_SLUGS].join(', ')}`);
  console.log('');

  let ok = 0, failed = 0;
  for (const entry of toSeed) {
    try {
      const result = await seedOne(entry);
      const note = result.hadBuilderAlready ? ' (already had page_builder_data — overwritten)' : '';
      console.log(`  ✓ ${result.slug.padEnd(18)} ${result.action}${note}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${entry.slug.padEnd(18)} FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Done. ok: ${ok}, failed: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
