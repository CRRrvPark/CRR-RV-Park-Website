#!/usr/bin/env node
/**
 * restore-site-state.mjs
 *
 * Replays a backup created by backup-site-state.mjs. The default mode is a
 * read-only inspection. Applying a restore requires both --apply and an exact
 * --confirm value matching the backup label.
 *
 * This utility never deletes rows. It upserts only the records captured in the
 * export, so it is safe for the pre-V3 rollback without disturbing user
 * accounts, audit history, analytics, secrets, or reservation systems.
 *
 * Usage:
 *   node scripts/restore-site-state.mjs --input scripts/_backups/<label>/site-state.json
 *   node scripts/restore-site-state.mjs --input ... --apply --confirm <label>
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const input = valueAfter('--input');
const confirmation = valueAfter('--confirm');
const apply = args.includes('--apply');

if (!input) {
  throw new Error('Provide --input <path-to-site-state.json>.');
}

const inputPath = resolve(input);
const raw = await readFile(inputPath, 'utf8');
const checksum = createHash('sha256').update(raw).digest('hex').toUpperCase();
const backup = JSON.parse(raw);

if (backup.format !== 'crr-rv-park-site-state' || backup.formatVersion !== 1) {
  throw new Error('Unsupported backup format. Expected crr-rv-park-site-state version 1.');
}
if (!backup.label || !backup.tables || typeof backup.tables !== 'object') {
  throw new Error('Backup is missing its label or table data.');
}

console.log(`Backup: ${backup.label}`);
console.log(`Captured: ${backup.capturedAt}`);
console.log(`Source: ${backup.source}`);
console.log(`SHA-256: ${checksum}`);
for (const [table, rows] of Object.entries(backup.tables)) {
  console.log(`${table}: ${Array.isArray(rows) ? rows.length : 'invalid'} rows`);
}

if (!apply) {
  console.log('Dry run only. No database changes were made.');
  console.log(`To apply: add --apply --confirm ${backup.label}`);
  process.exit(0);
}

if (confirmation !== backup.label) {
  throw new Error(`Restore confirmation must exactly match "${backup.label}".`);
}

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to apply a restore.');
}

const currentHost = new URL(url).hostname;
if (backup.source && backup.source !== currentHost) {
  throw new Error(`Backup source ${backup.source} does not match configured Supabase host ${currentHost}.`);
}

const sb = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Parent/reference records precede rows that can point at them. All tables use
// their captured primary key for conflict resolution.
const restoreOrder = [
  'media',
  'pages',
  'sections',
  'content_blocks',
  'page_drafts',
  'content_block_drafts',
  'page_versions',
  'page_templates',
  'events',
  'trails',
  'things_to_do',
  'local_places',
  'park_maps',
  'park_sites',
  'runbook_content',
];

for (const table of restoreOrder) {
  const rows = backup.tables[table];
  if (!Array.isArray(rows)) {
    throw new Error(`Backup table ${table} is missing or invalid.`);
  }
  if (rows.length === 0) {
    console.log(`${table}: no rows to restore`);
    continue;
  }

  for (let index = 0; index < rows.length; index += 200) {
    const batch = rows.slice(index, index + 200);
    const { error } = await sb.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      throw new Error(`${table} restore failed at row ${index + 1}: ${error.message}`);
    }
  }

  console.log(`${table}: restored ${rows.length} rows`);
}

console.log('Restore replay completed. No rows outside the export were deleted.');
