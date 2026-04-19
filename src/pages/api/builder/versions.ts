/**
 * /api/builder/versions
 *
 * GET  ?slug=<pageSlug>&limit=50  — list versions for a page
 * POST { slug, data, label }      — create a manual snapshot
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);
    const slug = url.searchParams.get('slug');
    if (!slug) return json({ error: 'slug required' }, 400);

    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);

    const sb = serverClient();

    const { data: page } = await sb.from('pages').select('id').eq('slug', slug).single();
    if (!page) return json({ error: 'Page not found' }, 404);

    const { data: versions, error } = await sb
      .from('page_versions')
      .select('id, reason, label, saved_by, byte_size, created_at')
      .eq('page_id', page.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return json({ error: error.message }, 500);

    return json({ versions: versions ?? [] });
  } catch (err) {
    return handleError(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const { slug, data, label } = await request.json() as { slug: string; data: unknown; label?: string };
    if (!slug || !data) return json({ error: 'slug and data required' }, 400);

    const sb = serverClient();
    const { data: page } = await sb.from('pages').select('id').eq('slug', slug).single();
    if (!page) return json({ error: 'Page not found' }, 404);

    const { data: version, error } = await sb.from('page_versions').insert({
      page_id: page.id,
      data,
      reason: 'manual',
      label: label || null,
      saved_by: user.id,
    }).select('id, created_at').single();

    if (error) return json({ error: error.message }, 500);
    return json({ version });
  } catch (err) {
    return handleError(err);
  }
};
