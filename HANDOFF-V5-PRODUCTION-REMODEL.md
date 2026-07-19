# Handoff — V5 Production Remodel

## Outcome

The V3 concept has become the full production design system without changing
the live `main` branch during implementation. The site is now explicit,
version-controlled Astro rather than a database-rendered WYSIWYG.

## Design decisions carried into production

- Calm forest/mineral/sea-glass palette.
- Subdued glass-gradient depth rather than flat card fields.
- Availability and practical decisions placed early.
- Multiple conversion points that serve different readiness levels.
- V1 image-stack rhythm on the home page.
- Verified guest reviews near high-consideration decisions.
- Clear access to policies, maps, arrival information, and phone help.
- Affirmative copy that describes the park without comparing it to competitors.

## User feedback incorporated

- The reset-day itinerary closes back at camp with family and a propane fire.
- The Sites page no longer repeats the rig-information form immediately below
  the availability search.
- The replacement Sites section provides park imagery, map context, useful
  specifications, reviews, and office help.
- Heated pool replaces all active saltwater language.
- Pets are welcome with no invented two-pet maximum.
- Bathhouse, laundry, EV, recreation, and dump-station details are explicit.
- The Google-powered area map remains part of the stay-planning flow.
- Massage, pedicure, pool, and nearby wine are included without overclaiming.

## System decisions

- Retired: Puck, Tiptap, Monaco, page/section CRUD, visual editor, browser code
  editor, in-admin publish/version restore, and snapshot-prune schedule.
- Retained: Supabase auth/storage/data, Zoho sync, Google Maps/Places, Rimrock
  availability, Firefly handoff, analytics, Netlify forms, and operational
  admin.
- New public editing model: Netlify Agent Runner with Claude Code or Codex,
  isolated branch, Deploy Preview, diff, GitHub PR, reviewed merge.
- Historical editor tables remain untouched for rollback compatibility.

## Backup

The recovery design is documented in [RESTORE-PRE-V3.md](RESTORE-PRE-V3.md).
Source is protected remotely by both a Git tag and backup branch. Content state
is protected by a Supabase snapshot and checksum-verified local export.

## Three-phase review

### Phase 1 — Works

- Active Astro/TypeScript check reaches zero errors.
- Full Netlify-targeted Astro build succeeds.
- Dynamic data surfaces retain fail-soft handling.
- Restore utility parses and validates the actual backup in dry-run mode.

### Phase 2 — Aligns

- Every known public route and active integration was inventoried.
- User feedback was re-read against the final page flow and factual copy.
- The redundant Sites form and missing reset-day evening were corrected in
  both production and the V3 reference prototype.
- Current operator/developer docs describe the new architecture.

### Phase 3 — Breaks

- Active source was searched for retired editor routes, components, APIs,
  dependencies, role capabilities, and scheduled tasks.
- Copy was searched for prohibited comparative language and corrected park
  facts.
- The first adversarial pass found orphaned editor records in the npm lockfile
  and a Google Maps CSP/map-ID weakness; both were corrected before the final
  build.
- The build/type checks cover route imports and client bundles.
- The final Deploy Preview remains the browser/device gate before production
  merge.

## Next action

Open the draft pull request for `codex/v3-production-remodel`, wait for the
Netlify Deploy Preview, and perform a final browser review before merging.
