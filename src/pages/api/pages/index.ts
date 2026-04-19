/**
 * /api/pages
 *   GET   — list pages (any authenticated user)
 *   POST  — create a new page (editor or owner only)
 *
 * New pages start as drafts (is_draft=true). They're not visible on the
 * public site until an editor explicitly sets is_draft=false via PATCH.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'assets', 'images', 'styles', 'scripts',
  'login', 'logout', 'signin', 'signout', 'register', 'signup',
  'public', 'static', 'app', 'dist', 'build',
  'robots.txt', 'sitemap.xml', 'favicon.ico',
]);

function validateSlug(slug: string): string | null {
  if (!slug || slug.length === 0) return 'slug is required';
  if (slug.length > 60) return 'slug too long (max 60 chars)';
  if (!SLUG_RE.test(slug)) return 'slug must be lowercase letters/numbers/hyphens only, starting with a letter or number';
  if (RESERVED_SLUGS.has(slug)) return `slug "${slug}" is reserved`;
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const sb = serverClient();
    const { data, error } = await sb
      .from('pages')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) return json({ error: error.message }, 500);
    return json({ pages: data });
  } catch (err) {
    return handleError(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'edit_content_direct');
    const body = await request.json() as {
      slug: string;
      title: string;
      meta_description?: string;
      og_image?: string;
      hero_preload?: string;
      show_in_main_nav?: boolean;
      nav_order?: number;
    };

    const err = validateSlug(body.slug);
    if (err) return json({ error: err }, 400);
    if (!body.title || body.title.trim().length === 0) return json({ error: 'title required' }, 400);

    const sb = serverClient();

    // Slug uniqueness check (the DB has a unique constraint too — this gives a friendlier error)
    const { data: existing } = await sb.from('pages').select('id').eq('slug', body.slug).maybeSingle();
    if (existing) return json({ error: `A page with slug "${body.slug}" already exists` }, 409);

    // Compute display_order: append to end
    const { data: last } = await sb
      .from('pages')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const newOrder = (last?.display_order ?? 90) + 10;

    const canonicalUrl = `https://www.crookedriverranchrv.com/${body.slug}`;

    const { data, error } = await sb.from('pages').insert({
      slug: body.slug,
      title: body.title,
      meta_description: body.meta_description ?? null,
      og_image: body.og_image ?? null,
      hero_preload: body.hero_preload ?? null,
      canonical_url: canonicalUrl,
      is_published: true,           // legacy column from 001
      is_draft: true,               // new pages start as drafts
      is_protected: false,
      show_in_main_nav: Boolean(body.show_in_main_nav),
      nav_order: body.nav_order ?? null,
      display_order: newOrder,
    }).select('*').single();

    if (error) {
      // DB triggers may produce friendly errors — surface them
      if (error.message.includes('reserved') || error.message.includes('slug')) {
        return json({ error: error.message }, 400);
      }
      return json({ error: error.message }, 500);
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_edit',
      targetTable: 'pages',
      targetId: data.id,
      targetLabel: `Created page: ${body.title} (/${body.slug})`,
      afterValue: data,
      ...requestContext(request),
    });

    return json({ page: data });
  } catch (err) {
    return handleError(err);
  }
};
