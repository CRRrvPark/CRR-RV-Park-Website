# Project Check-In

Updated 2026-07-19 PT.

## Current state

The complete approved V3 production remodel is on `main` and deployed through
Netlify.

Completed:

- V3 visual system and shared public shell.
- Home, Sites, Park + Area, Plan, availability, park map, amenities, dining,
  events, trail/activity indexes and details, individual sites, golf, group,
  extended stay, policies, privacy, and terms.
- Home V1-style image stack.
- Sites page replacement for the redundant second rig form: photos, map,
  useful specifications, guest reviews, and call support.
- Conversion-path correction: Firefly is the default reservation destination
  in every shared desktop/mobile/footer conversion surface; the live map is an
  explicitly labeled optional beta.
- The date/rig quick-search instrument is no longer rendered on the homepage
  or Sites page while the live map remains in beta. Its reusable component is
  preserved for future launch; the homepage park-highlights strip now follows
  the hero directly.
- Site-type preview links preserve the selected filter, automatically run the
  beta map search, and distinguish other site types from unavailable matches.
- The Park + Area hero now uses the owner-authored headline:
  “Settle in. A site for every stay.”
- The Park + Area timed itinerary is now a flexible set of active-day choices:
  Smith Rock routes, local bungee/balloon experiences, and the current
  Deschutes County Expo calendar. A dated Fair/ArenaCross callout automatically
  retires to evergreen Expo copy after August 8, 2026.
- Park + Area photo cards use a dedicated high-contrast glass text panel at
  phone widths so labels, descriptions, and links never compete with the image.
- The Park Amenities hero now uses the owner-authored headline:
  “Things to do. A little help to carry the day.”
- Reset-day family finish around a policy-compliant propane fire.
- Correct heated-pool, pet, EV, bathhouse/laundry, recreation, and dump-station
  facts.
- Retired WYSIWYG, page builder, browser code editor, snapshot/publish UI, APIs,
  dependencies, and scheduled cleanup.
- Operational admin retained for media, events, area guide, map, users, audit,
  integrations, and runbook.
- Netlify Claude Code/Codex editing model documented and surfaced in admin.
- Protected pre-V3 Git tag, backup branch, Supabase snapshot, local export, and
  tested dry-run restore utility.
- Stale V4/editor documentation archived and replaced with current V5 docs.
- Complete technical SEO layer: canonical-host alignment, generated XML/image
  sitemap, robots discovery, favicon/manifest, crawler/social metadata,
  Campground/WebSite/WebPage structured data, visible/structured breadcrumbs,
  hard 404s, and repeatable static/live SEO validation.

## Verification state

- `astro check`: 0 errors.
- Production build: passed in the final handoff run. The sandbox blocked the
  live event fetch; the page exercised its intended fail-soft path and the
  Netlify server bundle still completed.
- Backup dry-run: passed and SHA-256 matched the recorded value.
- Active dependency graph no longer contains Puck, Tiptap, or Monaco.
- `package-lock.json` was pruned and contains no Puck, Tiptap, or Monaco
  records.
- Google Maps CSP sources are present; an optional configured map ID enables
  advanced markers and the compatible classic-marker fallback remains active.
- Guest testimonials now come from the live, no-store Google Places review
  endpoint with author/source attribution; the fail-soft state contains no
  quotes or rating.
- `npm run seo:check`: passed for all prerendered public pages.
- Live local SEO crawl: passed all 216 sitemap pages, including 144 image
  entries, dynamic detail routes, canonical alignment, and intentional 404s.
- Retired files remain available under `_Archive/`.

## Search Console follow-through

1. Confirm the production deploy passes the live SEO crawl.
2. Submit `https://crookedriverranchrv.com/sitemap.xml`.
3. Inspect representative URLs and request recrawl after the deploy.
4. Monitor indexing, Core Web Vitals, and structured-data reports.

## Recovery anchors

- Tag: `pre-v3-remodel-2026-07-19`
- Branch: `backup/pre-v3-remodel-2026-07-19`
- Snapshot: `d8aab870-70c3-4e5b-a54a-31f222df56f7`
- Procedure: [RESTORE-PRE-V3.md](RESTORE-PRE-V3.md)
