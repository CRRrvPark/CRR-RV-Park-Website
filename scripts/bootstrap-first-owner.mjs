#!/usr/bin/env node
/**
 * bootstrap-first-owner.mjs
 *
 * One-time: creates the very first admin user. After this, additional users
 * get created through the admin UI ("Invite user" flow), but the first user
 * has a chicken-and-egg problem — the admin UI requires a signed-in user to
 * invite someone, so the first user must be bootstrapped directly.
 *
 * Usage:
 *   npm run bootstrap:first-owner -- --email you@example.com --name "Your Name"
 *
 * Prompts for a password interactively so it's never echoed to history.
 *
 * Requires:
 *   PUBLIC_SUPABASE_URL        in .env
 *   SUPABASE_SERVICE_ROLE_KEY  in .env
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
loadDotenv(resolve(ROOT, '.env'));

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

// Parse CLI args
const args = parseArgs(process.argv.slice(2));
if (!args.email || !args.name) {
  console.error('Usage: npm run bootstrap:first-owner -- --email you@example.com --name "Your Name"');
  process.exit(1);
}

const password = await promptHidden('Password (min 12 chars, mixed case, number): ');
if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}

console.log('');
console.log(`Creating first owner: ${args.name} <${args.email}>`);
console.log('');

// Step 1: create auth user via Admin API
const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: args.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: args.name },
  }),
});

if (!createRes.ok) {
  const text = await createRes.text();
  console.error('Auth user creation failed:', createRes.status, text);
  process.exit(1);
}

const user = await createRes.json();
console.log(`  ✓ Auth user created: ${user.id}`);

// Step 2: insert app_users row with owner role
const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/app_users`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    id: user.id,
    email: args.email,
    display_name: args.name,
    role: 'owner',
    is_active: true,
  }),
});

if (!insertRes.ok) {
  const text = await insertRes.text();
  console.error('app_users row creation failed:', insertRes.status, text);
  console.error('Auth user was created but is orphaned. Delete from auth.users manually before retrying, OR insert the app_users row with SQL.');
  process.exit(1);
}

console.log(`  ✓ app_users row created with role=owner`);
console.log('');
console.log('Done. Sign in at:');
console.log(`  ${(process.env.SITE_URL ?? 'http://localhost:4321')}/admin/login`);
console.log('');
console.log('⚠  Remember: the system requires at least 2 active owners. Invite a second owner ASAP from the Users page.');

// ---------------------------------------------------------------------------
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
  } catch {}
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[k] = next;
        i++;
      } else {
        out[k] = true;
      }
    }
  }
  return out;
}

async function promptHidden(prompt) {
  const rl = createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => {
    // Node's readline doesn't natively hide input. For simplicity we use the
    // write-prompt-and-read approach. On Windows in a normal terminal the
    // characters echo; users are expected to run this in a private context.
    stdout.write(prompt);
    rl.question('', (answer) => { rl.close(); resolve(answer); });
  });
}
