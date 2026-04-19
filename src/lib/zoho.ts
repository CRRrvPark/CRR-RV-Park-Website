/**
 * Zoho API client — handles OAuth, token refresh, and the API calls we need
 * for WorkDrive (media library) and Calendar (events page).
 *
 * Token storage: zoho_tokens table in Supabase. Refresh tokens are long-lived;
 * access tokens last ~1 hour. Auto-refresh transparently when expiring.
 *
 * OAuth flow:
 *   1. Owner clicks "Connect Zoho" in admin → redirect to Zoho consent screen
 *   2. Zoho redirects back to /api/zoho/oauth-callback with ?code=...
 *   3. We exchange code for access_token + refresh_token, store in DB
 *   4. Subsequent API calls auto-refresh as needed
 *
 * API hosts (IMPORTANT — each Zoho product lives on its own subdomain):
 *   - OAuth:     https://accounts.zoho.<domain>/oauth/v2/*
 *   - WorkDrive: https://workdrive.zoho.<domain>/api/v1/*   (list + download)
 *   - Calendar:  https://calendar.zoho.<domain>/api/v1/*
 *   Using www.zohoapis.com for Calendar 404s. Every bug report about "Zoho
 *   sync silently fails" in this repo has traced back to an incorrect host.
 */

import { serverClient } from './supabase';

const ZOHO_DOMAIN = process.env.ZOHO_ACCOUNT_DOMAIN ?? 'com';
const ZOHO_AUTH_BASE = `https://accounts.zoho.${ZOHO_DOMAIN}`;
const WORKDRIVE_BASE = `https://workdrive.zoho.${ZOHO_DOMAIN}/api/v1`;
const CALENDAR_BASE = `https://calendar.zoho.${ZOHO_DOMAIN}/api/v1`;

export type ZohoService = 'workdrive' | 'calendar';

/**
 * Categorize a sync error into a small set of classes so sync_runs.error_class
 * is queryable + the admin UI can show a human-friendly reason instead of the
 * full stack. Pattern matches on message content because Zoho's error objects
 * don't expose a stable error code.
 */
export type SyncErrorClass = 'auth' | 'timeout' | 'rate_limit' | 'config' | 'validation' | 'other';

export function classifyZohoError(err: unknown): SyncErrorClass {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  if (!msg) return 'other';
  if (/\b(401|invalid_token|refresh.*failed|oauth|unauthorized)\b/.test(msg)) return 'auth';
  if (/\b(429|rate[- ]?limit|too many requests)\b/.test(msg)) return 'rate_limit';
  if (/\b(502|503|504|bad gateway|gateway timeout|service unavailable|etimedout|econnreset|timed? ?out)\b/.test(msg)) return 'timeout';
  if (/not set|not configured|missing.*env|invalid folder|invalid calendar/.test(msg)) return 'config';
  if (/db insert|db update|insert failed|update failed|constraint|parse/.test(msg)) return 'validation';
  return 'other';
}

export interface ZohoTokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  scope?: string;
}

// ---------------------------------------------------------------------------
// OAuth: build authorization URL for the consent screen
// ---------------------------------------------------------------------------
export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ZOHO_CLIENT_ID ?? '',
    // Zoho expects scopes comma-separated. Request only what we actually use
    // so the consent screen is minimally scary to the owner.
    scope: [
      'WorkDrive.files.ALL',
      'WorkDrive.team.READ',
      'ZohoCalendar.event.READ',
      'ZohoCalendar.calendar.READ',
    ].join(','),
    redirect_uri: process.env.ZOHO_REDIRECT_URI ?? '',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${ZOHO_AUTH_BASE}/oauth/v2/auth?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// OAuth: exchange code for tokens (called from /api/zoho/oauth-callback)
