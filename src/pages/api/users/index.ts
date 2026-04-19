/**
 * /api/users
 *   GET   — list users (gated on `view_users` capability — viewer+)
 *   POST  — invite a new user (owner only)
 *   PATCH — change a user's role or active status (owner only)
 *
 * The DELETE is served by /api/users/[id] (BUG-1).
 *
 * The min-2-owners rule is enforced by the SQL trigger trg_enforce_min_two_owners.
 * If you try to demote the last owner, the database will throw and we surface
 * a friendly error here.
 */

import type { APIRoute } from 'astro';
import { verifyRequestUser } from '@lib/auth';

export const prerender = false;
import { requireCapability, ForbiddenError, type UserRole } from '@lib/rbac';
import { serverClient } from '@lib/supabase';
import { logAudit, requestContext } from '@lib/audit';

/** Runtime-validated list of role values (MEDIUM-6). Keeps us honest when
 *  clients send arbitrary role strings — the TS type is erased at runtime. */
const VALID_ROLES: UserRole[] = ['owner', 'editor', 'contributor', 'viewer'];
function isValidRole(r: unknown): r is UserRole {
  return typeof r === 'string' && (VALID_ROLES as string[]).includes(r);
}

export const GET: APIRoute = async ({ request }) => {
  const user = await verifyRequestUser(request);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  // MEDIUM-1: require the `view_users` capability — prevents silent leak
  // of the invite list to anyone who happens to be authenticated.
  try {
    requireCapability(user.role, 'view_users');
  } catch (err) {
    if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
    throw err;
  }

  const sb = serverClient();
  const { data, error } = await sb.from('app_users').select('*').order('created_at');
  if (error) return json({ error: error.message }, 500);
  return json({ users: data });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await verifyRequestUser(request);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  try {
    requireCapability(user.role, 'invite_user');
  } catch (err) {
    if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
    throw err;
  }

  const { email, displayName, role } = await request.json() as {
    email: string;
    displayName: string;
    role: unknown;
  };

  if (!isValidRole(role)) {
    return json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400);
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400);
  }
  if (typeof displayName !== 'string' || displayName.trim().length === 0) {
    return json({ error: 'displayName required' }, 400);
  }

  const sb = serverClient();
  // Send Supabase magic link invite
  const { data: invite, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.SITE_URL}/admin/login`,
  });
  if (inviteErr || !invite?.user) {
    return json({ error: inviteErr?.message ?? 'invite failed' }, 500);
  }

  // Create app_users row
  const { error: rowErr } = await sb.from('app_users').insert({
    id: invite.user.id,
    email,
    display_name: displayName,
    role,
    invited_by: user.id,
    is_active: true,
  });
  if (rowErr) return json({ error: rowErr.message }, 500);

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'user_invited',
    targetTable: 'app_users',
    targetId: invite.user.id,
    targetLabel: `${displayName} <${email}>`,
    afterValue: { email, role, displayName },
    ...requestContext(request),
  });

  return json({ status: 'invited', userId: invite.user.id });
};

export const PATCH: APIRoute = async ({ request }) => {
  const user = await verifyRequestUser(request);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  try {
    requireCapability(user.role, 'change_user_role');
  } catch (err) {
    if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
    throw err;
  }

  const { userId, role, isActive } = await request.json() as {
    userId: string;
    role?: unknown;
    isActive?: unknown;
  };

  if (!userId || typeof userId !== 'string') {
    return json({ error: 'userId required' }, 400);
  }
  if (role !== undefined && !isValidRole(role)) {
    return json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400);
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return json({ error: 'isActive must be a boolean' }, 400);
  }

  const sb = serverClient();
  const { data: before } = await sb.from('app_users').select('*').eq('id', userId).single();
  if (!before) return json({ error: 'user not found' }, 404);

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.is_active = isActive;

  const { error } = await sb.from('app_users').update(updates).eq('id', userId);
  if (error) {
    // SQL trigger error for last-owner demotion has a recognizable message
    if (error.message.includes('last active owner')) {
      return json({ error: error.message }, 409);
    }
    return json({ error: error.message }, 500);
  }

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'role_changed',
    targetTable: 'app_users',
    targetId: userId,
    targetLabel: `${before.display_name} <${before.email}>`,
    beforeValue: before,
    afterValue: { ...before, ...updates },
    ...requestContext(request),
  });

  return json({ status: 'updated' });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
