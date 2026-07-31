/**
 * Shared API helpers — keep every endpoint in /api consistent.
 *
 * Patterns:
 *   - json(body, status)               — wrap a JSON response
 *   - requireAuth(request)             — 401 if unauthenticated; returns user otherwise
 *   - requireRole(request, capability) — 401/403 guard; returns user otherwise
 *   - handleError(err)                 — maps known errors to JSON responses
 */

import { verifyRequestUser, type AuthedUser } from './auth';
import { can, ForbiddenError, type Capability } from './rbac';
import { BannedWordError } from './content';

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export class UnauthenticatedError extends Error {
  status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export async function requireAuth(request: Request): Promise<AuthedUser> {
  const user = await verifyRequestUser(request);
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requireRole(request: Request, capability: Capability): Promise<AuthedUser> {
  const user = await requireAuth(request);
  if (!can(user.role, capability)) {
    throw new ForbiddenError(`This action requires capability: ${capability}`);
  }
  return user;
}

/**
 * SECURITY: gate for endpoints called by Netlify (webhook, scheduled
 * functions) where normal user-auth can't apply. Accepts either:
 *   - an authenticated user (admin manually triggering sync via the UI), OR
 *   - a shared secret in the `x-cron-secret` header
 *
 * IMPORTANT:
 *   - Secrets MUST arrive in the header, NOT a query string. Query strings
 *     leak into access logs, browser history, and Referer headers.
 *   - If SCHEDULED_FN_SECRET is not set, this FAILS CLOSED — the endpoint
 *     is unreachable without a user session. The previous fail-open behavior
 *     (HIGH-2 in SECURITY-AND-BUGS-REPORT.md) allowed anonymous attackers
 *     to trigger sync/webhook/prune endpoints on misconfigured servers.
 *
 * To run the scheduled endpoints you MUST set SCHEDULED_FN_SECRET in your
 * Netlify environment variables and include it as:
 *     x-cron-secret: <your-secret>
 */
export async function requireScheduledOrAuth(request: Request): Promise<void> {
  // Path 1: authenticated user (e.g. admin manually triggering sync)
  const user = await verifyRequestUser(request);
  if (user) return;

  // Path 2: shared secret (header-only — NEVER accept from query string)
  const expected = (typeof process !== 'undefined' ? process.env.SCHEDULED_FN_SECRET : undefined)
    ?? (import.meta.env as any).SCHEDULED_FN_SECRET;
  if (!expected) {
    // FAIL CLOSED. Do not allow anonymous access just because the admin
    // forgot to set an env var.
    console.error(
      '[security] SCHEDULED_FN_SECRET is not set — rejecting unauthenticated scheduled request. ' +
      'Set the env var in Netlify to enable cron endpoints.'
    );
    throw new UnauthenticatedError('Scheduled endpoints are disabled: SCHEDULED_FN_SECRET is not configured.');
  }
  const fromHeader = request.headers.get('x-cron-secret');
  if (fromHeader && fromHeader === expected) return;

  throw new UnauthenticatedError('Missing or invalid cron secret (expected in x-cron-secret header)');
}

export function handleError(err: unknown): Response {
  if (err instanceof UnauthenticatedError) return json({ error: err.message }, 401);
  if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
  if (err instanceof BannedWordError) {
    return json({ error: err.message, hits: err.hits }, 422);
  }
  // SECURITY: don't leak raw error internals (DB column names, file paths,
  // stack traces) to clients. Always log the full error server-side, return
  // a generic 500 to the client. In dev mode (when import.meta.env.DEV is
  // truthy) we DO surface details so debugging is easier.
  console.error('[api] unhandled error:', err);
  const isDev = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ?? false;
  if (isDev) {
    // Extract useful fields from the error. Supabase errors are plain
    // objects with { message, code, hint, details } — not Error instances,
    // so we can't rely on err.message alone.
    let msg = 'unknown error';
    let detail: Record<string, unknown> | undefined;
    if (err instanceof Error) {
      msg = err.message;
    } else if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      msg = String(e.message ?? e.error ?? e.code ?? 'unknown error');
      detail = {
        code: e.code,
        hint: e.hint,
        details: e.details,
      };
    }
    return json({ error: msg, detail, dev_only: true }, 500);
  }
  return json({ error: 'Internal server error. Check the change log or contact an administrator.' }, 500);
}
