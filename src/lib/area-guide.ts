/**
 * area-guide.ts — read helpers for /trails, /things-to-do, /area-guide,
 * and the clickable park-site map.
 *
 * All functions are server-only (they use `serverClient()` which requires
 * the service-role key). Meant to be called from Astro frontmatter during
 * prerender or SSR. Never import into a client component.
 *
 * If Supabase env vars aren't set (e.g. local dev without .env), every
 * function returns an empty array/null rather than throwing, so public
 * pages render with zero content instead of 500ing.
 */

import { serverClient } from './supabase';
import { HIDDEN_ROUTES } from './site-visibility';

const SUPABASE_CONFIGURED = Boolean(
  import.meta.env.PUBLIC_SUPABASE_URL ??
    (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : undefined),
);

export interface Trail {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  distance_miles: number | null;
  elevation_gain_feet: number | null;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert' | null;
  pet_friendly: boolean;
  kid_friendly: boolean;
  hazards: string[];
  hero_image_url: string | null;
  gallery_image_urls: string[];
  trailhead_lat: number | null;
  trailhead_lng: number | null;
  parking_info: string | null;
  season: string | null;
  drive_time_from_park: string | null;
  external_link: string | null;
  is_on_property: boolean;
  is_published: boolean;
  display_order: number;
}

export type ThingCategory =
  | 'families'
  | 'active'
  | 'rvers'
  | 'dogs'
  | 'day_trippers'
  | 'winter'
  | 'food_community';

export interface ThingToDo {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: ThingCategory;
  personas: ThingCategory[];
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  distance_from_park: string | null;
  hero_image_url: string | null;
  gallery_image_urls: string[];
  icon: string | null;
  external_link: string | null;
  details_html: string | null;
  is_published: boolean;
  display_order: number;
}

export interface LocalPlace {
  id: string;
  slug: string | null;
  name_override: string | null;
  google_place_id: string;
  category: 'restaurant' | 'brewery' | 'coffee' | 'shop' | 'attraction' | 'other';
  our_description: string | null;
  featured: boolean;
  is_published: boolean;
  display_order: number;
  cached_data: PlaceCachedData | null;
  cached_at: string | null;
}

/** Subset of Google Places API (New) response we persist for render. */
export interface PlaceCachedData {
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  photos?: { name: string; widthPx?: number; heightPx?: number }[];
  editorialSummary?: { text: string };
  types?: string[];
  location?: { latitude: number; longitude: number };
}

export type ParkSiteStatus =
  | 'available'
  | 'camp_host'
  | 'staff_only'
  | 'maintenance'
  | 'reserved'
  | 'seasonal_closed';

export interface ParkSite {
  id: string;
  site_number: string;
  loop: string;
  length_feet: number | null;
  width_feet: number | null;
  pull_through: boolean;
  amp_service: number | null;
  site_type: string | null;
  nightly_rate: number | null;
  weekly_rate: number | null;
  monthly_rate: number | null;
  hero_image_url: string | null;
  gallery_image_urls: string[];
  description: string | null;
  features: string[];
  map_position_x: number | null;
  map_position_y: number | null;
  map_polygon: Array<[number, number]> | null;
  firefly_deep_link: string | null;
  is_available: boolean;
  is_published: boolean;
  status: ParkSiteStatus;
  status_note: string | null;
}

// ---- Readers (published-only — public-site flavored) ----

export async function getTrails(): Promise<Trail[]> {
  if (!SUPABASE_CONFIGURED) return [];
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('trails')
      .select('*')
      .eq('is_published', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    return (data ?? []) as Trail[];
  } catch (err) {
    console.warn('[area-guide] getTrails failed:', err);
    return [];
  }
}

export async function getTrailBySlug(slug: string): Promise<Trail | null> {
  if (!SUPABASE_CONFIGURED) return null;
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('trails')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    return (data as Trail) ?? null;
  } catch (err) {
    console.warn(`[area-guide] getTrailBySlug(${slug}) failed:`, err);
    return null;
  }
}

export async function getThingsToDo(): Promise<ThingToDo[]> {
  if (!SUPABASE_CONFIGURED) return [];
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('things_to_do')
      .select('*')
      .eq('is_published', true)
      .order('display_order', { ascending: true })
      .order('title', { ascending: true });
    return (data ?? []) as ThingToDo[];
  } catch (err) {
    console.warn('[area-guide] getThingsToDo failed:', err);
    return [];
  }
}

export async function getThingBySlug(slug: string): Promise<ThingToDo | null> {
  if (!SUPABASE_CONFIGURED) return null;
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('things_to_do')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    return (data as ThingToDo) ?? null;
  } catch (err) {
    console.warn(`[area-guide] getThingBySlug(${slug}) failed:`, err);
    return null;
  }
}

export async function getLocalPlaces(): Promise<LocalPlace[]> {
  if (!SUPABASE_CONFIGURED) return [];
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('local_places')
      .select('*')
      .eq('is_published', true)
      .order('display_order', { ascending: true });
    return (data ?? []) as LocalPlace[];
  } catch (err) {
    console.warn('[area-guide] getLocalPlaces failed:', err);
    return [];
  }
}

