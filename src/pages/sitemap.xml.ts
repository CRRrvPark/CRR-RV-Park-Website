import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { absoluteUrl, SITE_ORIGIN } from '@lib/seo';

export const prerender = false;

interface SitemapEntry {
  path: string;
  lastmod?: string | null;
  images?: string[];
}

const STATIC_LASTMOD = '2026-07-19';
const STATIC_ENTRIES: SitemapEntry[] = [
  { path: '/', images: ['/images/hero.jpg', '/images/northern-lights-chris-olson.jpg', '/images/site-a10-setup.webp', '/images/pool_aerial.jpg', '/images/firepit_evening.jpg'] },
  { path: '/sites', images: ['/images/aerial_aloop.jpg'] },
  { path: '/availability', images: ['/images/aerial_wide.jpg', '/images/rv_park_map.jpg'] },
  { path: '/park-map', images: ['/images/rv_park_map.jpg'] },
  { path: '/amenities', images: ['/images/pool_aerial.jpg', '/images/dog_welcome.jpg'] },
  { path: '/area-guide', images: ['/images/canyon_day.jpg', '/images/smith_rock.jpg'] },
  { path: '/trails', images: ['/images/smith_rock.jpg'] },
  { path: '/things-to-do', images: ['/images/central_oregon.jpg'] },
  { path: '/dining', images: ['/images/central_oregon.jpg'] },
  { path: '/events', images: ['/images/gazebo_fall.jpg'] },
  { path: '/book-now', images: ['/images/aerial_canyon_rim.jpg'] },
  { path: '/golf-course', images: ['/images/golf_course.jpg'] },
  { path: '/golf-stays', images: ['/images/golf_aerial_canyon.jpg'] },
  { path: '/group-sites', images: ['/images/family_reunion.jpg'] },
  { path: '/extended-stays', images: ['/images/winter_sunset.jpg'] },
  { path: '/park-policies', images: ['/images/firepit_evening.jpg'] },
  { path: '/about-this-website', images: ['/images/canyon_day.jpg'] },
  { path: '/privacy', images: ['/images/canyon_day.jpg'] },
  { path: '/terms', images: ['/images/canyon_day.jpg'] },
].map((entry) => ({ ...entry, lastmod: STATIC_LASTMOD }));

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeLastmod(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function imageUrl(value: string): string | null {
  try {
    const url = new URL(absoluteUrl(value));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function dynamicEntries(): Promise<SitemapEntry[]> {
  try {
    const sb = serverClient();
    const [trailsResult, thingsResult, sitesResult] = await Promise.all([
      sb.from('trails').select('slug,updated_at,hero_image_url').eq('is_published', true),
      sb.from('things_to_do').select('slug,updated_at,hero_image_url').eq('is_published', true),
      sb.from('park_sites').select('site_number,updated_at,hero_image_url').eq('is_published', true),
    ]);

    const errors = [trailsResult.error, thingsResult.error, sitesResult.error].filter(Boolean);
    if (errors.length > 0) throw errors[0];

    return [
      ...(trailsResult.data ?? []).map((row) => ({
        path: `/trails/${encodeURIComponent(row.slug)}`,
        lastmod: row.updated_at,
        images: row.hero_image_url ? [row.hero_image_url] : [],
      })),
      ...(thingsResult.data ?? []).map((row) => ({
        path: `/things-to-do/${encodeURIComponent(row.slug)}`,
        lastmod: row.updated_at,
        images: row.hero_image_url ? [row.hero_image_url] : [],
      })),
      ...(sitesResult.data ?? []).map((row) => ({
        path: `/sites/${encodeURIComponent(row.site_number)}`,
        lastmod: row.updated_at,
        images: row.hero_image_url ? [row.hero_image_url] : [],
      })),
    ];
  } catch (error) {
    console.warn('[sitemap] Dynamic URL lookup failed; serving static URLs only.', error);
    return [];
  }
}

export const GET: APIRoute = async () => {
  const entries = [...STATIC_ENTRIES, ...(await dynamicEntries())];
  const urls = entries.map((entry) => {
    const lastmod = safeLastmod(entry.lastmod);
    const images = (entry.images ?? [])
      .map(imageUrl)
      .filter((url): url is string => Boolean(url));
    return [
      '  <url>',
      `    <loc>${escapeXml(new URL(entry.path, `${SITE_ORIGIN}/`).toString())}</loc>`,
      ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
      ...images.map((url) => [
        '    <image:image>',
        `      <image:loc>${escapeXml(url)}</image:loc>`,
        '    </image:image>',
      ].join('\n')),
      '  </url>',
    ].join('\n');
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
