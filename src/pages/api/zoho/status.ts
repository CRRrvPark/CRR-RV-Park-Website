/**
 * GET /api/zoho/status — is Zoho connected? When did sync last run?
 *
 * Surfaces the data the Settings page needs to show connection health.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();

    const { data: tokens } = await sb.from('zoho_tokens').select('service, expires_at, scope, updated_at').order('updated_at', { ascending: false });
    const { data: driveRun } = await sb.from('sync_runs').select('*').eq('service', 'zoho_drive').order('started_at', { ascending: false }).limit(1);
    const { data: calRun } = await sb.from('sync_runs').select('*').eq('service', 'zoho_calendar').order('started_at', { ascending: false }).limit(1);
    // Last successful run — distinct from the most recent run because an
    // editor needs to know "when did sync last actually bring new photos in?"
    // even if the last attempt failed.
    const { data: lastDriveOk } = await sb.from('sync_runs')
      .select('started_at, completed_at, items_added, items_updated')
      .eq('service', 'zoho_drive').eq('status', 'success')
      .order('started_at', { ascending: false }).limit(1);
    const { data: lastCalOk } = await sb.from('sync_runs')
      .select('started_at, completed_at, items_added, items_updated')
      .eq('service', 'zoho_calendar').eq('status', 'success')
      .order('started_at', { ascending: false }).limit(1);

    const hasOauthConfig = Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_REDIRECT_URI);
    const connected = (tokens?.length ?? 0) > 0;
    // Point Settings UI at our /api/zoho/authorize endpoint (owner-gated,
    // sets state cookie) instead of exposing the raw Zoho URL with a
    // guessable state. See HIGH-5 in SECURITY-AND-BUGS-REPORT.md.
    const authorizeUrl = hasOauthConfig ? '/api/zoho/authorize' : null;

    return json({
      hasOauthConfig,
      connected,
      authorizeUrl,
      tokens: tokens?.map(t => ({
        service: t.service,
        expiresAt: t.expires_at,
        updatedAt: t.updated_at,
        scope: t.scope,
      })) ?? [],
      mediaFolderId: process.env.ZOHO_WORKDRIVE_MEDIA_FOLDER_ID ?? null,
      calendarUid: process.env.ZOHO_CALENDAR_PUBLIC_EVENTS_ID ?? null,
      driveSync: driveRun?.[0] ?? null,
      calendarSync: calRun?.[0] ?? null,
      driveLastSuccess: lastDriveOk?.[0] ?? null,
      calendarLastSuccess: lastCalOk?.[0] ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
};