export async function getParkSites(): Promise<ParkSite[]> {
  if (!SUPABASE_CONFIGURED) return [];
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('park_sites')
      .select('*')
      .eq('is_published', true)
      .order('loop', { ascending: true })
      .order('site_number', { ascending: true });
    return (data ?? []) as ParkSite[];
  } catch (err) {
    console.warn('[area-guide] getParkSites failed:', err);
    return [];
  }
}

/**
 * Fetch a single published ParkSite by its code (e.g. "A-01", "1C").
 * Returns null when the site doesn't exist, is unpublished, or Supabase
 * isn't configured. Used by the /sites/[code] detail page.
 */
export async function getParkSiteByCode(siteNumber: string): Promise<ParkSite | null> {
  if (!SUPABASE_CONFIGURED) return null;
  try {
    const sb = serverClient();
    const { data } = await sb
      .from('park_sites')
      .select('*')
      .eq('site_number', siteNumber)
      .eq('is_published', true)
      .maybeSingle();
    return (data as ParkSite) ?? null;
  } catch (err) {
    console.warn(`[area-guide] getParkSiteByCode failed for ${siteNumber}:`, err);
    return null;
  }
}

// ---- Admin readers (include drafts / unpublished) ----

export async function getAllTrailsForAdmin(): Promise<Trail[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = serverClient();
  const { data } = await sb.from('trails').select('*').order('display_order');
  return (data ?? []) as Trail[];
}
export async function getAllThingsForAdmin(): Promise<ThingToDo[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = serverClient();
  const { data } = await sb.from('things_to_do').select('*').order('display_order');
  return (data ?? []) as ThingToDo[];
}
export async function getAllPlacesForAdmin(): Promise<LocalPlace[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = serverClient();
  const { data } = await sb.from('local_places').select('*').order('display_order');
  return (data ?? []) as LocalPlace[];
}
export async function getAllParkSitesForAdmin(): Promise<ParkSite[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = serverClient();
  const { data } = await sb
    .from('park_sites')
    .select('*')
    .order('loop')
    .order('site_number');
  return (data ?? []) as ParkSite[];
}

// ---- Formatting helpers ----

export const CATEGORY_LABELS: Record<ThingCategory, string> = {
  families: 'Families with Kids',
  active: 'Active & Outdoorsy',
  rvers: 'RVers & Slow Travelers',
  dogs: 'Dog Owners',
  day_trippers: 'Day Trippers & Sightseers',
  winter: 'Winter & Off-Season',
  food_community: 'Food, Drink & Community',
};

export const DIFFICULTY_LABELS: Record<NonNullable<Trail['difficulty']>, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  expert: 'Expert',
};

/**
 * Merged, category-tagged pin shape consumed by RegionMap.astro on the
 * Area Guide page. Pulls from trails, things_to_do, and local_places and
 * flags a curated "highlights" subset used as the default view.
 *
 * Categories collapse to a coarser vocabulary than the full Things-to-Do
 * list (which has 7 audience-personas) because the map UI shows one pill
 * per category and 10+ pills gets noisy. The map pill set:
 *   trails           → 🥾 Trails
 *   food_community   → 🍺 Food & Drink
 *   places_dining    → 🍴 Dining      (local_places: restaurant/brewery/coffee)
 *   places_attraction→ 🎡 Attractions (local_places: attraction/shop/other)
 *   families / active / rvers / dogs / day_trippers / winter → per-persona
 *
 * Pins without lat+lng are excluded server-side.
 */
export interface RegionPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  category: string;
  href?: string;
  iconEmoji?: string;
  description?: string;
  isDefault?: boolean;
}

export interface RegionPinCategory {
  key: string;
  label: string;
  emoji?: string;
}

export const REGION_PIN_CATEGORIES: RegionPinCategory[] = [
  { key: 'trails',            label: 'Trails',            emoji: '🥾' },
  { key: 'places_dining',     label: 'Dining',            emoji: '🍴' },
  { key: 'places_attraction', label: 'Attractions',       emoji: '🎡' },
  { key: 'families',          label: 'Families',          emoji: '👨‍👩‍👧' },
  { key: 'active',            label: 'Active',            emoji: '🥾' },
  { key: 'rvers',             label: 'RVers',             emoji: '🚐' },
  { key: 'dogs',              label: 'Dog Owners',        emoji: '🐕' },
  { key: 'day_trippers',      label: 'Day Trippers',      emoji: '🚗' },
  { key: 'winter',            label: 'Winter',            emoji: '❄' },
  { key: 'food_community',    label: 'Food & Community',  emoji: '🍺' },
];

/** Slugs the owner asked for as always-on defaults when they exist. */
const DEFAULT_PRIORITY_SLUGS = new Set([
  'smith-rock', 'smith-rock-state-park',
  'steelhead-falls', 'steelhead-falls-canyon-trails',
  'crescent-moon-alpacas', 'crescent-moon-alpaca-farm', 'alpaca-farm',
]);

