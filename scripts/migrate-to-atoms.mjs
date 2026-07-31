#!/usr/bin/env node
/**
 * migrate-to-atoms.mjs — V4 one-shot migration + byte-identity verifier.
 *
 * Walks every page row with `page_builder_data` and, for each
 * V4-atom-capable section, lifts legacy flat props into Puck zones.
 *
 * Sections handled:
 *   HeroSection         → hero-main + hero-ctas zones
 *   TwoColumnSection    → section-chrome + section-ctas zones
 *   CardGridSection     → section-chrome zone
 *   SiteCardsSection    → section-chrome zone
 *   ExploreGridSection  → section-chrome zone
 *   ReviewsSection      → section-chrome zone
 *   ReserveFormSection  → section-chrome zone
 *   FeatureListSection  → section-chrome zone
 *   AmenityGridSection  → section-chrome zone
 *
 * Sections intentionally not migrated (inline styles / custom layout that
 * atoms cannot currently carry byte-identically): CtaBannerSection,
 * RatesTableSection, InterludeSection, EventsWidgetSection, ImageBlock,
 * TrustBarSection.
 *
 * By default runs in DRY-RUN mode: prints what would change per slug
 * and verifies that a string-renderer run over the migrated zones
 * produces HTML byte-identical to the current legacy flat-prop output.
 * Pass --apply to write the migrated JSON back to the database.
 *
 * Usage:
 *   node scripts/migrate-to-atoms.mjs             # dry-run, all pages
 *   node scripts/migrate-to-atoms.mjs index       # dry-run, one slug
 *   node scripts/migrate-to-atoms.mjs --apply     # write-back, all
 *   node scripts/migrate-to-atoms.mjs index --apply
 *
 * Safe to re-run: the migrator is idempotent (skips sections that already
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

// ── Hero migrator (duplicated from src/lib/puck-data-migrate.ts) ──
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
  if (line1 || line2) heroMain.push({ type: 'EditableHeading', props: { id: `${heroId}-heading`, text: line1 || '', level: 1, italic: false, line2Italic: line2 || '', inlineItalic: '', className: 'hero-hl' } });
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

// ── Section-chrome config (must match src/lib/puck-data-migrate.ts) ──
const SECTION_CHROME = {
  TwoColumnSection:    { useLabel: true, useHeading: true, useItalicInline: true, headingLevel: 2, headingClass: 'st', bodyKey: 'body',  bodyClass: 'section-body' },
  CardGridSection:     { useLabel: true, useHeading: true, useItalicInline: true, headingLevel: 2, headingClass: 'st' },
  SiteCardsSection:    { useLabel: true, useHeading: true, useItalicInline: true, headingLevel: 2, headingClass: 'st', bodyKey: 'intro', bodyClass: 'sites-intro' },
  ExploreGridSection:  { useLabel: true, useHeading: true, useItalicInline: true, headingLevel: 2, headingClass: 'st', bodyKey: 'intro', bodyClass: 'section-body' },
  ReviewsSection:      { useLabel: true, useHeading: true, useItalicInline: true, headingLevel: 2, headingClass: 'st' },
  ReserveFormSection:  { useLabel: true, useHeading: true, useItalicInline: true, headingLevel: 2, headingClass: 'st', bodyKey: 'body',  bodyClass: 'section-body' },
  FeatureListSection:  { useLabel: true, useHeading: true, headingLevel: 2, headingClass: 'st' },
  AmenityGridSection:  { useLabel: true, useHeading: true, useItalicInline: true, headingLevel: 2, headingClass: 'st' },
};

function buildSectionChrome(type, itemId, props) {
  const cfg = SECTION_CHROME[type];
  if (!cfg) return null;
  const headingKey = cfg.headingKey || 'headline';
  const label = cfg.useLabel && typeof props.label === 'string' ? props.label.trim() : '';
  const headline = cfg.useHeading && typeof props[headingKey] === 'string' ? props[headingKey].trim() : '';
  const headlineItalic = cfg.useItalicInline && typeof props.headlineItalic === 'string' ? props.headlineItalic.trim() : '';
  const body = cfg.bodyKey && typeof props[cfg.bodyKey] === 'string' ? props[cfg.bodyKey].trim() : '';
  if (!label && !headline && !headlineItalic && !body) return null;

  const atoms = [];
  if (label) atoms.push({ type: 'EditableEyebrow', props: { id: `${itemId}-label`, text: label, tag: 'span', className: 'section-label' } });
  if (headline || headlineItalic) atoms.push({ type: 'EditableHeading', props: { id: `${itemId}-heading`, text: headline, level: cfg.headingLevel || 2, italic: false, line2Italic: '', inlineItalic: headlineItalic, className: cfg.headingClass || '' } });
  if (body && cfg.bodyKey) atoms.push({ type: 'EditableRichText', props: { id: `${itemId}-${cfg.bodyKey}`, html: body, className: cfg.bodyClass || '' } });

  const remaining = { ...props };
  if (cfg.useLabel) remaining.label = '';
  remaining[headingKey] = '';
  if (cfg.useItalicInline) remaining.headlineItalic = '';
  if (cfg.bodyKey) remaining[cfg.bodyKey] = '';
  return { atoms, remaining };
}

function migrateData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.content)) return { data, changedItems: 0 };
  const zonesIn = (data.zones && typeof data.zones === 'object') ? { ...data.zones } : {};
  const zonesOut = { ...zonesIn };
  let changedItems = 0;

  const nextContent = data.content.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const type = item.type;
    const itemId = item.props?.id;
    let working = item;

    if (type === 'HeroSection' && itemId) {
      const mainKey = `${itemId}:hero-main`;
      const ctasKey = `${itemId}:hero-ctas`;
      const hasZones = (Array.isArray(zonesIn[mainKey]) && zonesIn[mainKey].length > 0)
        || (Array.isArray(zonesIn[ctasKey]) && zonesIn[ctasKey].length > 0);
      if (!hasZones) {
        const built = buildHeroZones(itemId, item.props || {});
        if (built) {
          zonesOut[mainKey] = built.heroMain;
          zonesOut[ctasKey] = built.heroCtas;
          changedItems++;
          working = { ...item, props: built.remainingProps };
        }
      }
    }

    if (SECTION_CHROME[type] && itemId) {
      const chromeKey = `${itemId}:section-chrome`;
      const hasChrome = Array.isArray(zonesIn[chromeKey]) && zonesIn[chromeKey].length > 0;
      if (!hasChrome) {
        const built = buildSectionChrome(type, itemId, working.props || {});
        if (built) {
          zonesOut[chromeKey] = built.atoms;
          changedItems++;
          working = { ...working, props: built.remaining };
        }
      }
    }

    if (type === 'TwoColumnSection' && itemId) {
      const ctasKey = `${itemId}:section-ctas`;
      const hasCtas = Array.isArray(zonesIn[ctasKey]) && zonesIn[ctasKey].length > 0;
      if (!hasCtas) {
        const p = working.props || {};
        const ctaLabel = typeof p.ctaLabel === 'string' ? p.ctaLabel.trim() : '';
        if (ctaLabel) {
          zonesOut[ctasKey] = [{
            type: 'EditableButton',
            props: {
              id: `${itemId}-cta`,
              label: ctaLabel,
              url: typeof p.ctaUrl === 'string' ? p.ctaUrl : '',
              variant: 'custom',
              className: '',
              openInNewTab: false,
            },
          }];
          changedItems++;
          working = { ...working, props: { ...p, ctaLabel: '', ctaUrl: '' } };
        }
      }
    }

    return working;
  });

  return { data: { ...data, content: nextContent, zones: zonesOut }, changedItems };
}

// ── String renderers (match PuckRenderer.astro byte-for-byte) ──
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderAtom(atom) {
  if (!atom) return '';
  const p = atom.props || {};
  if (atom.type === 'EditableEyebrow') {
    const tag = (p.tag === 'span' || p.tag === 'p') ? p.tag : 'div';
    const cls = p.className ? ` class="${esc(p.className)}"` : '';
    return `<${tag}${cls}>${esc(p.text || '')}</${tag}>`;
  }
  if (atom.type === 'EditableHeading') {
    const lvl = Math.min(Math.max(Number(p.level) || 2, 1), 6);
    const cls = p.className ? ` class="${esc(p.className)}"` : '';
    let body;
    if (p.line2Italic) body = `${esc(p.text || '')}<br /><em>${esc(p.line2Italic)}</em>`;
    else if (p.inlineItalic) body = `${esc(p.text || '')} <em>${esc(p.inlineItalic)}</em>`;
    else if (p.italic) body = `<em>${esc(p.text || '')}</em>`;
    else body = esc(p.text || '');
    return `<h${lvl}${cls}>${body}</h${lvl}>`;
  }
  if (atom.type === 'EditableRichText') {
    const cls = p.className ? ` class="${esc(p.className)}"` : '';
    return `<div${cls}>${p.html || ''}</div>`;
  }
  if (atom.type === 'EditableButton') {
    const vm = { primary: 'btn-p', secondary: 'btn-g', ghost: 'btn-o' };
    const cls = p.variant === 'custom' ? (p.className || '') : (vm[p.variant] || 'btn-p');
    const clsAttr = cls ? ` class="${esc(cls)}"` : '';
    const tgt = p.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a${clsAttr} href="${esc(p.url || '#')}"${tgt}>${esc(p.label || '')}</a>`;
  }
  return '';
}

// ── Legacy chrome/cta snippet renderers — must byte-match the Astro output ──
function renderLegacyChrome(type, p) {
  if (type === 'HeroSection') {
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

  const cfg = SECTION_CHROME[type];
  if (!cfg) return null;

  const headingKey = cfg.headingKey || 'headline';
  const out = [];
  if (cfg.useLabel && p.label) out.push(`<span class="section-label">${esc(p.label)}</span>`);
  const hasHeadline = p[headingKey] || (cfg.useItalicInline && p.headlineItalic);
  if (hasHeadline) {
    const italic = cfg.useItalicInline && p.headlineItalic ? ` <em>${esc(p.headlineItalic)}</em>` : '';
    out.push(`<h${cfg.headingLevel || 2} class="${cfg.headingClass || ''}">${esc(p[headingKey] || '')}${italic}</h${cfg.headingLevel || 2}>`);
  }
  if (cfg.bodyKey && p[cfg.bodyKey]) {
    out.push(`<div class="${cfg.bodyClass || ''}">${p[cfg.bodyKey]}</div>`);
  }
  return out.join('');
}

function renderLegacyCtas(type, p) {
  if (type === 'HeroSection') return null;
  if (type === 'TwoColumnSection') {
    if (!p.ctaLabel) return '';
    return `<div class="section-cta"><a href="${esc(p.ctaUrl || '#')}">${esc(p.ctaLabel)}</a></div>`;
  }
  return null;
}

function renderZonesChrome(type, itemId, zones) {
  if (type === 'HeroSection') {
    const main = zones[`${itemId}:hero-main`] || [];
    const ctas = zones[`${itemId}:hero-ctas`] || [];
    return main.map(renderAtom).join('') + `<div class="hero-ctas">${ctas.map(renderAtom).join('')}</div>`;
  }
  const chrome = zones[`${itemId}:section-chrome`] || [];
  return chrome.map(renderAtom).join('');
}

function renderZonesCtas(type, itemId, zones) {
  if (type === 'HeroSection') return null;
  if (type === 'TwoColumnSection') {
    const ctas = zones[`${itemId}:section-ctas`] || [];
    if (ctas.length === 0) return '';
    return `<div class="section-cta">${ctas.map(renderAtom).join('')}</div>`;
  }
  return null;
}

async function processPage(row) {
  const beforeData = row.page_builder_data;
  if (!beforeData || !Array.isArray(beforeData.content)) {
    return { slug: row.slug, skipped: 'no content' };
  }
  const migratable = beforeData.content.filter((c) => c && (c.type === 'HeroSection' || SECTION_CHROME[c.type]));
  if (migratable.length === 0) return { slug: row.slug, skipped: 'no atom-capable sections' };

  const legacySnippets = migratable.map((item) => ({
    type: item.type,
    id: item.props?.id,
    chrome: renderLegacyChrome(item.type, item.props || {}),
    ctas: renderLegacyCtas(item.type, item.props || {}),
  }));

  const { data: afterData, changedItems } = migrateData(beforeData);
  const afterMigratable = afterData.content.filter((c) => c && (c.type === 'HeroSection' || SECTION_CHROME[c.type]));
  const zones = afterData.zones || {};
  const zonesSnippets = afterMigratable.map((item) => ({
    type: item.type,
    id: item.props?.id,
    chrome: renderZonesChrome(item.type, item.props?.id, zones),
    ctas: renderZonesCtas(item.type, item.props?.id, zones),
  }));

  const diffs = [];
  for (let i = 0; i < legacySnippets.length; i++) {
    const L = legacySnippets[i], Z = zonesSnippets[i];
    if (L.chrome !== Z.chrome) {
      diffs.push({ type: L.type, kind: 'chrome', legacy: L.chrome, zones: Z.chrome });
    }
    if (L.ctas !== null && L.ctas !== Z.ctas) {
      diffs.push({ type: L.type, kind: 'ctas', legacy: L.ctas, zones: Z.ctas });
    }
  }

  return {
    slug: row.slug,
    itemCount: migratable.length,
    migratedItems: changedItems,
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

  let totalItems = 0;
  let totalMigrated = 0;
  let totalDiffs = 0;
  const writes = [];

  for (const row of pages) {
    const result = await processPage(row);
    totalItems += result.itemCount || 0;
    totalMigrated += result.migratedItems || 0;
    const diffCount = (result.diffs || []).length;
    totalDiffs += diffCount;

    if (result.skipped) {
      console.log(`  . ${row.slug}: ${result.skipped}`);
      continue;
    }

    const ok = diffCount === 0;
    console.log(`  ${ok ? '+' : 'x'} ${row.slug}: ${result.itemCount} atom-capable item${result.itemCount === 1 ? '' : 's'}, ${result.migratedItems} migration${result.migratedItems === 1 ? '' : 's'} applied, ${diffCount} byte-diff${diffCount === 1 ? '' : 's'}`);
    if (!ok) {
      for (const d of result.diffs) {
        console.log(`      ${d.type} ${d.kind} diff:`);
        console.log(`        legacy: ${String(d.legacy).slice(0, 200)}...`);
        console.log(`        zones : ${String(d.zones).slice(0, 200)}...`);
      }
    }

    if (apply && result.migratedItems > 0 && ok) {
      writes.push({ id: row.id, slug: row.slug, data: result.afterData });
    }
  }

  console.log('');
  console.log(`Summary: ${totalItems} atom-capable item${totalItems === 1 ? '' : 's'} found, ${totalMigrated} migration${totalMigrated === 1 ? '' : 's'} applied, ${totalDiffs} byte-diff${totalDiffs === 1 ? '' : 's'}`);

  if (apply) {
    if (totalDiffs > 0) {
      console.log('');
      console.log('x Byte-diffs detected - refusing to write. Fix the renderer or migrator first.');
      process.exit(1);
    }
    for (const w of writes) {
      const { error: upErr } = await sb
        .from('pages')
        .update({ page_builder_data: w.data, updated_at: new Date().toISOString() })
        .eq('id', w.id);
      if (upErr) {
        console.error(`  x write failed for ${w.slug}: ${upErr.message}`);
      } else {
        console.log(`  + wrote ${w.slug}`);
      }
    }
  } else {
    console.log('');
    console.log('(Dry-run. Pass --apply to write the migrated JSON back to the DB.)');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
