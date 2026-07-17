/**
 * GET /api/availability — same-origin proxy to the Rimrock (StrataPMS) public
 * availability API.
 *
 * WHY THIS EXISTS
 * ---------------
 * The public /availability page runs in the browser under a strict CSP whose
 * `connect-src` is `'self'` (see netlify.toml). The browser therefore CANNOT
 * fetch the Rimrock server (crr.stratapms.com) directly. This endpoint is the
 * same-origin ('self') hop the browser is allowed to call; it fetches Rimrock
 * server-side (no CSP applies to server→server fetches) and returns JSON.
 *
 * NO AUTH — this is a public, guest-facing read. It exposes only
 * availability booleans + non-sensitive site metadata; no pricing, no PII.
 *
 * GRACEFUL DEGRADATION (hard requirement)
 * ---------------------------------------
 * The Rimrock public endpoints may not be deployed yet. Every RR failure
 * (404, 5xx, timeout, network error, bad JSON) is caught and returned as
 * `{ ok:false, reason }` with HTTP 200, so the page shows "availability
 * temporarily unavailable" instead of crashing. Only malformed *client*
 * input (missing/invalid dates) returns a 4xx.
 *
 * RR CONTRACT (agreed; may 404 until RR ships them)
 * -------------------------------------------------
 *   GET ${base}/api/public/map-availability?from&to&hookups&kind&rigLengthFt&slides
 *        → { sites: [{ code, available, reason }] }
 *   GET ${base}/api/public/sites
 *        → [{ code, kind, configuration, hookups, max_occupancy, map_polygon, zone }]
 *   GET ${base}/api/public/map/base/blob   → the base map image bytes
 *
 * base URL comes from env `RR_PUBLIC_API_BASE` (default https://crr.stratapms.com).
 *
 * QUERY (this proxy's own, guest-facing shape):
 *   from        YYYY-MM-DD (required)
 *   to          YYYY-MM-DD (required)
 *   type        full-hookup | water_electric | dry | tent | any   (optional)
 *   rigLengthFt integer feet (optional)
 *   slides      yes | no | any (optional)
 *   resource    availability (default) | sites | map
 *
 * The site-type → RR-param mapping lives HERE (single source of truth):
 *   full-hookup    → hookups=full
 *   water_electric → hookups=water_electric
 *   dry            → hookups=dry
 *   tent           → kind=tent
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fetch a Rimrock path with a hard timeout. Never throws for the caller's
 *  benefit — callers still wrap in try/catch, but the abort keeps a hung RR
 *  from holding the serverless function open. */
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

/** Translate the guest-facing `type` filter into RR query params. */
function typeToRrParams(type: string | null): { hookups?: string; kind?: string } {
  switch (type) {
    case 'full-hookup':    return { hookups: 'full' };
    case 'water_electric': return { hookups: 'water_electric' };
    case 'dry':            return { hookups: 'dry' };
    case 'tent':           return { kind: 'tent' };
    default:               return {};
  }
}

export const GET: APIRoute = async ({ url }) => {
  const resource = url.searchParams.get('resource') ?? 'availability';

  // ---- resource=map : stream the RR base image same-origin ----------------
  // (The page defaults to the CSP-allowed Supabase base image for polygon
  //  alignment; this passthrough exists so the RR base blob is reachable
  //  under CSP if ever needed. Failures degrade to a 502 JSON, not a crash.)
  if (resource === 'map') {
    try {
      const res = await rrFetch('/api/public/map/base/blob');
      if (!res.ok) {
        return json({ ok: false, reason: `RR map blob returned ${res.status}` }, 502);
      }
      const buf = await res.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': res.headers.get('content-type') ?? 'image/png',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err) {
      return json({ ok: false, reason: 'RR base map unreachable' }, 502);
    }
  }

  // ---- resource=sites : proxy the RR public site list ---------------------
  if (resource === 'sites') {
    try {
      const res = await rrFetch('/api/public/sites');
      if (!res.ok) {
        return json({ ok: false, reason: `RR sites returned ${res.status}` });
      }
      const data = await res.json();
      const sites = Array.isArray(data) ? data : (data?.sites ?? []);
      return json({ ok: true, sites });
    } catch (err) {
      console.warn('[api/availability] RR sites fetch failed:', err);
      return json({ ok: false, reason: 'Rimrock availability service is unreachable.' });
    }
  }

  // ---- resource=availability (default) : the map painting ------------------
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  // Client-input validation → 4xx (these are the caller's fault, not RR's).
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return json({ ok: false, reason: 'from and to dates are required (YYYY-MM-DD).' }, 400);
  }
  if (to <= from) {
    return json({ ok: false, reason: 'Departure must be after arrival.' }, 400);
  }

  const params = new URLSearchParams({ from, to });
  const { hookups, kind } = typeToRrParams(url.searchParams.get('type'));
  if (hookups) params.set('hookups', hookups);
  if (kind) params.set('kind', kind);

  const rig = url.searchParams.get('rigLengthFt');
  if (rig && /^\d{1,3}$/.test(rig)) params.set('rigLengthFt', rig);

  const slides = url.searchParams.get('slides');
  if (slides === 'yes') params.set('slides', 'true');
  else if (slides === 'no') params.set('slides', 'false');

  try {
    const res = await rrFetch(`/api/public/map-availability?${params.toString()}`);
    if (!res.ok) {
      return json({ ok: false, reason: `Availability service returned ${res.status}.` });
    }
    const data = await res.json();
    const sites = Array.isArray(data?.sites) ? data.sites : [];
    // Normalise to the exact shape the page expects: { code, available, reason }.
    const normalised = sites.map((s: any) => ({
      code: String(s?.code ?? ''),
      available: Boolean(s?.available),
      reason: typeof s?.reason === 'string' ? s.reason : null,
    })).filter((s: { code: string }) => s.code.length > 0);
    return json({ ok: true, sites: normalised });
  } catch (err) {
    console.warn('[api/availability] RR map-availability fetch failed:', err);
    return json({ ok: false, reason: 'Rimrock availability service is unreachable.' });
  }
};
