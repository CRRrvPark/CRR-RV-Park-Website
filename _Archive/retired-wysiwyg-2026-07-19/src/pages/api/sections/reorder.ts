/**
 * POST /api/sections/reorder — bulk reorder sections of a page.
 *
 * Body: { pageSlug, orderedSectionIds: string[] }
 *
 * Updates display_order on each so they appear in the given order.
 * Single audit entry for the whole reorder operation.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'edit_content_direct');
    const { pageSlug, orderedSectionIds } = await request.json() as {
      pageSlug: string;
      orderedSectionIds: string[];
    };
    if (!Array.isArray(orderedSectionIds) || orderedSectionIds.length === 0) {
      return json({ error: 'orderedSectionIds (non-empty array) required' }, 400);
    }

    const sb = serverClient();
    // Update each in order. Could do a CTE for atomicity but for ~10-20 sections
    // sequential updates are fine.
    for (let i = 0; i < orderedSectionIds.length; i++) {
      await sb.from('sections').update({ display_order: i * 10 }).eq('id', orderedSectionIds[i]);
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'sections',
      targetLabel: `Reordered sections on ${pageSlug}`,
      afterValue: { orderedSectionIds },
      ...requestContext(request),
    });

    return json({ status: 'reordered', count: orderedSectionIds.length });
  } catch (err) {
    return handleError(err);
  }
};
