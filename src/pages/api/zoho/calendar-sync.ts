/**
 * Scheduled Function: zoho-calendar-sync
 *
 * Runs hourly (see netlify.toml [functions."zoho-calendar-sync"]).
 *
 * Pulls events for the next 6 months from a designated public calendar
 * and upserts them into the `events` table. The /events page reads from
 * this table at build time.
 *
 * If event content changes, triggers a debounced rebuild via the publish
 * mechanism (so /events.html stays current).
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';

export const prerender = false;
import { listCalendarEvents, classifyZohoError } from '@lib/zoho';
import { logAudit } from '@lib/audit';
import { triggerBuildHook } from '@lib/netlify';
import { requireScheduledOrAuth, handleError } from '@lib/api';

const MONTHS_AHEAD = 6;

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireScheduledOrAuth(request);
    return await runSync();
  } catch (err: any) {
    console.error('[zoho/calendar-sync] outer handler:', err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
};
export const GET: APIRoute = async ({ request }) => {
  try {
    await requireScheduledOrAuth(request);
    return await runSync();
  } catch (err: any) {
    console.error('[zoho/calendar-sync] outer handler:', err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
};

/**
 * Zoho exposes two wildly different IDs for the same calendar:
 *   - Public embed key — a 100+ char opaque token (often starts "zz08…")
 *     that backs the public HTML-embed iframe widget. Calling the REST API
 *     with this key yields HTTP 400 + {"error_code":"JSON_PARSE_ERROR"},
 *     which is an opaque way of saying "the path parameter is not a
 *     calendar UID."
 *   - Calendar UID — a much shorter ID used by the REST API.
 * This heuristic catches the embed-key variant so we can fail fast with
 * an actionable message instead of a cryptic JSON_PARSE_ERROR.
 */
function looksLikeEmbedKey(id: string): boolean {
  return id.length > 60 && /^zz\d/i.test(id);
}

async function runSync(): Promise<Response> {
  const calendarUid = process.env.ZOHO_CALENDAR_PUBLIC_EVENTS_ID;
  if (!calendarUid) return json({ error: 'ZOHO_CALENDAR_PUBLIC_EVENTS_ID not set' }, 500);

  if (looksLikeEmbedKey(calendarUid)) {
    return json({
      error:
        'ZOHO_CALENDAR_PUBLIC_EVENTS_ID is the public-embed key, not the API UID. ' +
        'Open Admin → Settings → Zoho Calendar → click "Find my calendars", copy the uid of your public events calendar, and replace the env var in Netlify. ' +
        `(current value is ${calendarUid.length} characters and starts with "${calendarUid.slice(0, 6)}…" — the API expects a much shorter identifier.)`,
      hint: 'embed-key-not-uid',
    }, 400);
  }

  const sb = serverClient();
  const { data: run } = await sb.from('sync_runs').insert({
    service: 'zoho_calendar',
    status: 'running',
  }).select('id').single();
  const runId = run?.id;

  try {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + MONTHS_AHEAD * 30 * 24 * 3600 * 1000).toISOString();
    const events = await listCalendarEvents(calendarUid, from, to);

    let added = 0, updated = 0, contentChanged = false;
    for (const ev of events) {
      const { data: existing } = await sb
        .from('events')
        .select('id, zoho_etag')
        .eq('zoho_event_uid', ev.uid)
        .maybeSingle();

      if (!existing) {
        await sb.from('events').insert({
          zoho_event_uid: ev.uid,
          title: ev.title,
          description: ev.description,
          location: ev.location,
          starts_at: parseZohoDate(ev.startsAt),
          ends_at: parseZohoDate(ev.endsAt),
          is_all_day: ev.isAllDay,
          recurrence_rule: ev.recurrenceRule,
          zoho_etag: ev.etag,
          last_synced_at: new Date().toISOString(),
        });
        added++;
        contentChanged = true;
      } else if (ev.etag && ev.etag !== existing.zoho_etag) {
        await sb.from('events').update({
          title: ev.title,
          description: ev.description,
          location: ev.location,
          starts_at: parseZohoDate(ev.startsAt),
          ends_at: parseZohoDate(ev.endsAt),
          is_all_day: ev.isAllDay,
          recurrence_rule: ev.recurrenceRule,
          zoho_etag: ev.etag,
          last_synced_at: new Date().toISOString(),
        }).eq('id', existing.id);
        updated++;
        contentChanged = true;
      }
    }

    // Mark events from this calendar that are no longer in Zoho as inactive
    // (rather than delete — preserves audit trail)
    // TODO Phase 5: implement soft-delete for missing events

    if (runId) {
      await sb.from('sync_runs').update({
        status: 'success',
        completed_at: new Date().toISOString(),
        items_added: added,
        items_updated: updated,
      }).eq('id', runId);
    }

    await logAudit({
      action: 'zoho_sync_run',
      targetTable: 'sync_runs',
      targetId: runId,
      notes: `Calendar sync: +${added} added, ${updated} updated`,
    });

    // If content changed, trigger a rebuild so /events.html reflects new state
    if (contentChanged && process.env.NETLIFY_BUILD_HOOK) {
      try {
        await triggerBuildHook();
      } catch (err) {
        console.warn('[calendar-sync] rebuild trigger failed:', err);
      }
    }

    return json({ ok: true, added, updated, total: events.length, rebuildTriggered: contentChanged });
  } catch (err: any) {
    console.error('[zoho/calendar-sync]', err);

    // Translate Zoho's opaque JSON_PARSE_ERROR into the same actionable
    // guidance as the upfront embed-key check. This catches cases where
    // the UID format slips past the heuristic but Zoho still rejects it.
    const isEmbedKeyError = typeof err?.message === 'string'
      && /JSON_PARSE_ERROR/i.test(err.message);
    const friendlyMessage = isEmbedKeyError
      ? `Zoho rejected the calendar ID as malformed (JSON_PARSE_ERROR). This almost always means ZOHO_CALENDAR_PUBLIC_EVENTS_ID is the public-embed key instead of the API UID. Admin → Settings → Zoho Calendar → "Find my calendars" → copy the uid → update the env var in Netlify.`
      : err.message;

    if (runId) {
      await sb.from('sync_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: friendlyMessage,
        error_class: isEmbedKeyError ? 'config' : classifyZohoError(err),
      }).eq('id', runId);
    }
    await logAudit({
      action: 'zoho_sync_failed',
      targetTable: 'sync_runs',
      targetId: runId,
      notes: friendlyMessage,
    });
    return json({
      error: friendlyMessage,
      hint: isEmbedKeyError ? 'embed-key-not-uid' : undefined,
    }, isEmbedKeyError ? 400 : 500);
  }
}

/** Zoho date format: 'yyyyMMddTHHmmssZ' or 'yyyyMMdd' (all-day). */
function parseZohoDate(s: string): string {
  if (!s) return new Date().toISOString();
  // All-day: '20260415'
  if (s.length === 8) {
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`).toISOString();
  }
  // Datetime: '20260415T140000Z'
  if (s.length >= 16) {
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
    return new Date(iso).toISOString();
  }
  return new Date(s).toISOString();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
