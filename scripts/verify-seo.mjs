/**
 * Post-build SEO contract.
 *
 * Validates every prerendered public HTML page without third-party packages.
 * SSR detail pages are covered by the same Base layout; their status and
 * sitemap behavior are exercised separately in browser/integration checks.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const CANONICAL_ORIGIN = 'https://crookedriverranchrv.com';
const failures = [];
const descriptions = new Map();
const canonicals = new Map();

function filesUnder(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

function oneMatch(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function record(condition, page, message) {
  if (!condition) failures.push(`${page}: ${message}`);
}

const htmlFiles = filesUnder(DIST)
  .filter((path) => path.endsWith('.html'))
  .filter((path) => !path.endsWith('__forms.html'));

for (const file of htmlFiles) {
  const page = relative(DIST, file).replaceAll('\\', '/');
  const html = readFileSync(file, 'utf8');
  const title = oneMatch(html, /<title>([\s\S]*?)<\/title>/i);
  const description = oneMatch(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const canonical = oneMatch(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const h1Count = (html.match(/<h1(?:\s|>)/gi) ?? []).length;

  record(Boolean(title), page, 'missing <title>');
  record(Boolean(description), page, 'missing meta description');
  record(description.length >= 70 && description.length <= 180, page, `description length is ${description.length}`);
  record(canonical.startsWith(CANONICAL_ORIGIN), page, `canonical is not on ${CANONICAL_ORIGIN}`);
  record(!canonical.startsWith('https://www.'), page, 'canonical uses redirecting www host');
  record(/<meta\s+name="robots"\s+content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/i.test(html), page, 'missing full robots preview directives');
  record(/<meta\s+property="og:title"/i.test(html), page, 'missing Open Graph title');
  record(/<meta\s+property="og:image:alt"/i.test(html), page, 'missing Open Graph image alt');
  record(/<meta\s+name="twitter:card"/i.test(html), page, 'missing Twitter card');
  record(/<link\s+rel="icon"\s+href="\/favicon\.svg"/i.test(html), page, 'missing favicon');
  record(/<link\s+rel="manifest"\s+href="\/site\.webmanifest"/i.test(html), page, 'missing web manifest');
  record(/<script\s+type="application\/ld\+json"/i.test(html), page, 'missing JSON-LD');
  record(h1Count === 1, page, `expected one H1, found ${h1Count}`);
  record(html.includes('href="/privacy"'), page, 'missing privacy-policy link');
  record(html.includes('href="/terms"'), page, 'missing website-terms link');

  for (const raw of html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(raw[1]);
    } catch (error) {
      failures.push(`${page}: invalid JSON-LD (${error.message})`);
    }
  }

  if (description) {
    const previous = descriptions.get(description);
    if (previous) failures.push(`${page}: duplicate description also used by ${previous}`);
    descriptions.set(description, page);
  }
  if (canonical) {
    const previous = canonicals.get(canonical);
    if (previous) failures.push(`${page}: duplicate canonical also used by ${previous}`);
    canonicals.set(canonical, page);
  }
}

const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
record(
  robots.includes(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`),
  'robots.txt',
  'sitemap declaration is missing or uses the wrong host',
);

if (failures.length > 0) {
  console.error(`SEO verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SEO verification passed for ${htmlFiles.length} prerendered public pages.`);
