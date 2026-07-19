/**
 * Crawl the public sitemap against a running local or production server.
 *
 * Usage:
 *   node scripts/verify-seo-live.mjs http://127.0.0.1:4321
 *   node scripts/verify-seo-live.mjs https://crookedriverranchrv.com
 */

const baseUrl = new URL(process.argv[2] || 'https://crookedriverranchrv.com');
const canonicalOrigin = 'https://crookedriverranchrv.com';
const failures = [];

function value(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function assert(condition, context, message) {
  if (!condition) failures.push(`${context}: ${message}`);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CRR-SEO-Verification/1.0' },
    redirect: 'follow',
  });
  return { response, text: await response.text() };
}

const sitemapRequestUrl = new URL('/sitemap.xml', baseUrl);
const { response: sitemapResponse, text: sitemapXml } = await fetchText(sitemapRequestUrl);
assert(sitemapResponse.status === 200, '/sitemap.xml', `expected 200, got ${sitemapResponse.status}`);
assert(
  sitemapResponse.headers.get('content-type')?.includes('application/xml'),
  '/sitemap.xml',
  'wrong content type',
);

const canonicalUrls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)]
  .map((match) => match[1])
  .filter((url) => !url.match(/\.(?:jpe?g|png|webp|avif|svg)$/i));

assert(canonicalUrls.length > 18, '/sitemap.xml', `only ${canonicalUrls.length} page URLs found`);
assert(new Set(canonicalUrls).size === canonicalUrls.length, '/sitemap.xml', 'contains duplicate page URLs');

let nextIndex = 0;
async function worker() {
  while (nextIndex < canonicalUrls.length) {
    const canonical = canonicalUrls[nextIndex++];
    const canonicalUrl = new URL(canonical);
    const requestUrl = new URL(`${canonicalUrl.pathname}${canonicalUrl.search}`, baseUrl);
    const context = canonicalUrl.pathname;
    try {
      const { response, text: html } = await fetchText(requestUrl);
      assert(response.status === 200, context, `expected 200, got ${response.status}`);
      if (response.status !== 200) continue;

      const title = value(html, /<title>([\s\S]*?)<\/title>/i);
      const description = value(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
      const pageCanonical = value(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
      const h1Count = (html.match(/<h1(?:\s|>)/gi) ?? []).length;

      assert(Boolean(title), context, 'missing title');
      assert(Boolean(description), context, 'missing description');
      assert(pageCanonical === canonical, context, `canonical mismatch (${pageCanonical || 'missing'})`);
      assert(/<meta\s+name="robots"\s+content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/i.test(html), context, 'missing full robots directives');
      assert(/<meta\s+property="og:title"/i.test(html), context, 'missing Open Graph metadata');
      assert(/<meta\s+name="twitter:card"/i.test(html), context, 'missing Twitter metadata');
      assert(/<script\s+type="application\/ld\+json"/i.test(html), context, 'missing JSON-LD');
      assert(h1Count === 1, context, `expected one H1, found ${h1Count}`);
      assert(context === '/' || html.includes('aria-label="Breadcrumb"'), context, 'missing visible breadcrumb');
      assert(html.includes('href="/privacy"'), context, 'missing privacy-policy link');
      assert(html.includes('href="/terms"'), context, 'missing website-terms link');
      assert(html.includes('href="/sitemap.xml"'), context, 'missing sitemap link');

      for (const raw of html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          JSON.parse(raw[1]);
        } catch (error) {
          failures.push(`${context}: invalid JSON-LD (${error.message})`);
        }
      }
    } catch (error) {
      failures.push(`${context}: request failed (${error.message})`);
    }
  }
}

await Promise.all(Array.from({ length: 10 }, () => worker()));

for (const invalidPath of [
  '/trails/definitely-not-a-real-trail',
  '/things-to-do/definitely-not-a-real-thing',
  '/sites/definitely-not-a-real-site',
]) {
  const response = await fetch(new URL(invalidPath, baseUrl), {
    headers: { 'User-Agent': 'CRR-SEO-Verification/1.0' },
    redirect: 'manual',
  });
  assert(response.status === 404, invalidPath, `expected hard 404, got ${response.status}`);
}

const robots = await fetch(new URL('/robots.txt', baseUrl));
const robotsText = await robots.text();
assert(robots.status === 200, '/robots.txt', `expected 200, got ${robots.status}`);
assert(
  robotsText.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`),
  '/robots.txt',
  'canonical sitemap declaration missing',
);

if (failures.length > 0) {
  console.error(`Live SEO crawl failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Live SEO crawl passed for ${canonicalUrls.length} sitemap pages at ${baseUrl.origin}.`);
