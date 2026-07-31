/**
 * GET /api/snapshots/[id] — fetch a specific snapshot (full state blob)
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();
    const { data, error } = await sb.from('snapshots').select('*').eq('id', params.id).single();
    if (error) return json({ error: error.message }, 404);
    return json({ snapshot: data });
  } catch (err) {
    return handleError(err);
  }
};
