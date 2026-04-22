#!/usr/bin/env node
/**
 * seed-park-map-new-sites.mjs — Phase 1.5a of the park map rebuild.
 *
 * Reconciles the park_sites inventory with the real physical park layout:
 *
 *   • INSERTs 4 new rows that the 2026-04 placeholder seed never created:
 *       D-14-B   (sub-site of D-14; staff_only per Firefly "hidden from portal")
 *       D-34     (D loop extends past placeholder D-27; staff_only per Firefly)
 *       1A       (special non-standard code; blocked from guest self-booking)
 *       1C       (Camp Host — permanent occupant; never bookable)
 *
 *   • UPDATEs the status of 2 pre-existing rows:
 *       A-01 → 'staff_only'  (Firefly hidden-from-portal site; public site
 *                             kept treating it as available because the
 *                             current renderer only checks is_available)
 *       B-01 → 'staff_only'  (same reason)
 *
 * Visible behavior on the live site BEFORE Phase 2 polygon renderer
 * ships: **none**. The current /park-map React component reads only
 * is_available (checked via grep at script-write time), not the new
 * `status` column, so flipping A-01 and B-01 to 'staff_only' is invisible
 * until the polygon renderer lands. The 4 new rows won't show up on the
 * current pin map either because they'll have null map_position_x/y.
 *
 * Idempotent:
 *   - INSERTs use ON CONFLICT (site_number) DO NOTHING
 *   - UPDATEs skip rows already at the target status
 *   - Re-running with --apply after partial success is safe
 *
 * Usage:
 *   node scripts/seed-park-map-new-sites.mjs           # DRY-RUN (default)
 *   node scripts/seed-park-map-new-sites.mjs --apply   # write to DB
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---- Plan definitions -------------------------------------------------------

const INSERTS = [
  {
    site_number: 'D-14-B',
    loop: 'D',
    site_type: 'standard',
    amp_service: 30,
    pull_through: false,
    status: 'staff_only',
    status_note: 'Sub-site of D-14 — staff booking only',
    is_available: false,
    is_published: true,
    description: 'A sub-site associated with D-14 that is not offered through self-booking. Contact the office to reserve.',
  },
  {
    site_number: 'D-34',
    loop: 'D',
    site_type: 'standard',
    amp_service: 30,
    pull_through: false,
    status: 'staff_only',
    status_note: 'Staff booking only — irregular dimensions',
    is_available: false,
    is_published: true,
    description: 'Sideways to grass with limited maneuverability. Booked through office staff only.',
  },
  {
    site_number: '1A',
    loop: 'C',  // Physically near C loop per field guidance
    site_type: 'standard',
    amp_service: 50,
    pull_through: false,
    status: 'staff_only',
    status_note: 'Call 541-923-1441 to book',
    is_available: false,
    is_published: true,
    description: 'Special site near C loop. Blocked from online self-booking — please call the office to reserve.',
  },
  {
    site_number: '1C',
    loop: 'C',
    site_type: 'camp_host',
    amp_service: 50,
    pull_through: false,
    status: 'camp_host',
    status_note: 'Camp Host — permanent site, not available for booking',
    is_available: false,
    is_published: true,
    description: 'Permanent residence of the park\'s Camp Host. Not available for booking.',
  },
];

const UPDATES = [
  {
    site_number: 'A-01',
    status: 'staff_only',
    status_note: 'Staff booking only — call 541-923-1441',
  },
  {
    site_number: 'B-01',
    status: 'staff_only',
    status_note: 'Staff booking only — call 541-923-1441',
  },
];

// ---- Execution --------------------------------------------------------------

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log('');

  // Snapshot current state
  const { data: existing, error: e1 } = await sb
    .from('park_sites')
    .select('site_number, loop, status, status_note, is_available');
  if (e1) { console.error('✗ fetch failed:', e1.message); process.exit(1); }
  const bySite = new Map(existing.map((s) => [s.site_number, s]));

  console.log(`Current park_sites row count: ${existing.length}`);
  console.log('');

  // ---- Plan inserts ---------------------------------------------------------
  console.log('── INSERTs (new physical pads) ──');
  const toInsert = [];
  for (const row of INSERTS) {
    const e = bySite.get(row.site_number);
    if (e) {
      console.log(`  · ${row.site_number}: already exists (status=${e.status}) — skipping`);
    } else {
      console.log(`  + ${row.site_number.padEnd(8)} loop=${row.loop}  status=${row.status.padEnd(11)} ${row.status_note}`);
      toInsert.push(row);
    }
  }

  console.log('');
  console.log('── UPDATEs (status flips on existing rows) ──');
  const toUpdate = [];
  for (const row of UPDATES) {
    const e = bySite.get(row.site_number);
    if (!e) {
      console.log(`  ! ${row.site_number}: NOT FOUND in DB — cannot update, will skip`);
    } else if (e.status === row.status && e.status_note === row.status_note) {
      console.log(`  · ${row.site_number}: already at status=${row.status} — skipping`);
    } else {
      console.log(`  ~ ${row.site_number.padEnd(8)} ${e.status} → ${row.status.padEnd(11)} (note: "${row.status_note}")`);
      toUpdate.push(row);
    }
  }

  console.log('');
  console.log(`Summary: ${toInsert.length} inserts, ${toUpdate.length} updates`);

  if (!apply) {
    console.log('');
    console.log('(Dry-run. Pass --apply to write to the database.)');
    return;
  }

  // ---- Apply ---------------------------------------------------------------
  if (toInsert.length > 0) {
    console.log('');
    console.log('Applying inserts…');
    const { data: inserted, error: ie } = await sb
      .from('park_sites')
      .insert(toInsert)
      .select('site_number');
    if (ie) { console.error('✗ insert failed:', ie.message); process.exit(1); }
    console.log(`  ✓ inserted ${inserted.length} rows: ${inserted.map((r) => r.site_number).join(', ')}`);
  }

  if (toUpdate.length > 0) {
    console.log('');
    console.log('Applying updates…');
    for (const row of toUpdate) {
      const { error: ue } = await sb
        .from('park_sites')
        .update({ status: row.status, status_note: row.status_note })
        .eq('site_number', row.site_number);
      if (ue) { console.error(`✗ update ${row.site_number} failed:`, ue.message); continue; }
      console.log(`  ✓ ${row.site_number} → status=${row.status}`);
    }
  }

  // Final count for confidence
  const { count, error: ce } = await sb.from('park_sites').select('*', { count: 'exact', head: true });
  if (!ce) console.log(`\nFinal park_sites row count: ${count}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