// ---------------------------------------------------------------------------
export async function exchangeCodeForTokens(code: string): Promise<ZohoTokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ZOHO_CLIENT_ID ?? '',
    client_secret: process.env.ZOHO_CLIENT_SECRET ?? '',
    redirect_uri: process.env.ZOHO_REDIRECT_URI ?? '',
    code,
  });
  const res = await fetch(`${ZOHO_AUTH_BASE}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Zoho token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
  };
}

// ---------------------------------------------------------------------------
// Token storage + auto-refresh
// ---------------------------------------------------------------------------
async function loadStoredTokens(service: ZohoService): Promise<ZohoTokenSet | null> {
  const sb = serverClient();
  const { data } = await sb.from('zoho_tokens').select('*').eq('service', service).single();
  if (!data) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(data.expires_at),
    scope: data.scope,
  };
}

async function saveTokens(service: ZohoService, tokens: ZohoTokenSet, obtainedBy?: string): Promise<void> {
  const sb = serverClient();
  await sb.from('zoho_tokens').upsert({
    service,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at.toISOString(),
    scope: tokens.scope,
    obtained_by: obtainedBy ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'service' });
}

export async function persistInitialTokens(service: ZohoService, tokens: ZohoTokenSet, obtainedBy: string): Promise<void> {
  await saveTokens(service, tokens, obtainedBy);
}

async function refreshAccessToken(service: ZohoService, refreshToken: string): Promise<ZohoTokenSet> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID ?? '',
    client_secret: process.env.ZOHO_CLIENT_SECRET ?? '',
    refresh_token: refreshToken,
  });
  const res = await fetch(`${ZOHO_AUTH_BASE}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Zoho refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as { access_token: string; expires_in: number; scope?: string };
  const tokens: ZohoTokenSet = {
    access_token: json.access_token,
    refresh_token: refreshToken, // refresh tokens are reused
    expires_at: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
  };
  await saveTokens(service, tokens);
  return tokens;
}

async function getValidAccessToken(service: ZohoService): Promise<string> {
  const tokens = await loadStoredTokens(service);
  if (!tokens) {
    throw new Error(`No Zoho tokens stored for service '${service}'. Owner must complete OAuth flow first.`);
  }
  // Refresh if expiring within the next 5 minutes
  if (tokens.expires_at.getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(service, tokens.refresh_token);
    return refreshed.access_token;
  }
  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Shared fetch helper: surfaces the ACTUAL Zoho error body in logs + thrown
// errors. Without this, a failed sync just prints "status 400" with no clue
// what went wrong.
// ---------------------------------------------------------------------------
async function zohoFetch(label: string, url: string, init: RequestInit = {}): Promise<Response> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: any) {
    console.error(`[zoho:${label}] network error calling ${url} — ${err?.message ?? err}`);
    throw new Error(`Zoho ${label} network error: ${err?.message ?? err}`);
  }
  const elapsed = Date.now() - started;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(
      `[zoho:${label}] HTTP ${res.status} (${elapsed}ms) ${init.method ?? 'GET'} ${url}\n  body: ${body.slice(0, 1000)}`
    );
    const error: any = new Error(
      `Zoho ${label} failed (HTTP ${res.status}): ${body.slice(0, 300) || res.statusText}`
    );
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return res;
}

// ---------------------------------------------------------------------------
// WorkDrive: list files in a Team Folder (with pagination — the API returns
// batches of 50 and won't return all items in one shot).
// ---------------------------------------------------------------------------
export interface WorkDriveFile {
  id: string;
  name: string;
  /** Full MIME type (e.g. "image/jpeg"). May be empty — fall back to `type` + `extn`. */
  mimeType: string;
  /** Zoho's category field: "image" | "document" | "folder" | "video" | "audio" | ... */
  type: string;
  /** Extension without the dot, e.g. "jpg". */
  extn: string;
  size: number;
  modifiedAt: string;
  downloadUrl?: string;
  permalink?: string;
}

/**
 * Return true if the WorkDrive item is an image. Checks multiple fields
 * because Zoho's response inconsistently populates `mime_type` vs `type`
 * vs `extn` across API versions and workspace kinds.
 */
export function isImageFile(f: WorkDriveFile): boolean {
  if (f.mimeType && f.mimeType.startsWith('image/')) return true;
  if (f.type === 'image') return true;
  const ext = (f.extn || f.name.split('.').pop() || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'tiff', 'heic'].includes(ext);
}

