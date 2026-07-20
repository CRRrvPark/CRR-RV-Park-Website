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

- Home: orientation, image stack, site choices, park/area reasons, reviews,
  and direct Firefly booking. Site-type cards intentionally open the live-map
  beta with the guest's selection preserved and the default-date search
  already running.
- Sites: availability, site types, photos, specifications, map, reviews.
- Park + Area: amenities, live regional map, relaxation and active itineraries.
- Plan: direct Firefly booking first, optional live-map beta, rates, arrival,
  and policies.

## Reservation-path invariant

Firefly is the authoritative and default reservation path. Persistent desktop
and mobile header controls, the sticky mobile control, the footer, and the
default closing conversion section link directly to Firefly on every public
page. `/availability` is a developing planning preview, never a required
gateway to a reservation, and every link into it is explicitly labeled as a
map, preview, or beta.

Site-type preview links retain the chosen type in the query string, preselect
it on `/availability`, and automatically run the default-date search. The map
mutes other site types separately from matching sites that are unavailable.
`scripts/verify-booking-paths.mjs` crawls every sitemap route and enforces this
contract.

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

## Search architecture

- Canonical origin: `https://crookedriverranchrv.com`; the redirecting `www`
  host is never emitted as a canonical or sitemap URL.
- `HeadMeta.astro` owns unique page metadata, canonical, crawler preview
  controls, social cards, favicon/manifest, and optional Search Console
  verification.
- `Base.astro` adds a WebPage entity and both visible and JSON-LD breadcrumbs
  to every indexable public page.
- Home adds accurate Campground and WebSite entities. No fabricated rating,
  review, award, opening-hours, or logo properties are allowed.
- `/sitemap.xml` is generated from the static route inventory and current
  published Supabase site/trail/activity rows. It includes image discovery and
  fails softly to the static route set if Supabase is unavailable.
- `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml` remain public and
  directly discoverable. Admin, API, and concept routes remain out of search.
- `scripts/verify-seo.mjs` checks emitted prerendered HTML;
  `scripts/verify-seo-live.mjs` crawls every sitemap URL and validates HTTP,
  metadata, canonical, H1, schema, breadcrumb, and legal-link contracts.

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
- Guest-review quotes and ratings must come live from Google Places API (New).
  Never hand-type, paraphrase, seed, or cache testimonials. If the API is
  unavailable, link to Google Maps without showing substitute review content.

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
