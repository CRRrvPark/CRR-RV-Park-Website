/**
 * GET /api/sync/status — surfaces the most recent run of every scheduled
 * sync service (Zoho Drive and Zoho Calendar). Used by the
 * Dashboard to light up the "System Health" card.
 *
 * Combines with /api/zoho/status (which returns OAuth/token state) for a
 * full picture. This endpoint is purely about "did the job run and did
 * it succeed?" not "is the external service reachable?".
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();

    // Pull the latest run per service. We could do this in one SQL query
    // with window functions, but two small queries stay readable and
    // none of these tables are large.
    const services = ['zoho_drive', 'zoho_calendar'] as const;
    const runs = await Promise.all(
      services.map(async (svc) => {
        const { data } = await sb
          .from('sync_runs')
          .select('id, service, status, started_at, completed_at, error_message, items_processed')
          .eq('service', svc)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return [svc, data ?? null] as const;
      })
    );

    const byService = Object.fromEntries(runs);

    return json({
      services: byService,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
};