/**
 * Zoho's WorkDrive API is inconsistent about modified_time format. Across
 * our own WorkDrive folder we've observed:
 *   - ISO-8601 strings ("2026-04-14T19:26:00Z")           ← preferred
 *   - Unix ms as a string ("1744659960000")
 *   - Localized strings with no year ("Apr 14, 7:26 PM")  ← breaks Postgres
 *
 * Postgres `timestamptz` rejects the localized form with code 22007. Normalize
 * every shape into an ISO-8601 string so downstream inserts always succeed.
 *
 * If parsing fails entirely, return the epoch (1970-01-01) as a sentinel
 * instead of `new Date().toISOString()` — that way the "modified since last
 * sync?" check in drive-sync.ts stops spuriously re-ingesting untouched
 * files every run.
 */
function normalizeZohoTimestamp(value: unknown): string {
  if (value == null || value === '') return new Date(0).toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  const s = String(value).trim();
  // Already ISO-8601
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  // Unix ms as string
  if (/^\d{10,}$/.test(s)) return new Date(Number(s)).toISOString();
  // Localized / human-readable — best effort
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return new Date(0).toISOString();
}

const WORKDRIVE_PAGE_SIZE = 50;

export async function listWorkDriveFolderFiles(folderId: string): Promise<WorkDriveFile[]> {
  const token = await getValidAccessToken('workdrive');
  const all: WorkDriveFile[] = [];
  let offset = 0;

  // Hard cap at 20 pages (1000 files) to avoid runaway loops on misconfigured
  // folders — far more than our media library will ever reasonably contain.
  for (let page = 0; page < 20; page++) {
    const url = `${WORKDRIVE_BASE}/files/${folderId}/files?page%5Blimit%5D=${WORKDRIVE_PAGE_SIZE}&page%5Boffset%5D=${offset}`;
    const res = await zohoFetch('workdrive.list', url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: 'application/vnd.api+json',
      },
    });
    const json = await res.json() as { data?: any[]; meta?: any };
    const items = json.data ?? [];
    if (page === 0) {
      console.log(
        `[zoho:workdrive.list] folderId=${folderId} returned ${items.length} item(s) on first page ` +
        `(total_in_meta=${json.meta?.total ?? 'n/a'})`
      );
    }
    if (items.length === 0) break;

    for (const item of items) {
      const attrs = item.attributes ?? {};
      // `mime_type` and `type` are different things in Zoho:
      //   - mime_type: full MIME string when present (e.g. "image/jpeg")
      //   - type:      category — "image" | "folder" | "document" | ...
      // We preserve both so the caller can decide how to filter.
      const rawMime = typeof attrs.mime_type === 'string' ? attrs.mime_type : '';
      all.push({
        id: item.id,
        name: attrs.name ?? attrs.display_attr_name ?? 'untitled',
        mimeType: rawMime,
        type: attrs.type ?? '',
        extn: (attrs.extn ?? attrs.file_extn ?? '').toString().replace(/^\./, ''),
        size: Number(attrs.storage_info?.size ?? attrs.size ?? 0),
        modifiedAt: normalizeZohoTimestamp(attrs.modified_time ?? attrs.modified_time_i18),
        downloadUrl: attrs.download_url,
        permalink: attrs.permalink,
      });
    }

    if (items.length < WORKDRIVE_PAGE_SIZE) break;
    offset += WORKDRIVE_PAGE_SIZE;
  }

  return all;
}

