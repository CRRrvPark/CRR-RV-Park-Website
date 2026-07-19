/**
 * GET /api/builder/draft?slug=<pageSlug>
 *
 * Returns the current working draft for the visual builder, or the published
 * page_builder_data if no draft exists, or an empty Puck document if neither
 * exists (new page).
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';
import { migratePuckData } from '@lib/puck-data-migrate';

export const prerender = false;

const EMPTY_PUCK_DATA = {
  content: [],
  root: { props: {} },
  zones: {},
};

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);
    const slug = url.searchParams.get('slug');
    if (!slug) return json({ error: 'slug query param required' }, 400);

    const sb = serverClient();

    // Find the page
    const { data: page, error: pageErr } = await sb
      .from('pages')
      .select('id, title, slug, page_builder_data, use_page_builder, meta_description, og_image, hero_preload, canonical_url')
      .eq('slug', slug)
      .single();

    if (pageErr || !page) return json({ error: `Page "${slug}" not found` }, 404);

    // Check for an active draft
    const { data: draft } = await sb
      .from('page_drafts')
      .select('id, data, updated_at, saved_by')
      .eq('page_id', page.id)
      .maybeSingle();

    // Prefer the draft, but if it's effectively empty (no content) and the page
    // has real builder data (from migration or a previous publish), use that
    // instead. This prevents a stale empty auto-save from hiding migrated content.
    const draftContent = (draft?.data as any)?.content;
    const draftIsEmpty = !draftContent || (Array.isArray(draftContent) && draftContent.length === 0);
    const pageHasData = page.page_builder_data && ((page.page_builder_data as any)?.content?.length ?? 0) > 0;

    const builderData = (draft && !draftIsEmpty)
      ? draft.data
      : pageHasData
        ? page.page_builder_data
        : EMPTY_PUCK_DATA;

    // Normalize legacy JSON-string array fields into real arrays so Puck's
    // array-field UI shows the actual item contents instead of empty inputs.
    // See src/lib/puck-data-migrate.ts for the full rationale.
    const normalizedData = migratePuckData(builderData as any);

    return json({
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        metaDescription: page.meta_description,
        ogImage: page.og_image,
        heroPreload: page.hero_preload,
        canonicalUrl: page.canonical_url,
        usePageBuilder: page.use_page_builder,
      },
      data: normalizedData,
      hasDraft: !!draft,
      draftUpdatedAt: draft?.updated_at ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
};
