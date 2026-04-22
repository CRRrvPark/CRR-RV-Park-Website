/**
 * Site visibility — controls whether each public page is live.
 *
 * Every page that has a row in the `pages` table gets a DB-driven toggle
 * via the Pages admin (`is_draft` column). This module is the single
 * source of truth the hand-authored .astro routes use to gate themselves:
 * if the matching `pages` row is a draft, the route returns 404.
 *
 * Pages that don't live in the `pages` table are always visible — they
 * either have no admin affordance (system-only) or they're listing
 * pages like the home page that can't be unpublished.
 *
 * Reads are cached per serverless instance for CACHE_TTL_MS to avoid a
 * DB roundtrip on every request. The Pages admin PATCH invalidates via
 * the normal deploy cycle; within a live instance the cache expires on
 * its own shortly after.
 */

import { serverClient } from './supabase';

const CACHE_TTL_MS = 30 * 1000;

let cache: { loadedAt: number; hidden: Set<string> } | null = null;

async function getHiddenSlugs(): Promise<Set<string>> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.hidden;
  }
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('pages')
      .select('slug')
      .eq('is_draft', true);
    const hidden = new Set<string>((data ?? []).map((r) => r.slug as string));
    cache = { loadedAt: Date.now(), hidden };
    return hidden;
  } catch {
    // If the DB is unreachable, fail open (show the page) — better to serve
    // an unfinished page briefly than to 404 the whole site.
    return new Set();
  }
}

/**
 * Slugs whose public routes should 404 right now (drafts). Returns a Set
 * of slugs WITHOUT the leading slash. Prefer this over per-path
 * `isRouteHidden` calls when you need to make several checks in one
 * render pass (same data, one query).
 */
export async function getHiddenPageSlugs(): Promise<Set<string>> {
  return getHiddenSlugs();
}

/** True if the public route for `pathname` should 404. */
export async function isRouteHidden(pathname: string): Promise<boolean> {
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const slug = trimmed.replace(/^\//, '');
  if (!slug) return false; // home page is never hidden
  const hidden = await getHiddenSlugs();
  return hidden.has(slug);
}
