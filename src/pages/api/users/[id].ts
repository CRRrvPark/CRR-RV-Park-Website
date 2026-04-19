/**
 * /api/users/[id]
 *   GET    — single user details (any auth'd)
 *   DELETE — remove / deactivate user (owner only)
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();
    const { data, error } = await sb.from('app_users').select('*').eq('id', params.id).single();
    if (error) return json({ error: error.message }, 404);
    return json({ user: data });
  } catch (err) {
    return handleError(err);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireRole(request, 'remove_user');
    const sb = serverClient();

    const { data: target } = await sb.from('app_users').select('*').eq('id', params.id).single();
    if (!target) return json({ error: 'not found' }, 404);

    // The SQL trigger `trg_enforce_min_two_owners` will reject this if it
    // would leave fewer than 1 active owner. We let the trigger do the work
    // and surface its error.
    const { error } = await sb.from('app_users').update({ is_active: false }).eq('id', params.id);
    if (error) {
      if (error.message.includes('last active owner')) {
        return json({ error: error.message }, 409);
      }
      return json({ error: error.message }, 500);
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'user_removed',
      targetTable: 'app_users',
      targetId: params.id as string,
      targetLabel: `${target.display_name} <${target.email}>`,
      beforeValue: target,
      ...requestContext(request),
    });

    return json({ status: 'deactivated' });
  } catch (err) {
    return handleError(err);
  }
};
