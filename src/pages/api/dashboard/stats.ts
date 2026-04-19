/**
 * GET /api/dashboard/stats — aggregated metrics for the admin dashboard.
 *
 * Returns the numbers the admin landing page needs in a single round trip:
 *   - Conversion clicks: Book Now / Reserve / Call / Email, grouped by day
 *     for the last 14 days.
 *   - Environment health: which critical env vars are missing (Google Maps
 *     key, Zoho tokens) so the dashboard can surface actionable alerts.
 *   - Zoho sync summary: most recent + most recent successful run per service.
 *
 * Extended as needed — this endpoint intentionally centralizes the
 * aggregations so the dashboard stays fast and readable.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';

export const prerender = false;

interface DailyCount {
  day: string;        // YYYY-MM-DD
  book_now: number;
  reserve: number;
  call: number;
  email: number;
  golf_tee: number;
}

function toDay(iso: string): string {
  return iso.slice(0, 10);
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();

    // Last 14 days of conversion events, bucketed in JS (cheaper than SQL
    // aggregation for this row volume, and no extra migration needed).
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events } = await sb
      .from('conversion_events')
      .select('occurred_at, event')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: true });

    const byDay: Map<string, DailyCount> = new Map();
    // Seed every day in the window so the chart doesn't skip empty days.
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      byDay.set(d, { day: d, book_now: 0, reserve: 0, call: 0, email: 0, golf_tee: 0 });
    }
    for (const ev of events ?? []) {
      const day = toDay(ev.occurred_at);
      const row = byDay.get(day);
      if (!row) continue;
      if (ev.event === 'book_now_click') row.book_now++;
      else if (ev.event === 'reserve_click') row.reserve++;
      else if (ev.event === 'call_click') row.call++;
      else if (ev.event === 'email_click') row.email++;
      else if (ev.event === 'golf_tee_click' || ev.event === 'tee_time_click') row.golf_tee++;
    }
    const conversions = Array.from(byDay.values());

    // 7-day totals (for the headline stat tiles).
    const last7 = conversions.slice(-7);
    const totals7 = last7.reduce(
      (acc, r) => ({
        book_now: acc.book_now + r.book_now,
        reserve: acc.reserve + r.reserve,
        call: acc.call + r.call,
        email: acc.email + r.email,
        golf_tee: acc.golf_tee + r.golf_tee,
      }),
      { book_now: 0, reserve: 0, call: 0, email: 0, golf_tee: 0 },
    );

    // Most recent + most successful Zoho sync runs (reused from /api/zoho/status).
    const { data: driveRun } = await sb.from('sync_runs').select('status, started_at, error_class').eq('service', 'zoho_drive').order('started_at', { ascending: false }).limit(1);
    const { data: driveOk } = await sb.from('sync_runs').select('started_at').eq('service', 'zoho_drive').eq('status', 'success').order('started_at', { ascending: false }).limit(1);
    const { data: calRun } = await sb.from('sync_runs').select('status, started_at, error_class').eq('service', 'zoho_calendar').order('started_at', { ascending: false }).limit(1);
    const { data: calOk } = await sb.from('sync_runs').select('started_at').eq('service', 'zoho_calendar').eq('status', 'success').order('started_at', { ascending: false }).limit(1);

    // Environment alerts (read server-side env; don't leak values to the client).
    const envAlerts: Array<{ key: string; severity: 'info' | 'warning' | 'error'; message: string; href?: string }> = [];
    if (!process.env.PUBLIC_GOOGLE_MAPS_API_KEY) {
      envAlerts.push({
        key: 'google_maps_missing',
        severity: 'warning',
        message: 'Google Maps API key is not configured — trail and area-guide maps show a fallback.',
        href: '/admin/area-guide',
      });
    }
    if (!process.env.ZOHO_CLIENT_ID) {
      envAlerts.push({
        key: 'zoho_not_configured',
        severity: 'warning',
        message: 'Zoho Drive/Calendar integration is not configured — manual photo upload still works.',
        href: '/admin/settings',
      });
    }

    // Clarity project ID (safe to expose — it's in the public tag too).
    const clarityProjectId = 'w90s0eo24y';
    const clarityDashboardUrl = `https://clarity.microsoft.com/projects/view/${clarityProjectId}`;

    return json({
      conversions: {
        daily: conversions,
        totals7d: totals7,
      },
      zoho: {
        drive: {
          last: driveRun?.[0] ?? null,
          lastSuccess: driveOk?.[0] ?? null,
        },
        calendar: {
          last: calRun?.[0] ?? null,
          lastSuccess: calOk?.[0] ?? null,
        },
      },
      alerts: envAlerts,
      clarity: {
        projectId: clarityProjectId,
        dashboardUrl: clarityDashboardUrl,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
};
