/**
 * POST /api/analytics/track — public event tracker for conversion clicks.
 *
 * Called from public-site JS when a visitor clicks a Book Now / Reserve
 * button (or any tracked CTA). Writes one row to `conversion_events` and
 * returns 204. Intentionally no auth — anyone can POST, but we hash IPs
 * and rate-limit by IP so a single source can't inflate the numbers.
 *
 * Payload:
 *   { event: string, path?: string, ref?: string, utm?: { source?, campaign? } }
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { json, handleError } from '@lib/api';
import { createHash } from 'node:crypto';

export const prerender = false;

// Absolute maximum the API accepts, per event name.
const ALLOWED_EVENTS = new Set([
  'book_now_click',
  'reserve_click',
  'call_click',
  'email_click',
  'golf_tee_click',
  'tee_time_click',
]);

// Simple in-memory rate limit per IP (resets on cold-start — fine for the
// volume we're defending against). Harsh enough to block naive spam,
// loose enough that a real user clicking rapidly isn't blocked.
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 20;

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ipHash);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ipHash, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

function hashIp(ip: string | null): string {
  if (!ip) return '';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function firstHeader(req: Request, name: string): string | null {
  const v = req.headers.get(name);
  if (!v) return null;
  return v.split(',')[0]?.trim() ?? null;
}

function safeHost(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const u = new URL(raw);
    return u.host || null;
  } catch {
    return null;
  }
}

function safePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  // Only accept same-origin-looking paths: "/foo", "/foo/bar"
  if (!raw.startsWith('/')) return null;
  return raw.slice(0, 200);
}

function safeUtm(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  // Alphanumeric + common URL-safe punctuation only
  if (!/^[A-Za-z0-9._\-]+$/.test(raw)) return null;
  return raw.slice(0, 80);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const event = typeof body?.event === 'string' ? body.event.trim() : '';
    if (!ALLOWED_EVENTS.has(event)) {
      return json({ error: 'Unknown event type' }, 400);
    }

    const ip =
      firstHeader(request, 'x-nf-client-connection-ip') ??
      firstHeader(request, 'x-forwarded-for');
    const ipHash = hashIp(ip);

    if (ipHash && !checkRateLimit(ipHash)) {
      // Silent drop — don't expose that we're rate-limiting to the client.
      return new Response(null, { status: 204 });
    }

    const row: Record<string, unknown> = {
      event,
      source_path: safePath(body?.path),
      referrer_host: safeHost(body?.ref),
      utm_source: safeUtm(body?.utm?.source),
      utm_campaign: safeUtm(body?.utm?.campaign),
      ip_hash: ipHash || null,
    };

    // Fire-and-forget write. If Supabase is down, we silently drop the
    // event rather than block the user's navigation.
    try {
      const sb = serverClient();
      await sb.from('conversion_events').insert(row);
    } catch (err) {
      console.warn('[analytics/track] DB insert failed:', err);
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
};
