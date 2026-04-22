#!/usr/bin/env node
/**
 * reseed-park-sites-from-firefly.mjs
 *
 * Replaces the park_sites inventory with the authoritative list from the
 * Firefly Units Report (Total Units: 113). Fixes three problems the
 * earlier placeholder seed + Phase 1.5 addendum created:
 *
 *   1. Naming convention — owner's actual codes are `A1`, `B7`, `C13`,
 *      `D14A`, `D14B`, `MAGIC`, `DC1`, `DC18`, `G4`, `G8` (letter first,
 *      no zero-padding, no dash). Placeholder seed used `A-01` style.
 *
 *   2. Counts — real park has different per-loop totals than the
 *      placeholder seed (15 A vs 27 placeholder, 7 B vs 28, 24 C vs 27,
 *      41 D vs 27, 20 T vs 0, 4 DC vs 0, 2 G vs 0). Many phantom rows +
 *      many missing.
 *
 *   3. Status — owner clarifications:
 *        C1  → camp_host (Camp Host site relocated here)
 *        A1  → staff_only (hidden in Firefly; owner's emergency reserve)
 *        D14B→ staff_only (hidden in Firefly; emergency reserve)
 *        D34 → staff_only (hidden in Firefly; sideways + 24 ft)
 *        G4/G8 → staff_only + is_published=false (hidden amenity records)
 *
 * SAFE-BY-DEFAULT:
 *   - Dry-run is the default; nothing is written without --apply.
 *   - Before wiping, the script dumps the current park_sites rows to
 *     `scripts/_backups/park_sites-backup-<timestamp>.json`. Rolling
 *     back is a manual re-insert from that JSON file.
 *   - --apply wraps DELETE + INSERT in the Supabase transaction
 *     semantics exposed by the REST client (best-effort; if the INSERT
 *     fails mid-way we bail and the backup is the source of truth).
 *
 * Usage:
 *   node scripts/reseed-park-sites-from-firefly.mjs           # DRY-RUN
 *   node scripts/reseed-park-sites-from-firefly.mjs --apply   # writes
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes('--apply');

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Firefly inventory (extracted from Units Report PDF dated Mar 2026) ──────
//
// Status overrides applied at the bottom in APPLY_STATUS (C1, A1, D14B,
// D34, G4/G8). Everything else is status='available'.
//
// Site numbers use the owner's convention (no dash, no zero-padding).

const FIREFLY_SITES = [
  // ---- A loop (15 sites) ----
  { code: 'A1',  loop: 'A', type: 'full-hookup',     length_feet: 36, amp: 50, pullThrough: false, fireflyHidden: true,  description: '30/50 Amp Full Hook Up. One-side slide only. Emergency reserve site — not offered for online booking.' },
  { code: 'A2',  loop: 'A', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'A3',  loop: 'A', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'A4',  loop: 'A', type: 'full-hookup',     length_feet: 43, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'A5',  loop: 'A', type: 'full-hookup',     length_feet: 45, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'A6',  loop: 'A', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'A7',  loop: 'A', type: 'full-hookup',     length_feet: 45, amp: 30, pullThrough: false, description: '30 Amp Full Hook Up back-in. Both slides.' },
  { code: 'A8',  loop: 'A', type: 'water-electric',  length_feet: 42, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },
  { code: 'A9',  loop: 'A', type: 'water-electric',  length_feet: 35, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },
  { code: 'A10', loop: 'A', type: 'water-electric',  length_feet: 30, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },
  { code: 'A11', loop: 'A', type: 'water-electric',  length_feet: 32, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },
  { code: 'A12', loop: 'A', type: 'water-electric',  length_feet: 30, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },
  { code: 'A13', loop: 'A', type: 'water-electric',  length_feet: 32, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },
  { code: 'A14', loop: 'A', type: 'water-electric',  length_feet: 32, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },
  { code: 'A15', loop: 'A', type: 'water-electric',  length_feet: 32, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Both slides.' },

  // ---- B loop (7 sites, all pull-through full-hookup 60ft) ----
  { code: 'B1',  loop: 'B', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through. Both slides.' },
  { code: 'B2',  loop: 'B', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through. Both slides.' },
  { code: 'B3',  loop: 'B', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through. Both slides.' },
  { code: 'B4',  loop: 'B', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through. Both slides.' },
  { code: 'B5',  loop: 'B', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: 'Full Hook-Ups, pull through. Both slides.' },
  { code: 'B6',  loop: 'B', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull through. Both slides.' },
  { code: 'B7',  loop: 'B', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull through. Both slides.' },

  // ---- C loop (24 sites) ----
  { code: 'C1',  loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up. Camp Host residence — not available for booking.' },
  { code: 'C2',  loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'C3',  loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'C4',  loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'C5',  loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'C6',  loop: 'C', type: 'full-hookup',     length_feet: 35, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Passenger side slide only.' },
  { code: 'C7',  loop: 'C', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C8',  loop: 'C', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C9',  loop: 'C', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C10', loop: 'C', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C11', loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C12', loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C13', loop: 'C', type: 'pull-in-full',    length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up. PULL-IN, hookups on the left. Good for motorhomes. Both slides.' },
  { code: 'C14', loop: 'C', type: 'full-hookup',     length_feet: 60, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C15', loop: 'C', type: 'full-hookup',     length_feet: 35, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C16', loop: 'C', type: 'full-hookup',     length_feet: 35, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C17', loop: 'C', type: 'full-hookup',     length_feet: 36, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C18', loop: 'C', type: 'full-hookup',     length_feet: 38, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C19', loop: 'C', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C20', loop: 'C', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C21', loop: 'C', type: 'full-hookup',     length_feet: 42, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C22', loop: 'C', type: 'full-hookup',     length_feet: 44, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C23', loop: 'C', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },
  { code: 'C24', loop: 'C', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. Both slides.' },

  // ---- D loop (42 numbered with gaps at D4/D18/D23, plus D14A/D14B = 41 total) ----
  { code: 'D1',  loop: 'D', type: 'water-electric',  length_feet: 50, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in.' },
  { code: 'D2',  loop: 'D', type: 'water-electric',  length_feet: 50, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in.' },
  { code: 'D3',  loop: 'D', type: 'water-electric',  length_feet: 42, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in.' },
  // D4 does not exist
  { code: 'D5',  loop: 'D', type: 'pull-through-we', length_feet: 27, amp: 50, pullThrough: true,  description: '50 Amp Water/Power pull-through.' },
  { code: 'D6',  loop: 'D', type: 'pull-through-we', length_feet: 35, amp: 50, pullThrough: true,  description: '50 Amp Water/Power pull-through.' },
  { code: 'D7',  loop: 'D', type: 'pull-through-full', length_feet: 40, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through. Sewer is on the opposite side from power.' },
  { code: 'D8',  loop: 'D', type: 'pull-through-full', length_feet: 45, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through. Sewer is on opposite side from power. Very wide site.' },
  { code: 'D9',  loop: 'D', type: 'pull-through-full', length_feet: 65, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through. Sewer is on opposite side from power.' },
  { code: 'D10', loop: 'D', type: 'pull-through-full', length_feet: 65, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through.' },
  { code: 'D11', loop: 'D', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through.' },
  { code: 'D12', loop: 'D', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through.' },
  { code: 'D13', loop: 'D', type: 'pull-through-full', length_feet: 60, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through.' },
  { code: 'D14', loop: 'D', type: 'pull-through-full', length_feet: 55, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through.' },
  { code: 'D14A',loop: 'D', type: 'pull-through-full', length_feet: 42, amp: 50, pullThrough: true, description: '30/50 Amp Full Hook Up pull-through.' },
  { code: 'D14B',loop: 'D', type: 'pull-through-full', length_feet: 70, amp: 50, pullThrough: true, fireflyHidden: true, description: '30/50 Amp Full Hook Up pull-through. 70 ft. Emergency reserve site — not offered for online booking.' },
  { code: 'D15', loop: 'D', type: 'water-electric',  length_feet: 30, amp: 50, pullThrough: false, description: '30/50 Amp Water/Power back-in. No slides.' },
  { code: 'D16', loop: 'D', type: 'water-electric',  length_feet: 30, amp: 50, pullThrough: false, description: '30/50 Amp Water/Power back-in. No slides.' },
  { code: 'D17', loop: 'D', type: 'water-electric',  length_feet: 30, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. No slides.' },
  // D18 does not exist
  { code: 'D19', loop: 'D', type: 'water-electric',  length_feet: 30, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. No slides.' },
  { code: 'D20', loop: 'D', type: 'water-electric',  length_feet: 30, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. Passenger side slide only.' },
  { code: 'D21', loop: 'D', type: 'full-hookup',     length_feet: 32, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. One side slide only.' },
  { code: 'D22', loop: 'D', type: 'full-hookup',     length_feet: 32, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. One side slide only. Site can be backed into against the grass or parallel to the grass.' },
  // D23 does not exist
  { code: 'D24', loop: 'D', type: 'full-hookup',     length_feet: 35, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D25', loop: 'D', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D26', loop: 'D', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D27', loop: 'D', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D28', loop: 'D', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D29', loop: 'D', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D30', loop: 'D', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D31', loop: 'D', type: 'full-hookup',     length_feet: 50, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D32', loop: 'D', type: 'full-hookup',     length_feet: 45, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D33', loop: 'D', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in.' },
  { code: 'D34', loop: 'D', type: 'water-electric',  length_feet: 24, amp: 50, pullThrough: false, fireflyHidden: true, description: '50 Amp Water/Power. Sideways, parallel to the grass. Short (24 ft).' },
  { code: 'D35', loop: 'D', type: 'full-hookup',     length_feet: 40, amp: 50, pullThrough: false, description: '30/50 Amp Power/Water. Sideways, parallel to the grass.' },
  { code: 'D36', loop: 'D', type: 'full-hookup',     length_feet: 31, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. One side slide only.' },
  { code: 'D37', loop: 'D', type: 'full-hookup',     length_feet: 30, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. One side slide only.' },
  { code: 'D38', loop: 'D', type: 'full-hookup',     length_feet: 30, amp: 50, pullThrough: false, description: '30/50 Amp Full Hook Up back-in. One side slide only.' },
  { code: 'D39', loop: 'D', type: 'water-electric',  length_feet: 32, amp: 50, pullThrough: false, description: '50 Amp Water/Power back-in. One side slide only.' },
  { code: 'D40', loop: 'D', type: 'water-electric',  length_feet: 28, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. One side slide only.' },
  { code: 'D41', loop: 'D', type: 'water-electric',  length_feet: 30, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in parallel to grass. One side slide only.' },
  { code: 'D42', loop: 'D', type: 'water-electric',  length_feet: 32, amp: 30, pullThrough: false, description: '30 Amp Water/Power back-in. One side slide only.' },

  // ---- T loop (20: T1-T19 + MAGIC) ----
  ...Array.from({ length: 19 }, (_, i) => {
    const n = i + 1;
    const rooftop = n >= 16 && n <= 19;
    return {
      code: `T${n}`,
      loop: 'T',
      type: 'tent',
      length_feet: null,
      amp: null,
      pullThrough: false,
      description: rooftop
        ? 'Tent site. No water or power. Will accommodate a rooftop tent.'
        : 'Tent site. No water or power.',
    };
  }),
  { code: 'MAGIC', loop: 'T', type: 'tent', length_feet: null, amp: null, pullThrough: false,
    description: 'Special tent site beneath the trees. Named by our campers.' },

  // ---- DC (Dry Camping — 4 sites: DC1, DC2, DC3, DC18) ----
  { code: 'DC1',  loop: 'DC', type: 'dry-camp', length_feet: 25, amp: null, pullThrough: false, description: 'Dry camp — no water, electric, or sewer. Single vehicles no longer than 25 ft. No trailers or 5th wheels.' },
  { code: 'DC2',  loop: 'DC', type: 'dry-camp', length_feet: 25, amp: null, pullThrough: false, description: 'Dry camping — no electric, sewer, or water. Single vehicles only, not to exceed 25 ft. No trailers or 5th wheels. No slides.' },
  { code: 'DC3',  loop: 'DC', type: 'dry-camp', length_feet: 25, amp: null, pullThrough: false, description: 'Dry camping — no electric, water, or sewer. Single vehicles only, 25 ft max. No trailers or 5th wheels. No slides.' },
  { code: 'DC18', loop: 'DC', type: 'dry-camp', length_feet: 25, amp: null, pullThrough: false, description: 'Dry camping — no power or water. Tent or van site, 25 ft or less. No slides.' },

  // ---- G (Gazebo — 2 virtual records for one physical amenity, both hidden) ----
  { code: 'G4', loop: 'G', type: 'gazebo', length_feet: null, amp: null, pullThrough: false, fireflyHidden: true, description: 'Gazebo — 4 hour booking slot. 8-12 / 12-4 / 4-8. Staff-booked only.' },
  { code: 'G8', loop: 'G', type: 'gazebo', length_feet: null, amp: null, pullThrough: false, fireflyHidden: true, description: 'Gazebo — 8 hour day-use booking. $50.00. Staff-booked only.' },
];

// ── Status overrides (owner guidance) ────────────────────────────────────────
// Overrides by site code; merged with the Firefly hidden flag for consistency.
// If not listed here, a site with fireflyHidden=true gets status='staff_only'
// by default (per owner's comment that hidden sites are their emergency
// reserves). Otherwise status='available'.
const STATUS_OVERRIDES = {
  C1:   { status: 'camp_host',  note: 'Camp Host — permanent site, not available for booking.' },
  A1:   { status: 'staff_only', note: 'Reserve site — call 541-923-1441 to book.' },
  D14B: { status: 'staff_only', note: 'Reserve site — call 541-923-1441 to book.' },
  D34:  { status: 'staff_only', note: 'Sideways + 24 ft — staff booking only.' },
  G4:   { status: 'staff_only', note: 'Gazebo 4-hour — staff-booked only.', isPublished: false },
  G8:   { status: 'staff_only', note: 'Gazebo 8-hour — staff-booked only.', isPublished: false },
};

// ── Row builder ──────────────────────────────────────────────────────────────

function buildRow(src) {
  const override = STATUS_OVERRIDES[src.code];
  const status = override?.status ?? (src.fireflyHidden ? 'staff_only' : 'available');
  const statusNote = override?.note ?? (src.fireflyHidden ? 'Hidden from online booking — call the office.' : null);
  const isPublished = override?.isPublished ?? true;
  const isAvailable = status === 'available';

  const features = [];
  if (src.amp === 50) features.push('50-amp');
  else if (src.amp === 30) features.push('30-amp');
  if (src.type === 'full-hookup' || src.type === 'pull-through-full' || src.type === 'pull-in-full') features.push('full-hookup');
  if (src.type === 'water-electric' || src.type === 'pull-through-we') features.push('water-electric');
  if (src.pullThrough) features.push('pull-through');
  else if (src.loop !== 'T' && src.loop !== 'DC' && src.loop !== 'G') features.push('back-in');
  if (src.type === 'tent' && ['T16','T17','T18','T19'].includes(src.code)) features.push('rooftop-tent');

  return {
    site_number: src.code,
    loop: src.loop,
    length_feet: src.length_feet ?? null,
    width_feet: null,
    pull_through: Boolean(src.pullThrough),
    amp_service: src.amp ?? null,
    site_type: src.type,
    nightly_rate: null,
    weekly_rate: null,
    monthly_rate: null,
    hero_image_url: null,
    gallery_image_urls: [],
    description: src.description || null,
    features,
    map_position_x: null,
    map_position_y: null,
    map_polygon: null,
    firefly_deep_link: null,
    is_available: isAvailable,
    is_published: isPublished,
    status,
    status_note: statusNote,
  };
}

// ── Execution ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (will wipe + reseed)' : 'DRY-RUN (no writes)'}`);
  console.log('');

  // Validate & build
  const byCode = new Map();
  for (const s of FIREFLY_SITES) {
    if (byCode.has(s.code)) {
      console.error(`✗ duplicate code in inventory: ${s.code}`);
      process.exit(1);
    }
    byCode.set(s.code, buildRow(s));
  }
  const rows = [...byCode.values()];

  // Plan summary
  const byLoop = rows.reduce((acc, r) => { (acc[r.loop] ??= []).push(r); return acc; }, {});
  const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  console.log(`New inventory: ${rows.length} sites total`);
  for (const l of Object.keys(byLoop).sort()) {
    console.log(`  loop ${l}: ${byLoop[l].length} (${byLoop[l].slice(0,6).map(r => r.site_number).join(', ')}${byLoop[l].length > 6 ? ', …' : ''})`);
  }
  console.log(`Status distribution: ${JSON.stringify(byStatus)}`);
  console.log(`Hidden (is_published=false): ${rows.filter(r => !r.is_published).map(r => r.site_number).join(', ') || '(none)'}`);
  console.log('');

  // Snapshot current DB
  const { data: current, error: curErr } = await sb.from('park_sites').select('*');
  if (curErr) { console.error('✗ current fetch failed:', curErr.message); process.exit(1); }
  console.log(`Current park_sites has ${current.length} rows → would be replaced.`);

  // Cross-check: which current site_numbers also appear in new inventory?
  const currentCodes = new Set(current.map((r) => r.site_number));
  const newCodes = new Set(rows.map((r) => r.site_number));
  const kept = [...currentCodes].filter((c) => newCodes.has(c));
  const dropped = [...currentCodes].filter((c) => !newCodes.has(c));
  const added = [...newCodes].filter((c) => !currentCodes.has(c));
  console.log(`  ${kept.length} codes exist in both (kept names): ${kept.slice(0, 8).join(', ')}${kept.length > 8 ? ', …' : ''}`);
  console.log(`  ${dropped.length} codes will be removed: ${dropped.slice(0, 8).join(', ')}${dropped.length > 8 ? ', …' : ''}`);
  console.log(`  ${added.length} codes will be added:   ${added.slice(0, 8).join(', ')}${added.length > 8 ? ', …' : ''}`);
  console.log('');

  if (!apply) {
    console.log('(Dry-run. Pass --apply to wipe + reseed.)');
    return;
  }

  // --- Apply path ---

  // 1. Backup
  const backupDir = resolve(__dirname, '_backups');
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(backupDir, `park_sites-backup-${ts}.json`);
  writeFileSync(backupPath, JSON.stringify(current, null, 2));
  console.log(`✓ backup written: ${backupPath} (${current.length} rows)`);

  // 2. Wipe. Using .neq on a UUID column matches everything (no SQL DELETE
  //    without a WHERE to be safe).
  const { error: delErr } = await sb.from('park_sites').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) { console.error('✗ delete failed:', delErr.message); process.exit(1); }
  console.log(`✓ cleared ${current.length} rows from park_sites`);

  // 3. Insert in chunks (Supabase REST accepts up to 1000 but chunks keep
  //    per-row error messages readable).
  const CHUNK = 25;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: insErr } = await sb.from('park_sites').insert(slice);
    if (insErr) {
      console.error(`✗ insert failed at chunk ${i}-${i + slice.length - 1}:`, insErr.message);
      console.error('Backup is at:', backupPath);
      process.exit(1);
    }
    inserted += slice.length;
    process.stdout.write(`  … ${inserted}/${rows.length} inserted\r`);
  }
  console.log(`\n✓ inserted ${inserted} new rows`);

  // 4. Verify count
  const { count, error: cErr } = await sb.from('park_sites').select('*', { count: 'exact', head: true });
  if (cErr) { console.error('✗ count check failed:', cErr.message); process.exit(1); }
  console.log(`✓ final park_sites count: ${count} (expected ${rows.length})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
