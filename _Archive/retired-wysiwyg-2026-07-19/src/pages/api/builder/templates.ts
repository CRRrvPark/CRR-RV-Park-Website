/**
 * /api/builder/templates
 *
 * GET     — list all saved page templates
 * POST    — create a template from page data
 * DELETE  — remove a template (owner/creator only)
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

/* ── GET: list templates ── */

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);

    const sb = serverClient();
    const { data: templates, error } = await sb
      .from('page_templates')
      .select('id, name, description, thumbnail, created_by, created_at')
      .order('created_at', { ascending: false });

    if (error) return json({ error: error.message }, 500);

    return json({ templates: templates ?? [] });
  } catch (err) {
    return handleError(err);
  }
};

/* ── POST: create a template ── */

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'edit_content_draft');
    const body = await request.json() as {
      name: string;
      description?: string;
      data: unknown;
      thumbnail?: string;
    };

    const { name, description, data, thumbnail } = body;
    if (!name) return json({ error: 'name is required' }, 400);
    if (!data) return json({ error: 'data is required' }, 400);

    const sb = serverClient();

    const { data: template, error } = await sb
      .from('page_templates')
      .insert({
        name,
        description: description || null,
        data,
        thumbnail: thumbnail || null,
        created_by: user.id,
      })
      .select('id, name, created_at')
      .single();

    if (error) return json({ error: error.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'snapshot_created',
      targetTable: 'page_templates',
      targetId: template.id,
      targetLabel: `Template created: ${name}`,
      ...requestContext(request),
    });

    return json({ template }, 201);
  } catch (err) {
    return handleError(err);
  }
};

/* ── DELETE: remove a template ── */

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json() as { id: string };
    const { id } = body;
    if (!id) return json({ error: 'id is required' }, 400);

    const sb = serverClient();

    // Fetch the template to check ownership
    const { data: existing, error: fetchErr } = await sb
      .from('page_templates')
      .select('id, name, created_by')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return json({ error: 'Template not found' }, 404);

    // Only the creator or an owner can delete
    if (existing.created_by !== user.id) {
      // Check if user is an owner (owners can delete any template)
      try {
        await requireRole(request, 'edit_content_direct');
      } catch {
        return json({ error: 'Only the template creator or an editor+ can delete templates' }, 403);
      }
    }

    const { error: delErr } = await sb
      .from('page_templates')
      .delete()
      .eq('id', id);

    if (delErr) return json({ error: delErr.message }, 500);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'snapshot_created',
      targetTable: 'page_templates',
      targetId: id,
      targetLabel: `Template deleted: ${existing.name}`,
      ...requestContext(request),
    });

    return json({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
};
