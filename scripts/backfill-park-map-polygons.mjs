#!/usr/bin/env node
/**
 * backfill-park-map-polygons.mjs — Phase 1.5b of the park map rebuild.
 *
 * For every park_sites row that has map_position_x/y set (0-100 percentage
 * points — the current pin coordinate pair) but no map_polygon yet, write
 * a small axis-aligned rectangle polygon as a starting placement. Operator
 * refines per-site via the upcoming polygon editor (Phase 3).
 *
 * Polygon shape:
 *   A 4%-wide × 4%-tall rectangle centered on the existing pin point.
 *   Stored in park_sites.map_polygon as an array of four [x, y] pairs in
 *   0-1 normalised coordinates (top-left origin) — the convention the
 *   upcoming SVG renderer expects. The 4% size is deliberately generous;
 *   it's easier for an operator to drag-shrink to fit a real site than
 *   to drag-expand a tiny box.
 *
 * Visible behavior on the live site BEFORE Phase 2 renderer ships:
 *   **None.** The current /park-map React component reads map_position_x/y
 *   (pins). It doesn't touch map_polygon. The backfill writes polygons,
 *   but no code reads them yet.
 *
 * Skips:
 *   - Rows with no map_position_x/y (nothing to derive a polygon from).
 *   - Rows where map_polygon is already non-null (don't overwrite operator
 *     work that may have landed via the admin UI).
 *
 * Idempotent: re-running after partial success is safe. Will not touch
 * any row that already has a polygon.
 *
 * Usage:
 *   node scripts/backfill-park-map-polygons.mjs           # DRY-RUN
 *   node scripts/backfill-park-map-polygons.mjs --apply   # write to DB
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---- Tuning knobs -----------------------------------------------------------

const RECT_HALF_SIZE = 0.02;  // 2% of image edge each side = 4% square total

function pctToUnit(pct) {
  // Treat null/undefined as "no coord"; don't let Number(null)=0 silently
  // produce a 0% polygon (which would stack every uncoord'd site in the
  // top-left of the map).
  if (pct === null || pct === undefined) return null;
  const n = typeof pct === 'number' ? pct : Number(pct);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(1, n / 100));
}

/** Build a 4% x 4% rectangle centered on (cx, cy), all values 0-1. */
function rectAround(cx, cy) {
  const h = RECT_HALF_SIZE;
  const x0 = Math.max(0, cx - h);
  const y0 = Math.max(0, cy - h);
  const x1 = Math.min(1, cx + h);
  const y1 = Math.min(1, cy + h);
  // top-left → top-right → bottom-right → bottom-left  (polygon ordering
  // matches what the upcoming SVG renderer expects; editor will overwrite
  // with any operator edit).
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

// ---- Execution --------------------------------------------------------------

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (writes polygons)' : 'DRY-RUN (no writes)'}`);
  console.log('');

  const { data: sites, error } = await sb
    .from('park_sites')
    .select('id, site_number, loop, map_position_x, map_position_y, map_polygon')
    .order('loop')
    .order('site_number');
  if (error) { console.error('✗ fetch failed:', error.message); process.exit(1); }

  console.log(`Reviewing ${sites.length} park_sites…`);
  console.log('');

  const actions = [];
  let skippedNoCoords = 0;
  let skippedHasPolygon = 0;

  for (const s of sites) {
    const hasPolygon = Array.isArray(s.map_polygon) && s.map_polygon.length > 0;
    if (hasPolygon) { skippedHasPolygon++; continue; }

    const cx = pctToUnit(s.map_position_x);
    const cy = pctToUnit(s.map_position_y);
    if (cx === null || cy === null) { skippedNoCoords++; continue; }

    const poly = rectAround(cx, cy);
    actions.push({ site: s, polygon: poly });
  }

  console.log('── Plan summary ──');
  console.log(`  ${actions.length} rows would get a starter 4%×4% rectangle polygon`);
  console.log(`  ${skippedHasPolygon} rows already have a map_polygon (preserved as-is)`);
  console.log(`  ${skippedNoCoords} rows have no pin coords (nothing to derive — will need manual placement later)`);
  console.log('');

  if (actions.length > 0) {
    console.log('── Sample (first 6) ──');
    for (const a of actions.slice(0, 6)) {
      const rounded = a.polygon.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
      console.log(`  ${a.site.site_number.padEnd(8)} centered @ (${(+a.site.map_position_x).toFixed(1)}%, ${(+a.site.map_position_y).toFixed(1)}%)`);
      console.log(`           poly = [${rounded.map((p) => `[${p[0]},${p[1]}]`).join(', ')}]`);
    }
    if (actions.length > 6) console.log(`  … and ${actions.length - 6} more`);
  }

  if (skippedNoCoords > 0) {
    console.log('');
    console.log('── Sites needing manual placement (no pin coords) ──');
    const missing = sites
      .filter((s) => {
        const hasPoly = Array.isArray(s.map_polygon) && s.map_polygon.length > 0;
        if (hasPoly) return false;
        return pctToUnit(s.map_position_x) === null || pctToUnit(s.map_position_y) === null;
      })
      .map((s) => s.site_number);
    console.log(`  ${missing.join(', ')}`);
  }

  if (!apply) {
    console.log('');
    console.log('(Dry-run. Pass --apply to persist polygons.)');
    return;
  }

  if (actions.length === 0) {
    console.log('Nothing to apply.');
    return;
  }

  console.log('');
  console.log('Applying…');
  let ok = 0, failed = 0;
  for (const a of actions) {
    const { error: ue } = await sb
      .from('park_sites')
      .update({ map_polygon: a.polygon })
      .eq('id', a.site.id);
    if (ue) { failed++; console.error(`✗ ${a.site.site_number}: ${ue.message}`); continue; }
    ok++;
  }
  console.log(`  ✓ ${ok} polygons written, ${failed} failed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
