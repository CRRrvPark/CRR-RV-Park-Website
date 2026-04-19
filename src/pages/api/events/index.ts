/**
 * GET /api/events — list all events (past + future), auth'd
 */
import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);
    const scope = url.searchParams.get('scope') ?? 'upcoming';
    const sb = serverClient();
    let q = sb.from('events').select('*').order('starts_at', { ascending: scope === 'upcoming' });
    const now = new Date().toISOString();
    if (scope === 'upcoming') q = q.gte('starts_at', now);
    if (scope === 'past') q = q.lt('starts_at', now);
    const { data, error } = await q.limit(200);
    if (error) return json({ error: error.message }, 500);
    return json({ events: data });
  } catch (err) {
    return handleError(err);
  }
};
