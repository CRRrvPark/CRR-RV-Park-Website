/**
 * /api/runbook
 *   GET — fetch current RUNBOOK.md content (any auth'd)
 *   PATCH — update runbook (owner only)
 *
 * Runbook content lives in a `runbook_content` Supabase table (added via
 * a separate migration). If not present, falls back to the bundled
 * RUNBOOK.md included in the build.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const prerender = false;

const __dirname = dirname(fileURLToPath(import.meta.url));

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();

    // Try DB-stored version first
    const { data } = await sb
      .from('runbook_content')
      .select('content, updated_at, updated_by')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return json({ content: data.content, updatedAt: data.updated_at, updatedBy: data.updated_by, source: 'database' });

    // Fallback: bundled RUNBOOK.md from the build
    try {
      const path = resolve(__dirname, '..', '..', '..', 'RUNBOOK.md');
      const content = readFileSync(path, 'utf8');
      return json({ content, source: 'bundled' });
    } catch {
      return json({ content: '# Runbook\n\n(Not yet created.)', source: 'empty' });
    }
  } catch (err) {
    return handleError(err);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'edit_runbook');
    const { content } = await request.json() as { content: string };
    if (typeof content !== 'string') return json({ error: 'content (string) required' }, 400);

    const sb = serverClient();
    const { data, error } = await sb
      .from('runbook_content')
      .insert({ content, updated_by: user.id, updated_by_email: user.email })
      .select('*')
      .single();
    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'runbook_content',
      targetId: data?.id,
      targetLabel: 'Operations runbook',
      ...requestContext(request),
    });

    return json({ runbook: data });
  } catch (err) {
    return handleError(err);
  }
};
