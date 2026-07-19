/**
 * /api/code/drafts — owner-only code editor drafts
 *   GET    — list drafts (owner only)
 *   POST   — create or update a draft { filePath, draftContent }
 *
 * Drafts are stored in the code_drafts table. Publishing a draft requires
 * a successful preview deploy first (see /api/code/preview + /api/code/publish).
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireRole(request, 'view_code');
    const sb = serverClient();
    const { data, error } = await sb
      .from('code_drafts')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ drafts: data });
  } catch (err) {
    return handleError(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'edit_code');
    const { filePath, draftContent, originalContent } = await request.json() as {
      filePath: string;
      draftContent: string;
      originalContent?: string;
    };
    if (!filePath || typeof draftContent !== 'string') {
      return json({ error: 'filePath and draftContent required' }, 400);
    }

    const sb = serverClient();
    // Upsert: one open draft per file at a time
    const { data: existing } = await sb
      .from('code_drafts')
      .select('*')
      .eq('file_path', filePath)
      .eq('status', 'open')
      .maybeSingle();

    let saved;
    if (existing) {
      const { data, error } = await sb
        .from('code_drafts')
        .update({ draft_content: draftContent })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) return json({ error: error.message }, 500);
      saved = data;
    } else {
      const { data, error } = await sb
        .from('code_drafts')
        .insert({
          file_path: filePath,
          original_content: originalContent ?? null,
          draft_content: draftContent,
          drafted_by: user.id,
          status: 'open',
        })
        .select('*')
        .single();
      if (error) return json({ error: error.message }, 500);
      saved = data;
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'code_edit',
      targetTable: 'code_drafts',
      targetId: saved.id,
      targetLabel: filePath,
      ...requestContext(request),
    });

    return json({ draft: saved });
  } catch (err) {
    return handleError(err);
  }
};
