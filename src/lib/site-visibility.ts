/**
 * Site visibility flags — controls whether certain hand-authored public
 * pages are live yet.
 *
 * Used by:
 *   • `src/components/Nav.astro` — hides nav links for pages in
 *     `HIDDEN_ROUTES`.
 *   • `src/pages/trails/index.astro`, `src/pages/things-to-do/index.astro`,
 *     `src/pages/dining.astro`, `src/pages/park-map.astro` — each page's
 *     frontmatter returns a 404 response when its slug is in the set.
 *
 * Why a code-level flag and not a DB toggle: these are hand-authored
 * `.astro` routes, not DB-driven pages, so there's no `pages` row to
 * publish/unpublish. Flipping a flag here + redeploying is the simplest
 * way to gate them. If the owner later wants per-page toggles without a
 * redeploy, a follow-up can move this into a `site_flags` DB table and
 * swap the lookup.
 *
 * Area Guide sub-pages: all currently hidden except `/events`, per
 * owner's 2026-04-20 direction. Flip entries to `false` (or remove them)
 * when each page has real content ready to publish.
 */

/**
 * Slugs (leading slash required) whose public routes should return 404
 * AND be omitted from the main nav. Admin routes for these pages are
 * unaffected — `/admin/trails` etc. keep working so content can be
 * populated before the page is revealed.
 */
export const HIDDEN_ROUTES: Set<string> = new Set([
  '/trails',
  '/things-to-do',
  '/dining',
  '/park-map',
]);

export function isRouteHidden(pathname: string): boolean {
  // Normalize — strip trailing slash so '/trails' and '/trails/' both match.
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return HIDDEN_ROUTES.has(trimmed);
}
