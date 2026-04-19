/**
 * GET /api/audit/log — paginated audit log for the admin dashboard
 *
 * Query params:
 *   ?limit=50              (default 50, max 200)
 *   ?before=ISO            (cursor — return entries before this timestamp)
 *   ?actor=uuid            (filter by user)
 *   ?action=content_edit   (filter by action type)
 *   ?target_table=...
 */

import type { APIRoute } from 'astro';
import { verifyRequestUser } from '@lib/auth';

export const prerender = false;
import { serverClient } from '@lib/supabase';

export const GET: APIRoute = async ({ request, url }) => {
  const user = await verifyRequestUser(request);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const before = url.searchParams.get('before');
  const actor = url.searchParams.get('actor');
  const action = url.searchParams.get('action');
  const targetTable = url.searchParams.get('target_table');

  const sb = serverClient();
  let q = sb.from('audit_log').select('*').order('occurred_at', { ascending: false }).limit(limit);
  if (before) q = q.lt('occurred_at', before);
  if (actor) q = q.eq('actor_id', actor);
  if (action) q = q.eq('action', action);
  if (targetTable) q = q.eq('target_table', targetTable);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const nextCursor = data && data.length === limit ? data[data.length - 1].occurred_at : null;

  return json({ entries: data, nextCursor });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
