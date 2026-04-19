/**
 * GET /api/zoho/oauth-callback?code=...&state=...
 *
 * The redirect target for the Zoho OAuth consent flow. Exchanges the auth
 * code for tokens and persists them in zoho_tokens.
 *
 * SECURITY (HIGH-5 in SECURITY-AND-BUGS-REPORT.md):
 *   1. Caller MUST have the `manage_zoho_integration` capability (owner-only).
 *      Without this, a lower-privileged user could complete the consent flow
 *      and point the site at an attacker-controlled Zoho account.
 *   2. `state` is verified against a short-lived `zoho_oauth_state` cookie
 *      set when the authorization URL was built (see /api/zoho/authorize).
 *      Without this, the callback is CSRF-able.
 */

import type { APIRoute } from 'astro';

export const prerender = false;
import { exchangeCodeForTokens, persistInitialTokens } from '@lib/zoho';
import { logAudit, requestContext } from '@lib/audit';
import { requireRole, handleError } from '@lib/api';
import { ForbiddenError } from '@lib/rbac';

const STATE_COOKIE = 'zoho_oauth_state';

export const GET: APIRoute = async ({ request, url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`Zoho authorization denied: ${error}`, { status: 400 });
  }
  if (!code) {
    return new Response('Missing ?code= in callback', { status: 400 });
  }

  // 1. Owner-only. `manage_zoho_integration` is already declared owner-only
  //    in src/lib/rbac.ts. Do not loosen it here.
  let user;
  try {
    user = await requireRole(request, 'manage_zoho_integration');
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return new Response('Only owners can complete the Zoho OAuth flow.', { status: 403 });
    }
    return handleError(err);
  }

  // 2. Verify the state parameter against the cookie set during /authorize.
  const expectedState = cookies.get(STATE_COOKIE)?.value;
  // Always clear the cookie — it's single-use.
  cookies.delete(STATE_COOKIE, { path: '/' });
  if (!expectedState || !state || !constantTimeEqual(state, expectedState)) {
    return new Response(
      'Invalid OAuth state parameter. Please retry the connect flow from Settings.',
      { status: 400 }
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await persistInitialTokens('workdrive', tokens, user.id);
    await persistInitialTokens('calendar', tokens, user.id);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'role_changed', // TODO: add 'integration_connected' to action enum
      notes: 'Zoho OAuth tokens connected (workdrive + calendar)',
      ...requestContext(request),
    });

    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zoho Connected</title></head>
      <body style="font-family:system-ui;padding:2rem;max-width:600px;">
        <h1>✓ Zoho Connected</h1>
        <p>WorkDrive and Calendar are now linked. You can close this window and return to the admin.</p>
        <p><a href="/admin">Back to admin →</a></p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err: any) {
    console.error('[zoho/oauth-callback]', err);
    return new Response(`Token exchange failed: ${err.message}`, { status: 500 });
  }
};

/** Constant-time string compare. Both sides are short fixed-length, but
 *  this guards against any timing side-channel in the cookie check. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
