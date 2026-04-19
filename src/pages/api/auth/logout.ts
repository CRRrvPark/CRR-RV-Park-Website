/**
 * POST /api/auth/logout
 *
 * Logs the server-side audit event for the logout (client-side signOut
 * revokes the Supabase session; this endpoint records the audit trail).
 */

import type { APIRoute } from 'astro';
import { verifyRequestUser } from '@lib/auth';
import { logAudit, requestContext } from '@lib/audit';
import { json } from '@lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await verifyRequestUser(request);
  if (user) {
    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'logout',
      ...requestContext(request),
    });
  }
  return json({ status: 'ok' });
};
