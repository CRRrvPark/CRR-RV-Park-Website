/**
 * GET /api/publish/status?id=<publishId>
 *
 * Returns the current state of a publish row (queued/building/success/failed).
 * Called by the admin dashboard to poll publish progress.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id query param required' }, 400);

    const sb = serverClient();
    const { data, error } = await sb.from('publishes').select('*').eq('id', id).single();
    if (error) return json({ error: error.message }, 404);

    return json({ publish: data });
  } catch (err) {
    return handleError(err);
  }
};
