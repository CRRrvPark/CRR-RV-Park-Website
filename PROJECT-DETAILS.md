# Project Details — Crooked River Ranch RV Park

## Product

The project is a conversion-focused guest website plus a narrow operational
admin. The public experience helps guests understand the park, find a fitting
site, see live availability, and continue to Firefly Reservations with minimal
uncertainty.

The approved V3 design system uses layered photography, restrained
glass-gradient surfaces, clear hierarchy, calm motion, direct decisions, and
multiple useful conversion points. Copy is affirmative and factual rather than
comparative.

## Public information architecture

Primary decision paths:

- Home: orientation, image stack, site choices, park/area reasons, reviews.
- Sites: availability, site types, photos, specifications, map, reviews.
- Park + Area: amenities, live regional map, relaxation and active itineraries.
- Plan: live availability, rates, booking handoff, arrival, policies.

Supporting routes:

- `/availability`
- `/park-map`
- `/amenities`
- `/dining`
- `/events`
- `/trails` and `/trails/[slug]`
- `/things-to-do` and `/things-to-do/[slug]`
- `/sites/[code]`
- `/golf-course`
- `/golf-stays`
- `/group-sites`
- `/extended-stays`
- `/park-policies`
- `/privacy`
- `/terms`

The V1–V3 concept routes remain `noindex, nofollow` references. They are not
production navigation.

## Data and system boundaries

- Astro source owns public layout and core copy.
- Supabase owns operational/destination records, media metadata, events, park
  sites, map data, authentication, and audit.
- Zoho WorkDrive and Calendar synchronize photos and events.
- Google Maps and Places provide geographic interfaces and current place data.
- Rimrock provides a read-only availability snapshot.
- Firefly owns reservations, payments, booking confirmations, and guest access.
- Netlify hosts the site, runs functions/schedules, builds previews, and
  provides the AI Agent Runner change surface.

Every external dependency must fail softly. A temporary data-service failure
must not take down the rest of the public site.

## Editing architecture

The former Puck/Tiptap/Monaco WYSIWYG system is retired and preserved under:

`_Archive/retired-wysiwyg-2026-07-19/`

Its routes, APIs, rendering components, scheduled cleanup, dependencies, and
admin navigation are absent from active code. Historical Supabase tables remain
untouched for rollback compatibility.

Public-page edits use Netlify Agent Runners with Claude Code or Codex:

1. isolated branch;
2. source diff;
3. Deploy Preview;
4. GitHub pull request;
5. reviewed merge.

Operational data remains editable in `/admin`.

## Visual and copy guardrails

- Palette: forest, deep mineral, warm neutral, and sea-glass accents.
- Glass/gradient surfaces add depth without reducing legibility.
- Keep body copy concise and decision-oriented.
- Never use comparative “other parks” marketing.
- Do not claim a saltwater pool; the seasonal pool is heated.
- Pets are welcome; do not invent a two-pet maximum.
- EV charging is `$15 per night or charge`.
- Dump station is `$15 per use`, card reader, available 24/7.
- Bathhouse showers are free; laundry is coin-operated.
- Propane fire features only; follow current fire restrictions.
- The golf course is adjacent and independently managed.
- Preserve distinct, truthful imagery and accurate alternative text.

## Stack

- Astro 5 / TypeScript
- React islands for admin and interactive operational surfaces
- Supabase Postgres, Auth, and Storage
- Netlify adapter, functions, forms, schedules, Deploy Previews, Agent Runners
- Zoho WorkDrive and Calendar
- Google Maps / Places
- Rimrock availability API
- Firefly Reservations

## Recovery

The pre-remodel source is protected by Git tag and backup branch. The
guest-facing/content-management database state is preserved in a local export
and Supabase snapshot. See [RESTORE-PRE-V3.md](RESTORE-PRE-V3.md).
