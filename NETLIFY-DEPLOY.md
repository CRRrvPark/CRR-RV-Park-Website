# Netlify Deployment

## Normal delivery path

```text
feature or Agent Runner branch
  -> Netlify Deploy Preview
  -> review the rendered site and file diff
  -> GitHub pull request
  -> merge to main
  -> Netlify production deploy
```

The `main` branch is the production source. Do not bypass the preview for
public-page changes.

## Build configuration

- Runtime: Node 20
- Build: `npm run build`
- Framework: Astro with `@astrojs/netlify`
- Public pages: prerendered where possible; data-backed detail/admin/API routes
  use server rendering
- Scheduled functions:
  - `zoho-drive-sync`: every 15 minutes
  - `zoho-calendar-sync`: hourly at minute 17

The retired snapshot-prune and in-admin publish functions are intentionally
absent.

## Required production environment

Use `.env.example` as the name-only reference. Production values live in
Netlify and must include Supabase, Zoho, Google, Netlify, site identity, and
scheduled-function secrets. The browser Google Maps key must be
referer-restricted to the production domains and approved development hosts.

## Deploy review

Before merging:

- Check desktop and mobile navigation.
- Complete at least one availability-to-Firefly flow.
- Open policies from both the header and footer.
- Check live maps, site detail routes, trail/activity detail routes, events,
  and the extended-stay Netlify form.
- Confirm external links open the intended official service.
- Confirm no staging or concept route is indexed.
- Run `npm run seo:check` after the production build.
- With the preview or local server available, run
  `npm run seo:check:live -- <base-url>` and confirm every sitemap URL,
  canonical, breadcrumb, schema block, legal link, and hard-404 contract.
- Confirm `www.crookedriverranchrv.com` redirects once to the canonical apex
  host and does not serve a competing 200 response.

## Rollback

For an ordinary bad release, revert its pull request and review the revert
preview. For a full pre-remodel recovery, follow
[RESTORE-PRE-V3.md](RESTORE-PRE-V3.md).

Netlify keeps prior deploy artifacts, Git retains every source state, and the
pre-V3 Git tag/branch are explicit permanent recovery anchors.
