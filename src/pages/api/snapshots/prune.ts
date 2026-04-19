/**
 * Scheduled Function: /api/snapshots/prune
 *
 * Runs daily. Deletes snapshots older than 90 days, EXCEPT:
 *   - Always keep the most recent 10 'pre_publish' snapshots regardless of age
 *   - Always keep the most recent 5 'pre_restore' snapshots
 *   - Always keep the most recent 5 'pre_code_publish' snapshots
 *
 * This bounds storage growth while preserving the safety net for recent changes.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { json, requireScheduledOrAuth, handleError } from '@lib/api';

export const prerender = false;

const RETENTION_DAYS = 90;
const KEEP_RECENT = {
  pre_publish: 10,
  pre_restore: 5,
  pre_code_publish: 5,
  manual: 20,
};

export const POST: APIRoute = async ({ request }) => {
  try { await requireScheduledOrAuth(request); } catch (err) { return handleError(err); }
  return runPrune();
};
export const GET: APIRoute = async ({ request }) => {
  try { await requireScheduledOrAuth(request); } catch (err) { return handleError(err); }
  return runPrune();
};

async function runPrune(): Promise<Response> {
  const sb = serverClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();

  // For each protected reason, get the IDs of the N most recent snapshots
  // that we must keep regardless of age.
  const keepIds = new Set<string>();
  for (const [reason, keep] of Object.entries(KEEP_RECENT)) {
    const { data } = await sb
      .from('snapshots')
      .select('id')
      .eq('reason', reason)
      .order('created_at', { ascending: false })
      .limit(keep);
    (data ?? []).forEach(r => keepIds.add(r.id));
  }

  // Candidates for deletion: older than cutoff, not in keepIds
  const { data: candidates } = await sb
    .from('snapshots')
    .select('id, reason, byte_size, created_at')
    .lt('created_at', cutoff);

  const toDelete = (candidates ?? []).filter(s => !keepIds.has(s.id)).map(s => s.id);
  const totalBytes = (candidates ?? []).filter(s => !keepIds.has(s.id)).reduce((sum, s) => sum + (s.byte_size ?? 0), 0);

  if (toDelete.length > 0) {
    await sb.from('snapshots').delete().in('id', toDelete);
  }

  console.log(`[snapshot-prune] deleted ${toDelete.length} snapshots, freed ~${Math.round(totalBytes / 1024)}KB`);

  return json({
    ok: true,
    deleted: toDelete.length,
    bytesFreed: totalBytes,
    protected: keepIds.size,
  });
}

