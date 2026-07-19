#!/usr/bin/env node
/**
 * backup-site-state.mjs
 *
 * Captures the guest-facing and content-management state needed to restore
 * the pre-remodel website. Secrets, authentication users, audit logs,
 * analytics events, OAuth tokens, and reservation data are intentionally
 * excluded.
 *
 * The JSON export is written beneath scripts/_backups/ (gitignored). A second
 * copy of the core CMS state is stored in the existing Supabase snapshots
 * table so it remains available from the production infrastructure.
 *
 * Usage:
 *   node scripts/backup-site-state.mjs
 *   node scripts/backup-site-state.mjs --label pre-v3-remodel-2026-07-19
 */

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const labelIndex = args.indexOf('--label');
const label = labelIndex >= 0 && args[labelIndex + 1]
  ? args[labelIndex + 1].replace(/[^a-z0-9._-]+/gi, '-')
  : `site-state-${new Date().toISOString().replace(/[:.]/g, '-')}`;

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const sb = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  'pages',
  'sections',
  'content_blocks',
  'content_block_drafts',
  'page_drafts',
  'page_versions',
  'page_templates',
  'media',
  'events',
  'trails',
  'things_to_do',
  'local_places',
  'park_sites',
  'park_maps',
  'runbook_content',
];

async function readAll(table) {
  const rows = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

const capturedAt = new Date().toISOString();
const tables = {};

for (const table of TABLES) {
  tables[table] = await readAll(table);
  console.log(`${table}: ${tables[table].length} rows`);
}

const exportState = {
  format: 'crr-rv-park-site-state',
  formatVersion: 1,
  label,
  capturedAt,
  source: new URL(url).hostname,
  exclusions: [
    'auth.users and app_users',
    'zoho_tokens and environment secrets',
    'audit_log, conversion_events, publishes, and sync_runs',
    'reservation and payment data (not stored in this project database)',
    'Supabase Storage objects (left intact; media URLs and metadata are included)',
  ],
  restoreOrder: [
    'pages',
    'sections',
    'content_blocks',
    'content_block_drafts',
    'page_drafts',
    'page_versions',
    'page_templates',
    'media',
    'events',
    'trails',
    'things_to_do',
    'local_places',
    'park_maps',
    'park_sites',
    'runbook_content',
  ],
  tables,
};

const outputDir = resolve('scripts', '_backups', label);
const outputPath = resolve(outputDir, 'site-state.json');
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(exportState, null, 2)}\n`, 'utf8');

const snapshotState = {
  pages: tables.pages,
  sections: tables.sections,
  content_blocks: tables.content_blocks,
  media: tables.media,
  events: tables.events,
  capturedAt,
  backupLabel: label,
};
const snapshotJson = JSON.stringify(snapshotState);
const { data: snapshot, error: snapshotError } = await sb
  .from('snapshots')
  .insert({
    triggered_by: null,
    reason: 'pre_v3_production_remodel',
    state: snapshotState,
    byte_size: Buffer.byteLength(snapshotJson, 'utf8'),
  })
  .select('id')
  .single();

if (snapshotError) {
  throw new Error(`Local export succeeded, but Supabase snapshot failed: ${snapshotError.message}`);
}

console.log(`Local export: ${outputPath}`);
console.log(`Supabase snapshot: ${snapshot.id}`);
