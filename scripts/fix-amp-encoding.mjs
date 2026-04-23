#!/usr/bin/env node
/**
 * fix-amp-encoding.mjs — strip HTML-encoded `&amp;` from Puck text
 * fields that get rendered as plain text (and were therefore
 * double-encoded somewhere in the editor's save path).
 *
 * Touches every page row's page_builder_data, recursively walking
 * the props of every block. Decodes `&amp;` → `&` in string values
 * EXCEPT for the `code` field of HtmlEmbed blocks (where the entity
 * is legitimate HTML). Idempotent.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const text = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  return text.split(/\r?\n/).filter(l => l && !l.startsWith('#')).reduce((a, l) => {
    const i = l.indexOf('=');
    if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    return a;
  }, {});
}

const env = loadEnv();
const SB_URL = env.PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

function decodeAmp(str) {
  // Decode common entities that get double-encoded by the rich-text
  // editor when content goes through it twice. Order matters:
  // decode &amp; LAST so we don't unescape entities meant to be
  // rendered as text (e.g., the literal word "&amp;").
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function walk(node, parentKey, blockType) {
  if (Array.isArray(node)) return node.map(n => walk(n, parentKey, blockType));
  if (node && typeof node === 'object') {
    const out = {};
    const newType = node.type ?? blockType;
    for (const [k, v] of Object.entries(node)) {
      out[k] = walk(v, k, newType);
    }
    return out;
  }
  if (typeof node === 'string') {
    // Don't touch HtmlEmbed.code or any field literally named
    // "code"/"html"/"body" — those legitimately hold HTML.
    if (parentKey === 'code' || parentKey === 'html' || parentKey === 'body') return node;
    if (blockType === 'HtmlEmbed' && parentKey === 'code') return node;
    return decodeAmp(node);
  }
  return node;
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const rows = await (await fetch(`${SB_URL}/rest/v1/pages?select=slug,page_builder_data`, { headers: sbHeaders })).json();

  let touched = 0;
  for (const r of rows) {
    if (!r.page_builder_data) continue;
    const before = JSON.stringify(r.page_builder_data);
    const after = walk(r.page_builder_data);
    const afterJson = JSON.stringify(after);
    if (before === afterJson) continue;

    // Count entities removed for the log
    const removed = (before.match(/&amp;|&lt;|&gt;|&quot;|&#39;/g) || []).length
                  - (afterJson.match(/&amp;|&lt;|&gt;|&quot;|&#39;/g) || []).length;
    console.log(`${r.slug}: decoded ${removed} entities`);
    touched++;

    if (!dryRun) {
      const u = await fetch(`${SB_URL}/rest/v1/pages?slug=eq.${encodeURIComponent(r.slug)}`, {
        method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ page_builder_data: after }),
      });
      if (!u.ok) console.log(`  ⚠ DB write failed: ${u.status} ${await u.text()}`);
    }
  }
  console.log(`\n${touched} page${touched === 1 ? '' : 's'} touched.${dryRun ? ' (dry run)' : ''}`);
})();
