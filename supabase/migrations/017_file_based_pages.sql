-- ============================================================================
-- 017_file_based_pages.sql — Register file-based pages in the `pages` table
-- ============================================================================
-- Until now, the four hand-authored public routes — /trails, /things-to-do,
-- /dining, /park-map — were gated by a hardcoded `HIDDEN_ROUTES` set in
-- `src/lib/site-visibility.ts`. Toggling visibility required an edit +
-- redeploy.
--
-- This migration moves those flags into the `pages` table so the owner can
-- flip visibility from the Pages admin like every other page. The rows are
-- marked `is_protected = true` because deleting them would leave an
-- orphan .astro route with no DB row (the admin would lose the toggle,
-- but the route would still serve).
--
-- Each row starts as a draft (is_draft = true) to preserve the current
-- behavior. Flip via the Pages admin when the page is ready to go public.
--
-- `display_order` values are chosen to group the Area Guide cluster
-- together (30-series) and the park map slightly later (75), without
-- colliding with the already-seeded slugs in 003.
-- ============================================================================

insert into pages (slug, title, meta_description, canonical_url, is_draft, is_protected, display_order, show_in_main_nav)
values
  ('trails',        'Hiking Trails',      'Trails in and around Crooked River Ranch.',                      'https://www.crookedriverranchrv.com/trails',        true, true, 31, false),
  ('things-to-do',  '60 Things to Do',    'Central Oregon destination guide, filterable by visitor type.',  'https://www.crookedriverranchrv.com/things-to-do',  true, true, 32, false),
  ('dining',        'Dining & Local',     'Nearby restaurants, breweries, coffee shops, and local spots.', 'https://www.crookedriverranchrv.com/dining',        true, true, 33, false),
  ('park-map',      'Park Map',           'Interactive park map — pick your site at Crooked River Ranch.', 'https://www.crookedriverranchrv.com/park-map',      true, true, 75, false)
on conflict (slug) do update set
  is_protected = excluded.is_protected,
  -- Don't overwrite is_draft on conflict — the admin may have already
  -- toggled one of these to published; migrations must be idempotent and
  -- must never clobber owner intent.
  canonical_url = coalesce(pages.canonical_url, excluded.canonical_url);
