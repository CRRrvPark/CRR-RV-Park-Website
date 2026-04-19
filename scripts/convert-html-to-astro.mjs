#!/usr/bin/env node
/**
 * convert-html-to-astro.mjs
 *
 * One-shot converter that takes the 11 hand-written HTML pages from the old
 * crr-rv-park-multipage directory and produces .astro pages that use the
 * shared <Base /> layout. The HTML body content is preserved verbatim — only
 * the head + nav + footer are extracted into props/components.
 *
 * Run once during initial Phase 1 migration. Output is then hand-tweaked
 * (rare) and committed to src/pages/. After Phase 2, content lives in
 * Supabase and these .astro pages render from the database instead of
 * holding hard-coded strings.
 *
 * Uses ONLY Node built-ins so it can run before npm install completes.
 *
 * Usage:
 *   node scripts/convert-html-to-astro.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE_DIR = resolve(ROOT, '..', 'crr-rv-park-multipage');
const OUT_DIR = resolve(ROOT, 'src', 'pages');

const PAGES = [
  'index.html',
  'book-now.html',
  'amenities.html',
  'area-guide.html',
  'extended-stays.html',
  'golf-course.html',
  'golf-stays.html',
  'group-sites.html',
  'park-policies.html',
  'privacy.html',
  'terms.html',
];

function extractMatch(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function extractAllMatches(html, regex) {
  const out = [];
  let m;
  while ((m = regex.exec(html)) !== null) out.push(m[1].trim());
  return out;
}

/**
 * Extract the content=".*" attribute value for a meta tag. Handles both
 * double- and single-quoted attribute values, and crucially allows the
 * OPPOSITE quote character inside the value (so an apostrophe inside
 * a double-quoted string doesn't truncate).
 */
function extractMeta(html, name, attr = 'name') {
  const patterns = [
    // content="..." allowing ' inside
    new RegExp(`<meta\\s+${attr}=["']${name}["']\\s+content="([^"]*)"`, 'i'),
    // content='...' allowing " inside
    new RegExp(`<meta\\s+${attr}=["']${name}["']\\s+content='([^']*)'`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function extractCanonical(html) {
  const m = html.match(/<link\s+rel=["']canonical["']\s+href="([^"]*)"/i)
         ?? html.match(/<link\s+rel=["']canonical["']\s+href='([^']*)'/i);
  return m ? m[1] : null;
}

function extractHeroPreload(html) {
  const m = html.match(/<link\s+rel=["']preload["']\s+as=["']image["']\s+href="([^"]*)"/i)
         ?? html.match(/<link\s+rel=["']preload["']\s+as=["']image["']\s+href='([^']*)'/i);
  return m ? '/' + m[1].replace(/^\.?\//, '') : null;
}

function extractJsonLdSchemas(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch (e) {
      console.warn(`  ! Could not parse JSON-LD block (will be skipped): ${e.message}`);
    }
  }
  return blocks;
}

function extractBody(html) {
  // Grab everything between </nav> and <footer>
  // (the body of the page; nav and footer are now in Base layout)
  const navClose = html.indexOf('</nav>');
  const footerOpen = html.indexOf('<footer>');
  if (navClose === -1 || footerOpen === -1) {
    throw new Error('Could not locate </nav> ... <footer> markers');
  }
  let body = html.slice(navClose + '</nav>'.length, footerOpen);
  return body.trim();
}

function rewriteAssetPaths(body) {
  // images/foo.jpg → /images/foo.jpg
  body = body.replace(/(["'(])images\//g, '$1/images/');
  // page.html → /page.html (only for .html refs that are local pages)
  // Match href="something.html" but not href="https://..." or href="/already.html"
  body = body.replace(
    /href=["']([a-z0-9_-]+\.html(?:#[^"']*)?)["']/gi,
    (match, p1) => `href="/${p1}"`
  );
  // Also handle data-href, src= for completeness — not used in current pages but safe
  return body;
}

function buildFrontmatter({ title, description, canonical, ogImage, heroPreload, schemas }) {
  // Use JSON.stringify for safe escaping of strings; format as TypeScript array literal
  const schemasLiteral = schemas.length
    ? JSON.stringify(schemas, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : '  ' + line))
        .join('\n')
    : '[]';

  const lines = [
    '---',
    "import Base from '@layouts/Base.astro';",
    '',
    `const title = ${JSON.stringify(title)};`,
    `const description = ${JSON.stringify(description)};`,
    `const canonical = ${JSON.stringify(canonical)};`,
  ];
  if (ogImage) lines.push(`const ogImage = ${JSON.stringify(ogImage)};`);
  if (heroPreload) lines.push(`const heroImagePreload = ${JSON.stringify(heroPreload)};`);
  lines.push('');
  lines.push(`const schemas = ${schemasLiteral};`);
  lines.push('---');
  return lines.join('\n');
}

function buildAstroFile(meta, body) {
  const frontmatter = buildFrontmatter(meta);
  const propsLine = [
    'title={title}',
    'description={description}',
    'canonical={canonical}',
    meta.ogImage ? 'ogImage={ogImage}' : null,
    meta.heroPreload ? 'heroImagePreload={heroImagePreload}' : null,
    'schemas={schemas}',
  ].filter(Boolean).join(' ');

  return `${frontmatter}
<Base ${propsLine}>
${body}
</Base>
`;
}

function convertOne(filename) {
  const inPath = join(SOURCE_DIR, filename);
  const html = readFileSync(inPath, 'utf8');

  const title = extractMatch(html, /<title>([^<]+)<\/title>/i);
  const description = extractMeta(html, 'description');
  const canonical = extractCanonical(html);
  const ogImage = extractMeta(html, 'og:image', 'property');
  const heroPreload = extractHeroPreload(html);
  const schemas = extractJsonLdSchemas(html);

  const body = rewriteAssetPaths(extractBody(html));

  const outName = basename(filename, '.html') + '.astro';
  const outPath = join(OUT_DIR, outName);

  const out = buildAstroFile(
    { title, description, canonical, ogImage, heroPreload, schemas },
    body
  );

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(outPath, out, 'utf8');

  console.log(`  ✓ ${filename} → src/pages/${outName}` +
    `  (${schemas.length} schema${schemas.length === 1 ? '' : 's'}, ${body.length} chars)`);
}

console.log(`Converting ${PAGES.length} HTML pages from:`);
console.log(`  ${SOURCE_DIR}`);
console.log(`to:`);
console.log(`  ${OUT_DIR}`);
console.log('');

let ok = 0, fail = 0;
for (const page of PAGES) {
  try {
    convertOne(page);
    ok++;
  } catch (err) {
    console.error(`  ✗ ${page}: ${err.message}`);
    fail++;
  }
}

console.log('');
console.log(`Done. ${ok} succeeded, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
