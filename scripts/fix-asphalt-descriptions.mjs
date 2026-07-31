#!/usr/bin/env node
/**
 * One-shot: remove false asphalt / "level once" claims from park_sites
 * descriptions. Only B1 may mention a paved pad (ADA).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const text = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  return text.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).reduce((a, l) => {
    const i = l.indexOf('=');
    if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    return a;
  }, {});
}

const env = loadEnv();
const SB_URL = env.PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('missing env');
  process.exit(1);
}
const headers = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const B1_DESCRIPTION =
  '<p>60 feet of paved pull-through (ADA) — long enough for big rigs, easy enough you\'ll be set up and unwinding before the afternoon turns to evening. Mature Birch trees frame the view; the canyon bluff and the sunset settle in to the west. Step outside the rig and the pool, the courts, the dog run, the gazebo, and the bathhouses are all an easy walk; the golf course is right there too. Hook up, settle in, breathe in the high-desert air — this is the kind of site that makes a long trip feel restful.</p>' +
  '<p><em>60 ft pull-through · 50-amp · full hookups, ADA Accessible, Not available for non-ADA until 3 days prior to arrival</em></p>';

function fixNonB1(description) {
  let d = description;
  d = d.replace(/smooth asphalt /gi, '');
  d = d.replace(/asphalt /gi, '');
  d = d.replace(/asphalt/gi, '');
  d = d.replace(/Hook up, level once, breathe in/g, 'Hook up, settle in, breathe in');
  return d;
}

async function patch(siteNumber, description) {
  const u = await fetch(
    `${SB_URL}/rest/v1/park_sites?site_number=eq.${encodeURIComponent(siteNumber)}`,
    { method: 'PATCH', headers, body: JSON.stringify({ description }) },
  );
  const body = await u.json();
  if (!u.ok) throw new Error(`${siteNumber}: ${u.status} ${JSON.stringify(body)}`);
  return body[0];
}

(async () => {
  // Always restore B1 correctly (prior one-liner mangled the length prefix).
  await patch('B1', B1_DESCRIPTION);
  console.log('OK B1');

  const r = await fetch(
    `${SB_URL}/rest/v1/park_sites?select=site_number,description&site_number=in.(B2,B3,B4,B5,B6,B7)&order=site_number`,
    { headers },
  );
  const sites = await r.json();
  for (const s of sites) {
    const next = fixNonB1(s.description || '');
    if (next !== s.description) {
      await patch(s.site_number, next);
      console.log('OK', s.site_number, '(patched)');
    } else {
      console.log('OK', s.site_number, '(already clean)');
    }
  }

  const v = await fetch(
    `${SB_URL}/rest/v1/park_sites?select=site_number,description&site_number=in.(B1,B2,B3,B4,B5,B6,B7)&order=site_number`,
    { headers },
  );
  const final = await v.json();
  let bad = 0;
  for (const s of final) {
    const plain = (s.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const hit = /asphalt|asphault|level once/i.test(plain);
    if (hit) bad++;
    console.log(hit ? 'BAD' : 'OK', s.site_number + ':', plain.slice(0, 160));
  }

  const leftover = await fetch(
    `${SB_URL}/rest/v1/park_sites?select=site_number&or=(description.ilike.*asphalt*,description.ilike.*asphault*,description.ilike.*level%20once*)`,
    { headers },
  );
  const left = await leftover.json();
  console.log('\nRemaining asphalt/asphault/level-once across all park_sites:', left.length);
  if (left.length) console.log(left);
  if (bad) process.exit(1);
})();
