/**
 * GET /api/zoho/authorize
 *
 * Kicks off the Zoho OAuth flow. Generates a cryptographically random state,
 * stores it in an HTTP-only cookie, and redirects the owner's browser to
 * Zoho's consent screen. The /oauth-callback handler verifies that the state
 * returned in the querystring matches the cookie (prevents OAuth CSRF).
 *
 * Owner-only — matches the oauth-callback gate.
 */

import type { APIRoute } from 'astro';
import { buildAuthorizationUrl } from '@lib/zoho';
import { requireRole, handleError } from '@lib/api';
import { ForbiddenError } from '@lib/rbac';

export const prerender = false;

const STATE_COOKIE = 'zoho_oauth_state';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    await requireRole(request, 'manage_zoho_integration');
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return new Response('Only owners can connect Zoho.', { status: 403 });
    }
    return handleError(err);
  }

  // Generate a 32-byte random state value. Base64url for URL-safety.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Buffer.from(bytes).toString('base64url');

  // Store in an HTTP-only, SameSite=Lax, short-lived cookie. Lax is required
  // because the browser returns from Zoho via a top-level redirect (not a
  // fetch), and Strict would drop the cookie on that cross-site navigation.
  cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes — plenty of time to click through consent
  });

  return redirect(buildAuthorizationUrl(state), 302);
};
