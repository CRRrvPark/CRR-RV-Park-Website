# CRR RV Park Website — Operations Runbook

This is the day-to-day guide for park staff and future maintainers. The live
site is [crookedriverranchrv.com](https://www.crookedriverranchrv.com).

## What each system owns

| System | Responsibility |
|---|---|
| Netlify | Hosting, functions, deploys, Deploy Previews, Agent Runners |
| GitHub | Source history, pull requests, approvals, rollback history |
| Supabase | Admin sign-in, media metadata, events, area-guide and map data |
| Zoho WorkDrive | Upstream park-photo library |
| Zoho Calendar | Upstream public-event calendar |
| Rimrock | Live availability snapshot |
| Firefly Reservations | Reservations, payments, confirmations, guest portal |
| Google Maps / Places | Maps, directions, current place details, and live guest reviews |

## Change the public website

Public pages are not edited in `/admin`. Use the Netlify Agent Runner workflow:

1. Sign in to Netlify and open the Crooked River Ranch RV Park project.
2. Open Agent Runners and choose Claude Code or OpenAI Codex.
3. Describe the exact page, factual change, desired outcome, and anything that
   must remain unchanged.
4. Review the changed files and the generated Deploy Preview.
5. Create the GitHub pull request.
6. Merge only after the preview is correct on desktop and mobile.

The agent works on an isolated branch. The live site changes only when the pull
request is merged into `main`. See [NETLIFY-AI-EDITING.md](NETLIFY-AI-EDITING.md)
for prompt templates and guardrails.

## Use the operational admin

Sign in at `/admin`. The retained tools are:

- Media Library: upload and manage park imagery.
- Events: manage event visibility and records.
- Area Guide: maintain trails, activities, dining, and park-site records.
- Park Map: maintain map image, polygons, and site placement.
- Users: invite staff and assign operational access.
- Change Log: review operational actions.
- Settings: inspect and run Zoho synchronization.
- Runbook: read or update the operational reference.

The role labels now apply to the operational console:

| Role | Access |
|---|---|
| Owner | All operational tools, users, integrations, and runbook |
| Editor | Operational content, media, events, area guide, and map |
| Contributor | Media upload and permitted operational records |
| Viewer | Read-only operational access |

Keep at least two active owners.

## Common tasks

### Add or replace a photo

1. Add the source image to the designated Zoho WorkDrive folder, or upload it
   in Media Library.
2. If using WorkDrive, allow up to 15 minutes or run Sync now in Settings.
3. For a public-page placement change, use a Netlify Agent Runner and specify
   the desired photo and page.
4. Review the Deploy Preview before merging.

### Add an event

Add it to the designated Zoho public-events calendar. The hourly sync publishes
it to the site. Staff may also manage visibility from Admin → Events.

### Update trails, attractions, dining, or site details

Use Admin → Area Guide. Existing records may be corrected or enriched. Do not
auto-create new curated places merely because an API search returns them.

### Check availability or booking issues

- Availability display issue: inspect the Rimrock availability endpoint and
  `/api/availability`.
- Reservation, payment, confirmation, or guest-login issue: use Firefly.
- The website does not own or alter reservation records.

### Check the Google review feed

- Public review text comes only from the live Google Places API (New) response
  at `/api/google-reviews`; it is not stored in Supabase or source files.
- Set `GOOGLE_MAPS_SERVER_KEY` in Netlify with Places API (New) access. The
  public park Place ID is stored in source to avoid a billed Text Search on
  every cold start; `GOOGLE_RV_PARK_PLACE_ID` is an optional override.
- Put a quota cap and billing alert on the server-side Google key.
- If Google or the key is unavailable, the site intentionally shows a direct
  Google Maps link and no quotes or rating. This is the correct fail-soft state.
- Preserve the Google Maps attribution, author links, original-review links,
  relevance-order disclosure, and `no-store` response when changing this
  component.

### Search visibility and technical SEO

The canonical public origin is `https://crookedriverranchrv.com` (no `www`).
The `www` host permanently redirects to it. Do not mix hosts in canonicals,
structured data, sitemap URLs, or Search Console inspection.

- `/robots.txt` points crawlers to `/sitemap.xml`.
- `/sitemap.xml` is generated live. It includes every public static route plus
  published site, trail, and activity detail routes from Supabase, with
  available page images and honest `lastmod` values.
- Every indexable page emits a unique title/description, self-referencing
  canonical, full image/snippet preview directives, Open Graph/Twitter data,
  WebPage JSON-LD, and visible + JSON-LD breadcrumbs.
- The home page also emits `Campground` and `WebSite` identity data for local
  business and site-name understanding.
- Privacy policy, website terms, and the XML sitemap are linked from the
  footer. Admin, API, and concept surfaces remain `noindex`.
- `PUBLIC_GOOGLE_SITE_VERIFICATION` is optional for Search Console's HTML-tag
  verification method. Prefer a Domain property with DNS verification when
  account access allows it.
- The official logo property is intentionally absent from Organization data
  until the exact park logo artwork is available. Never substitute a hero
  photo, generated logo, or unrelated HOA mark.
- Do not add `AggregateRating` to the park's own LocalBusiness/Campground
  schema. Google treats self-serving local-business review markup separately;
  the on-page live review feed already provides the truthful guest proof.

Before deployment:

```bash
npm run check
npm run build
npm run seo:check
npm run seo:check:live -- http://127.0.0.1:4321
```

After deployment, run the live crawl against production, submit
`https://crookedriverranchrv.com/sitemap.xml` in Google Search Console, and
inspect representative home, availability, sites, trail, and privacy URLs.
Technical completeness makes pages eligible and understandable; Google does
not guarantee indexing or a particular position.

## Recovery

### A deploy failed

The previous successful Netlify deploy remains live. Open the deploy log, fix
the branch, and let the preview rebuild. Do not merge a failing preview.

### A merged website change was wrong

Revert the pull request in GitHub, review the revert through a Deploy Preview,
then merge the revert.

### Restore the complete pre-V3 site

Follow [RESTORE-PRE-V3.md](RESTORE-PRE-V3.md). The protected recovery points
are:

- Git tag `pre-v3-remodel-2026-07-19`
- Git branch `backup/pre-v3-remodel-2026-07-19`
- Supabase snapshot `d8aab870-70c3-4e5b-a54a-31f222df56f7`
- Local database export under
  `scripts/_backups/pre-v3-remodel-2026-07-19/`

Never use `git reset --hard` for this recovery.

## Service health

For an outage:

1. Confirm the public URL in a private browser window.
2. Check Netlify deploy and function logs.
3. Check Supabase project health and auth logs.
4. Check Rimrock only if the availability surface is affected.
5. Check Zoho only if media or event synchronization is affected.
6. Check [Netlify status](https://www.netlifystatus.com) for a platform event.

## Account succession

The HOA-controlled mailbox `rvpark@crookedriverranch.com` is the recovery
identity for the project accounts. At least two authorized HOA people should
retain access. Remove departing maintainers from Netlify, GitHub, Supabase,
Zoho, and the admin user list, then rotate credentials when warranted.

Document version: 1.0. Updated 2026-07-19 PT for the V3 production remodel.
