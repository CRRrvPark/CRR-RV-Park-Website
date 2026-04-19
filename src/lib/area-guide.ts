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
