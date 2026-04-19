#!/usr/bin/env node
/**
 * supabase-migrate.mjs
 *
 * Applies all *.sql files under supabase/migrations/ in sorted order.
 * Tracks applied migrations in a `_migrations` table so re-running is safe.
 *
 * Requires these env vars (from .env):
 *   PUBLIC_SUPABASE_URL       — the project URL
 *   SUPABASE_SERVICE_ROLE_KEY — the service role key (server-only secret)
 *
 * Usage:
 *   npm run db:migrate
 *
 * Uses the postgres-meta REST endpoint (`POST /pg-meta/query`) so we don't
 * need the pg client library or direct DB credentials — just the service key.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = resolve(ROOT, 'supabase', 'migrations');

// Load .env (minimal parser — no external dep needed)
loadDotenv(resolve(ROOT, '.env'));

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  console.error('       Copy .env.example to .env and fill in values from your Supabase project.');
  process.exit(1);
}

async function runSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SQL execution failed: ${res.status} ${err}`);
  }
  // exec_sql returns void → body is empty. Don't assume JSON.
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function ensureMigrationsTable() {
  // Try to create the tracking table. If it already exists, this is a no-op.
  // We can't use `runSql` to bootstrap itself, so we use the postgres-meta API
  // via Supabase's SQL endpoint directly through the REST layer.
  // Simpler approach: the user runs this file's contents once manually in the
  // SQL editor. For now, we skip tracking on first run if the table is absent.
  try {
    await runSql(`
      create table if not exists _migrations (
        filename text primary key,
        applied_at timestamptz default now()
      );
    `);
    return true;
  } catch (err) {
    console.warn('Could not auto-create _migrations table. You may need to run this SQL manually first:');
    console.warn(`
-- One-time bootstrap: paste into Supabase SQL Editor
create table if not exists _migrations (
  filename text primary key,
  applied_at timestamptz default now()
);
create or replace function exec_sql(sql text) returns void language plpgsql security definer as $$
begin execute sql; end;
$$;
`);
    return false;
  }
}

async function listAppliedMigrations() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/_migrations?select=filename`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) return new Set();
  const rows = await res.json();
  return new Set(rows.map((r) => r.filename));
}

async function recordMigration(filename) {
  await fetch(`${SUPABASE_URL}/rest/v1/_migrations`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ filename }),
  });
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
      // Strip inline `# comment` suffix (requires whitespace before # so values
      // that legitimately contain # aren't mangled)
      val = val.replace(/\s+#.*$/, '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env is optional — env vars may be set elsewhere
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found in supabase/migrations/');
    return;
  }

  console.log(`Found ${files.length} migration file(s):`);
  files.forEach((f) => console.log(`  - ${f}`));
  console.log('');

  const haveTracking = await ensureMigrationsTable();
  const applied = haveTracking ? await listAppliedMigrations() : new Set();

  let ran = 0, skipped = 0, failed = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ↷ ${file} (already applied)`);
      skipped++;
      continue;
    }
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
    try {
      process.stdout.write(`  → ${file} … `);
      await runSql(sql);
      await recordMigration(file);
      console.log('OK');
      ran++;
    } catch (err) {
      console.log('FAILED');
      console.error('    ', err.message);
      failed++;
      break; // stop on first failure
    }
  }

  console.log('');
  console.log(`Done. Ran: ${ran}, skipped: ${skipped}, failed: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
