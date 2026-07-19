# Project Check-In

Updated 2026-07-19 PT.

## Current state

The complete approved V3 production remodel is implemented on:

`codex/v3-production-remodel`

The branch is intentionally isolated from `main` so Netlify can provide a
Deploy Preview before any production cutover.

Completed:

- V3 visual system and shared public shell.
- Home, Sites, Park + Area, Plan, availability, park map, amenities, dining,
  events, trail/activity indexes and details, individual sites, golf, group,
  extended stay, policies, privacy, and terms.
- Home V1-style image stack.
- Sites page replacement for the redundant second rig form: photos, map,
  useful specifications, guest reviews, and call support.
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
- Retired files remain available under `_Archive/`.

## Approval path

1. Push the completed branch.
2. Open a draft pull request so Netlify creates the final Deploy Preview.
3. Review the production routes on desktop and mobile.
4. Address findings on the branch.
5. Merge to `main` only after Mathew approves the preview.

## Recovery anchors

- Tag: `pre-v3-remodel-2026-07-19`
- Branch: `backup/pre-v3-remodel-2026-07-19`
- Snapshot: `d8aab870-70c3-4e5b-a54a-31f222df56f7`
- Procedure: [RESTORE-PRE-V3.md](RESTORE-PRE-V3.md)
