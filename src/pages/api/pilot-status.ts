/**
 * GET /api/pilot-status — same-origin proxy to the Rimrock (StrataPMS) public
 * pilot gate.
 *
 * WHY THIS EXISTS
 * ---------------
 * The pilot page runs in the browser under a strict CSP whose `connect-src`
 * is `'self'` (see netlify.toml). The browser therefore CANNOT fetch the
 * Rimrock server (crr.stratapms.com) directly. This endpoint is the
 * same-origin ('self') hop the browser is allowed to call; it fetches
 * Rimrock server-side (no CSP applies to server→server fetches).
 *
 * NO AUTH — public read. It exposes only the gate boolean + the open
 * schedule; no pricing, no PII.
 *
 * FAILS CLOSED (hard requirement)
 * -------------------------------
 * Any RR failure (non-200, timeout, network error, bad JSON, non-boolean
 * `open`) is returned as HTTP 200 `{ ok:false, open:false, reason }` so an
 * unreachable gate always reads as CLOSED — the pilot can never accidentally
 * open because something broke.
 */
import type { APIRoute } from 'astro';
import { json } from '@lib/api';

export const prerender = false;

const RR_BASE = (
  (import.meta.env.RR_PUBLIC_API_BASE as string | undefined) ??
  (typeof process !== 'undefined' ? process.env.RR_PUBLIC_API_BASE : undefined) ??
  'https://crr.stratapms.com'
).replace(/\/+$/, '');

const FETCH_TIMEOUT_MS = 6000;

/** Fetch a Rimrock path with a hard timeout (mirrors api/availability.ts). */
async function rrFetch(path: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${RR_BASE}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Live RR shape: {"open":boolean,"schedule":{"days":"mon-sat","start":"10:00","end":"15:00","tz":"America/Los_Angeles"}}

export const GET: APIRoute = async () => {
  try {
    const res = await rrFetch('/api/public/pilot-status');
    if (!res.ok) {
      return json({ ok: false, open: false, reason: `RR returned ${res.status}` });
    }
    let body: { open?: unknown; schedule?: unknown };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return json({ ok: false, open: false, reason: 'RR returned non-JSON' });
    }
    // a non-boolean `open` is treated as closed — the gate only opens on an
    // explicit true from Rimrock; the schedule is type-narrowed, never forwarded blind
    const open = body?.open === true;
    const schedule =
      body?.schedule && typeof body.schedule === "object" ? body.schedule : null;
    return json(
      { ok: true, open, schedule },
      200,
      // RR's own endpoint is 60s-cached; matching it means the owner's
      // open/close flip reaches guests within a minute
      { 'Cache-Control': 'public, max-age=60' },
    );
  } catch (err: unknown) {
    const reason =
      err instanceof Error && err.name === 'AbortError' ? 'RR timed out' : 'RR unreachable';
    return json({ ok: false, open: false, reason });
  }
};