export async function downloadWorkDriveFile(fileId: string): Promise<ArrayBuffer> {
  const token = await getValidAccessToken('workdrive');
  const url = `${WORKDRIVE_BASE}/download/${fileId}`;
  const res = await zohoFetch('workdrive.download', url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  return res.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Calendar: list events in a date range
//
// Endpoint host: calendar.zoho.<domain>, NOT www.zohoapis.<domain>.
// Date format: Zoho's compact `yyyyMMddTHHmmssZ` — NOT ISO-8601 with dashes
// and colons. Passing ISO to this endpoint results in an empty event list
// (no error).
// ---------------------------------------------------------------------------
export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  recurrenceRule?: string;
  etag?: string;
}

/** Convert an ISO-8601 datetime to Zoho's compact `yyyyMMddTHHmmssZ` format. */
function toZohoCompactDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error(`Invalid date for Zoho: ${iso}`);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * List the user's calendars so they can discover the correct `uid` to put
 * in ZOHO_CALENDAR_PUBLIC_EVENTS_ID. Embed / public-share keys (the 100+
 * character `zz08...` strings) are NOT valid here — Zoho's API rejects
 * them with a cryptic JSON_PARSE_ERROR.
 */
export interface ZohoCalendarSummary {
  uid: string;
  name: string;
  description?: string;
  color?: string;
  isdefault?: boolean;
  owned?: boolean;
}

export async function listCalendars(): Promise<ZohoCalendarSummary[]> {
  const token = await getValidAccessToken('calendar');
  const res = await zohoFetch('calendar.calendars', `${CALENDAR_BASE}/calendars`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const json = await res.json() as { calendars?: any[] };
  return (json.calendars ?? []).map((c: any) => ({
    uid: c.uid,
    name: c.name ?? '(unnamed)',
    description: c.description,
    color: c.color,
    isdefault: Boolean(c.isdefault),
    owned: c.category === 'owncalendar' || Boolean(c.owned),
  }));
}

/** Zoho's cap on a single getEvents `range` query (RANGE_CANNOT_EXCEED_31DAYS). */
const ZOHO_CALENDAR_WINDOW_DAYS = 30;   // stay a day under the cap to avoid edge TZ issues
const ZOHO_CALENDAR_WINDOW_MS = ZOHO_CALENDAR_WINDOW_DAYS * 24 * 3600 * 1000;

async function fetchCalendarEventsWindow(
  token: string,
  calendarUid: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarEvent[]> {
  // Zoho Calendar API expects the date window as a SINGLE query parameter
  // whose value is a JSON-encoded object:
  //   range={"start":"20260417T000000Z","end":"20260517T000000Z"}
  // (31-day max per call — the caller chunks longer windows.)
  const range = JSON.stringify({
    start: toZohoCompactDate(fromIso),
    end: toZohoCompactDate(toIso),
  });
  const params = new URLSearchParams({ range });
  const url = `${CALENDAR_BASE}/calendars/${calendarUid}/events?${params.toString()}`;
  const res = await zohoFetch('calendar.list', url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const json = await res.json() as { events?: any[] };
  return (json.events ?? []).map((e: any) => ({
    uid: e.uid,
    title: e.title ?? '(untitled)',
    description: e.description,
    location: e.location,
    startsAt: e.dateandtime?.start ?? '',
    endsAt: e.dateandtime?.end ?? '',
    isAllDay: Boolean(e.isallday),
    recurrenceRule: e.rrule,
    etag: e.etag,
  }));
}

export async function listCalendarEvents(
  calendarUid: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken('calendar');
  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    throw new Error(`listCalendarEvents: invalid range fromIso=${fromIso} toIso=${toIso}`);
  }

  // Chunk the requested window into ≤30-day pieces so every underlying
  // Zoho call stays under the RANGE_CANNOT_EXCEED_31DAYS cap. Dedupe by
  // event.uid — recurring events may echo across boundary windows.
  const out: CalendarEvent[] = [];
  const seen = new Set<string>();
  let cursor = fromMs;
  let calls = 0;
  // Safety cap — 24 windows = ~2 years; way beyond what sync ever asks for.
  const MAX_CALLS = 24;
  while (cursor < toMs && calls < MAX_CALLS) {
    const end = Math.min(cursor + ZOHO_CALENDAR_WINDOW_MS, toMs);
    const windowFrom = new Date(cursor).toISOString();
    const windowTo = new Date(end).toISOString();
    const events = await fetchCalendarEventsWindow(token, calendarUid, windowFrom, windowTo);
    for (const ev of events) {
      if (ev.uid && seen.has(ev.uid)) continue;
      if (ev.uid) seen.add(ev.uid);
      out.push(ev);
    }
    cursor = end;
    calls++;
  }
  return out;
}
