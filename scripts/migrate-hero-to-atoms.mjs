#!/usr/bin/env node
/**
 * migrate-hero-to-atoms.mjs — V4 one-shot migration.
 *
 * Walks every page row with `page_builder_data`, finds every HeroSection
 * item, and lifts its legacy flat props (eyebrow, headlineLine1,
 * headlineLine2Italic, subtitle, ctaPrimary{Label,Url},
 * ctaSecondary{Label,Url}) into two Puck zones: `{heroId}:hero-main`
 * (eyebrow + heading + subtitle atoms) and `{heroId}:hero-ctas`
 * (button atoms).
 *
 * By default runs in DRY-RUN mode: prints what would change per slug
 * and verifies that a string-renderer run over the migrated zones
 * produces HTML byte-identical to the current legacy flat-prop output.
 * Pass --apply to write the migrated JSON back to the database.
 *
 * Usage:
 *   node scripts/migrate-hero-to-atoms.mjs             # dry-run, all pages
 *   node scripts/migrate-hero-to-atoms.mjs index       # dry-run, one slug
 *   node scripts/migrate-hero-to-atoms.mjs --apply     # write-back, all
 *   node scripts/migrate-hero-to-atoms.mjs index --apply
 *
 * Safe to re-run: the migrator is idempotent (skips heroes that already
 * have populated zones).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const targetSlug = argv.find((a) => !a.startsWith('--')) || null;

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Migrator (duplicated from src/lib/puck-data-migrate.ts so this script
//    can run without a TS toolchain). Must stay in sync with the TS version.
function buildHeroZones(heroId, heroProps) {
  const eyebrow = typeof heroProps.eyebrow === 'string' ? heroProps.eyebrow.trim() : '';
  const line1 = typeof heroProps.headlineLine1 === 'string' ? heroProps.headlineLine1.trim() : '';
  const line2 = typeof heroProps.headlineLine2Italic === 'string' ? heroProps.headlineLine2Italic.trim() : '';
  const subtitle = typeof heroProps.subtitle === 'string' ? heroProps.subtitle.trim() : '';
  const ctaPrimaryLabel = typeof heroProps.ctaPrimaryLabel === 'string' ? heroProps.ctaPrimaryLabel.trim() : '';
  const ctaPrimaryUrl = typeof heroProps.ctaPrimaryUrl === 'string' ? heroProps.ctaPrimaryUrl : '';
  const ctaSecondaryLabel = typeof heroProps.ctaSecondaryLabel === 'string' ? heroProps.ctaSecondaryLabel.trim() : '';
  const ctaSecondaryUrl = typeof heroProps.ctaSecondaryUrl === 'string' ? heroProps.ctaSecondaryUrl : '';

  const hasAny = !!(eyebrow || line1 || line2 || subtitle || ctaPrimaryLabel || ctaSecondaryLabel);
  if (!hasAny) return null;

  const heroMain = [];
  if (eyebrow) heroMain.push({ type: 'EditableEyebrow', props: { id: `${heroId}-eyebrow`, text: eyebrow, tag: 'div', className: 'hero-eyebrow' } });
  if (line1 || line2) heroMain.push({ type: 'EditableHeading', props: { id: `${heroId}-heading`, text: line1 || '', level: 1, italic: false, line2Italic: line2 || '', className: 'hero-hl' } });
  if (subtitle) heroMain.push({ type: 'EditableRichText', props: { id: `${heroId}-sub`, html: subtitle, className: 'hero-sub' } });

  const heroCtas = [];
  if (ctaPrimaryLabel) heroCtas.push({ type: 'EditableButton', props: { id: `${heroId}-cta-primary`, label: ctaPrimaryLabel, url: ctaPrimaryUrl, variant: 'primary', className: '', openInNewTab: false } });
  if (ctaSecondaryLabel) heroCtas.push({ type: 'EditableButton', props: { id: `${heroId}-cta-secondary`, label: ctaSecondaryLabel, url: ctaSecondaryUrl, variant: 'secondary', className: '', openInNewTab: false } });

  const remainingProps = { ...heroProps };
  for (const key of ['eyebrow', 'headlineLine1', 'headlineLine2Italic', 'subtitle', 'ctaPrimaryLabel', 'ctaPrimaryUrl', 'ctaSecondaryLabel', 'ctaSecondaryUrl']) {
    remainingProps[key] = '';
  }

  return { heroMain, heroCtas, remainingProps };
}

function migrateData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.content)) return { data, changedHeroes: 0 };
  const zonesIn = (data.zones && typeof data.zones === 'object') ? { ...data.zones } : {};
  const zonesOut = { ...zonesIn };
  let changedHeroes = 0;

  const nextContent = data.content.map((item) => {
    if (!item || item.type !== 'HeroSection') return item;
    const heroId = item.props?.id;
    if (!heroId) return item;
    const mainKey = `${heroId}:hero-main`;
    const ctasKey = `${heroId}:hero-ctas`;
    const hasZones = (Array.isArray(zonesIn[mainKey]) && zonesIn[mainKey].length > 0)
      || (Array.isArray(zonesIn[ctasKey]) && zonesIn[ctasKey].length > 0);
    if (hasZones) return item;
    const built = buildHeroZones(heroId, item.props || {});
    if (!built) return item;
    zonesOut[mainKey] = built.heroMain;
    zonesOut[ctasKey] = built.heroCtas;
    changedHeroes++;
    return { ...item, props: built.remainingProps };
  });

  return { data: { ...data, content: nextContent, zones: zonesOut }, changedHeroes };
}

// ── String renderer: produces the hero-content inner HTML for a given
//    hero item. Mirrors PuckRenderer.astro byte-for-byte. Used to prove
//    pre/post migration byte-identity.
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderHeroContentLegacy(p) {
  const out = [];
  if (p.eyebrow) out.push(`<div class="hero-eyebrow">${esc(p.eyebrow)}</div>`);
  out.push(`<h1 class="hero-hl">${esc(p.headlineLine1 || '')}${p.headlineLine2Italic ? `<br /><em>${esc(p.headlineLine2Italic)}</em>` : ''}</h1>`);
  if (p.subtitle) out.push(`<div class="hero-sub">${p.subtitle}</div>`);
  const ctas = [];
  if (p.ctaPrimaryLabel) ctas.push(`<a class="btn-p" href="${esc(p.ctaPrimaryUrl || '#')}">${esc(p.ctaPrimaryLabel)}</a>`);
  if (p.ctaSecondaryLabel) ctas.push(`<a class="btn-g" href="${esc(p.ctaSecondaryUrl || '#')}">${esc(p.ctaSecondaryLabel)}</a>`);
  out.push(`<div class="hero-ctas">${ctas.join('')}</div>`);
  return out.join('');
}

function renderHeroContentZones(mainZone, ctasZone) {
  const out = [];
  for (const atom of mainZone || []) {
    const ap = atom.props || {};
    if (atom.type === 'EditableEyebrow') {
      const tag = (ap.tag === 'span' || ap.tag === 'p') ? ap.tag : 'div';
      const cls = ap.className ? ` class="${esc(ap.className)}"` : '';
      out.push(`<${tag}${cls}>${esc(ap.text || '')}</${tag}>`);
    } else if (atom.type === 'EditableHeading') {
      const lvl = Math.min(Math.max(Number(ap.level) || 2, 1), 6);
      const cls = ap.className ? ` class="${esc(ap.className)}"` : '';
      let body;
      if (ap.line2Italic) body = `${esc(ap.text || '')}<br /><em>${esc(ap.line2Italic)}</em>`;
      else if (ap.italic) body = `<em>${esc(ap.text || '')}</em>`;
      else body = esc(ap.text || '');
      out.push(`<h${lvl}${cls}>${body}</h${lvl}>`);
    } else if (atom.type === 'EditableRichText') {
      const cls = ap.className ? ` class="${esc(ap.className)}"` : '';
      out.push(`<div${cls}>${ap.html || ''}</div>`);
    }
  }
  const ctas = [];
  for (const atom of ctasZone || []) {
    if (atom.type !== 'EditableButton') continue;
    const ap = atom.props || {};
    const variantCls = { primary: 'btn-p', secondary: 'btn-g', ghost: 'btn-o' };
    const cls = ap.variant === 'custom' ? (ap.className || '') : (variantCls[ap.variant] || 'btn-p');
    const tgt = ap.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    ctas.push(`<a class="${esc(cls)}" href="${esc(ap.url || '#')}"${tgt}>${esc(ap.label || '')}</a>`);
  }
  out.push(`<div class="hero-ctas">${ctas.join('')}</div>`);
  return out.join('');
}

async function processPage(row) {
  const beforeData = row.page_builder_data;
  if (!beforeData || !Array.isArray(beforeData.content)) {
    return { slug: row.slug, skipped: 'no content', heroCount: 0 };
  }
  const heroes = beforeData.content.filter((c) => c?.type === 'HeroSection');
  if (heroes.length === 0) return { slug: row.slug, skipped: 'no hero', heroCount: 0 };

  // Compute legacy HTML per hero (for diff)
  const legacyHtml = heroes.map((h) => renderHeroContentLegacy(h.props || {}));

  const { data: afterData, changedHeroes } = migrateData(beforeData);

  // Compute zones-path HTML per hero
  const afterHeroes = afterData.content.filter((c) => c?.type === 'HeroSection');
  const zones = afterData.zones || {};
  const zonesHtml = afterHeroes.map((h) => {
    const id = h.props?.id;
    if (!id) return '';
    return renderHeroContentZones(zones[`${id}:hero-main`], zones[`${id}:hero-ctas`]);
  });

  const diffs = [];
  for (let i = 0; i < legacyHtml.length; i++) {
    if (legacyHtml[i] !== zonesHtml[i]) {
      diffs.push({ heroIndex: i, legacy: legacyHtml[i], zones: zonesHtml[i] });
    }
  }

  return {
    slug: row.slug,
    heroCount: heroes.length,
    migratedHeroes: changedHeroes,
    diffs,
    afterData,
  };
}

async function main() {
  const query = sb.from('pages').select('id, slug, page_builder_data, use_page_builder');
  const { data: pages, error } = targetSlug ? await query.eq('slug', targetSlug) : await query;
  if (error) { console.error('✗ DB fetch failed:', error.message); process.exit(1); }

  console.log(`Found ${pages.length} page${pages.length === 1 ? '' : 's'} ${targetSlug ? `matching "${targetSlug}"` : ''}`);
  console.log(`Mode: ${apply ? 'APPLY (will write back)' : 'DRY-RUN'}`);
  console.log('');

  let totalHeroes = 0;
  let totalMigrated = 0;
  let totalDiffs = 0;
  const writes = [];

  for (const row of pages) {
    const result = await processPage(row);
    totalHeroes += result.heroCount || 0;
    totalMigrated += result.migratedHeroes || 0;
    const diffCount = (result.diffs || []).length;
    totalDiffs += diffCount;

    if (result.skipped) {
      console.log(`  · ${row.slug}: ${result.skipped}`);
      continue;
    }

    const ok = diffCount === 0;
    console.log(`  ${ok ? '✓' : '✗'} ${row.slug}: ${result.heroCount} hero${result.heroCount === 1 ? '' : 'es'}, ${result.migratedHeroes} migrated, ${diffCount} byte-diff${diffCount === 1 ? '' : 's'}`);
    if (!ok) {
      for (const d of result.diffs) {
        console.log(`      hero #${d.heroIndex} diff:`);
        console.log(`        legacy: ${d.legacy.slice(0, 200)}…`);
        console.log(`        zones : ${d.zones.slice(0, 200)}…`);
      }
    }

    if (apply && result.migratedHeroes > 0 && ok) {
      writes.push({ id: row.id, slug: row.slug, data: result.afterData });
    }
  }

  console.log('');
  console.log(`Summary: ${totalHeroes} hero${totalHeroes === 1 ? '' : 'es'} found, ${totalMigrated} migrated, ${totalDiffs} byte-diff${totalDiffs === 1 ? '' : 's'}`);

  if (apply) {
    if (totalDiffs > 0) {
      console.log('');
      console.log('✗ Byte-diffs detected — refusing to write. Fix the renderer or migrator first.');
      process.exit(1);
    }
    for (const w of writes) {
      const { error: upErr } = await sb
        .from('pages')
        .update({ page_builder_data: w.data, updated_at: new Date().toISOString() })
        .eq('id', w.id);
      if (upErr) {
        console.error(`  ✗ write failed for ${w.slug}: ${upErr.message}`);
      } else {
        console.log(`  ✓ wrote ${w.slug}`);
      }
    }
  } else {
    console.log('');
    console.log('(Dry-run. Pass --apply to write the migrated JSON back to the DB.)');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