/** How many pins to show by default when no filter is active. */
const DEFAULT_PIN_TARGET = 7;

function mapPlaceCategory(c: LocalPlace['category']): 'places_dining' | 'places_attraction' {
  return c === 'restaurant' || c === 'brewery' || c === 'coffee' ? 'places_dining' : 'places_attraction';
}

function placeEmoji(c: LocalPlace['category']): string {
  if (c === 'restaurant') return '🍴';
  if (c === 'brewery') return '🍺';
  if (c === 'coffee') return '☕';
  if (c === 'shop') return '🛍';
  return '📍';
}

function thingEmoji(t: ThingToDo): string {
  if (typeof t.icon === 'string' && t.icon.trim()) return t.icon.trim();
  if (t.category === 'families') return '👨‍👩‍👧';
  if (t.category === 'active') return '🥾';
  if (t.category === 'rvers') return '🚐';
  if (t.category === 'dogs') return '🐕';
  if (t.category === 'winter') return '❄';
  if (t.category === 'food_community') return '🍺';
  return '📍';
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  // Deterministic shuffle so builds within the same minute produce the
  // same "random" layout (prevents HTML churn on rebuild for no reason).
  const out = arr.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Fetch + merge + tag-default the pins the Area Guide map shows. Reads
 * trails, things_to_do, and local_places, filters to rows that have
 * lat/lng, tags a curated 5–8 pin default set, and returns pins ready
 * for serialization into RegionMap.astro.
 *
 * Safe to call when Supabase isn't configured (returns []).
 *
 * `seed` is used to deterministically pick the random portion of the
 * default set — pass `Math.floor(Date.now() / 60000)` for a fresh pick
 * per-minute, or a fixed value in tests.
 */
export async function getRegionMapPins(seed = 0): Promise<RegionPin[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const [trails, things, places] = await Promise.all([
    getTrails(),
    getThingsToDo(),
    getLocalPlaces(),
  ]);

  const pins: RegionPin[] = [];

  // Drop per-pin hrefs when their destination page is hidden — otherwise
  // the map popup's "Learn more →" link would 404. The pin itself still
  // renders; only the click-through is suppressed.
  const trailsHidden = HIDDEN_ROUTES.has('/trails');
  const thingsHidden = HIDDEN_ROUTES.has('/things-to-do');

  for (const t of trails) {
    if (t.trailhead_lat === null || t.trailhead_lng === null) continue;
    pins.push({
      id: `trail:${t.slug}`,
      lat: t.trailhead_lat,
      lng: t.trailhead_lng,
      title: t.name,
      category: 'trails',
      href: trailsHidden ? undefined : `/trails/${t.slug}`,
      iconEmoji: '🥾',
      description: t.summary ?? undefined,
    });
  }

  for (const thing of things) {
    if (thing.lat === null || thing.lng === null) continue;
    pins.push({
      id: `thing:${thing.slug}`,
      lat: thing.lat,
      lng: thing.lng,
      title: thing.title,
      category: thing.category,
      href: thingsHidden ? undefined : `/things-to-do/${thing.slug}`,
      iconEmoji: thingEmoji(thing),
      description: thing.summary ?? undefined,
    });
  }

  for (const p of places) {
    const loc = p.cached_data?.location;
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') continue;
    pins.push({
      id: `place:${p.id}`,
      lat: loc.latitude,
      lng: loc.longitude,
      title: p.name_override ?? p.cached_data?.displayName?.text ?? 'Local place',
      category: mapPlaceCategory(p.category),
      href: p.cached_data?.googleMapsUri,
      iconEmoji: placeEmoji(p.category),
      description: p.our_description ?? p.cached_data?.editorialSummary?.text ?? undefined,
    });
  }

  // Pick defaults: prioritized slugs first, then featured local_places,
  // then a random fill up to DEFAULT_PIN_TARGET.
  const picked = new Set<string>();
  for (const p of pins) {
    const slug = p.id.includes(':') ? p.id.split(':').slice(1).join(':') : p.id;
    if (DEFAULT_PRIORITY_SLUGS.has(slug)) picked.add(p.id);
  }
  for (const lp of places) {
    if (!lp.featured) continue;
    const pinId = `place:${lp.id}`;
    if (pins.some((q) => q.id === pinId)) picked.add(pinId);
    if (picked.size >= DEFAULT_PIN_TARGET) break;
  }
  if (picked.size < DEFAULT_PIN_TARGET) {
    const rest = pins.filter((p) => !picked.has(p.id));
    const shuffled = seededShuffle(rest, seed);
    for (const p of shuffled) {
      picked.add(p.id);
      if (picked.size >= DEFAULT_PIN_TARGET) break;
    }
  }

  return pins.map((p) => (picked.has(p.id) ? { ...p, isDefault: true } : p));
}

export function formatHazard(h: string): string {
  return h
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDistance(t: Trail): string {
  if (!t.distance_miles) return '';
  return `${t.distance_miles} mi`;
}

export function formatElevation(t: Trail): string {
  if (!t.elevation_gain_feet) return '';
  return `${t.elevation_gain_feet.toLocaleString()} ft gain`;
}
