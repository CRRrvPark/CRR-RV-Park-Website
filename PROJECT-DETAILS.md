# Project Details — Crooked River Ranch RV Park

## Product

The project is a conversion-focused guest website plus a narrow operational
admin. The public experience helps guests understand the park, find a fitting
site, and continue to Firefly Reservations (paid self-checkout) with minimal
uncertainty. An optional Rimrock live-map beta offers a separate request path.

The approved V3 design system uses layered photography, restrained
glass-gradient surfaces, clear hierarchy, calm motion, direct decisions, and
multiple useful conversion points. Copy uses the blend voice (crisp above the
fold, park-host body) — affirmative and factual rather than comparative. See
**Voice & identity** below.

## Public information architecture

Primary decision paths:

- Home: orientation, image stack, site choices, park/area reasons, reviews,
  and direct Firefly booking. Mid-page site-type cards may open the live-map
  beta (`/availability?type=…`) as an optional request path — labeled beta.
- Sites: site types, photos, specifications, park map, reviews; type CTAs may
  enter the beta request path.
- Park + Area: amenities, regional map, relaxation and active itineraries.
- Plan: direct Firefly booking first (rates, arrival, policies). Live-map beta
  is reached from the sitewide banner, not from Stay mega or default FinalCta.

## Reservation-path invariant

**Two public paths — never conflate them:**

1. **Firefly (normal paid self-checkout).** Persistent desktop and mobile
   header controls, the sticky mobile control, the footer, and the default
   closing conversion section link directly to Firefly on every public page.
   This is the authoritative path for payment and confirmation.
2. **Rimrock live-map beta (request only).** `/availability` embeds the live
   Rimrock guest map (`https://crr.stratapms.com/?embed=1&request=1`) — not
   the website Supabase `AvailabilityMap`. Guests use the **normal Rimrock
   booking screens** inside the iframe (search → pick → enter details). On
   submit, Rimrock emails the park invisibly (`POST /api/public/beta-site-request`)
   and may also postMessage to a hidden Netlify Forms bridge on this site.
   **No visible website form.** Submit is not a reservation and takes no
   payment. Guest **must call** 541-923-1441 to confirm and pay the deposit;
   staff create the stay in Firefly. Preview may be imperfect.

Beta discovery is isolated: a sitewide clickable banner; Stay mega keeps only
**Interactive park map** (`/park-map`); default FinalCta secondary is the park
map (or phone), not beta. Every link into `/availability` is explicitly
labeled map / preview / beta. `/park-map` remains the Supabase layout map.
`/new-reservations-pilot` stays a separate gated pilot (`?embed=1&pilot=1`)
and must not be conflated with the public beta request path.

Public marketing pages must not render the date/rig `SiteSearch` instrument
on ordinary pages. Mid-page “book this type” CTAs may route to
`/availability?type=…` when labeled as the beta request path.
`scripts/verify-booking-paths.mjs` crawls every sitemap route and enforces
Firefly persistence + labeled beta entry.

**Ops:** Netlify Forms notification for `beta-reservation-request` should remain
wired to `RVPark@crookedriverranch.com` as a backup bridge. Primary path is
Rimrock `POST /api/public/beta-site-request` → tenant `notification_emails`.
Deploy Rimrock guest+API with `?request=1` support to `crr.stratapms.com` for
the invisible submit path to work end-to-end.

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
- Rimrock powers the live-map beta embed (exact guest map UI) and may also
  supply read-only availability APIs for other tools; beta booking is request
  + call, not Rimrock checkout payment.
- Firefly owns confirmed reservations, payments, booking confirmations, and
  guest portal access for the normal path (and for stays staff create after a
  beta request call).
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
- Google Places photo resource names are temporary. Activity imagery must
  resolve a current photo from the stable Place ID at request time, retain
  Google/author attribution, and fail into an intentional fixed-height
  placeholder rather than a broken image.

## Voice & identity (blend)

**Who we are.** Crooked River Ranch is a real Central Oregon community
(~10–12k acres between the Crooked and Deschutes rivers; Oregon’s largest
HOA). The RV Park is the Association’s year-round guest campground inside
that community — canyon-rim sites, full hookups, walkable golf and pool,
Smith Rock about 15 minutes away. Not a highway overnight lot; not a
monthly-only worker park. Legal: Crooked River Ranch Club & Maintenance
Association, DBA Crooked River Ranch RV Park.

**Internal positioning.** Year-round RV camping on the Crooked River canyon,
inside a real ranch community — full hookups, golf and pool next door,
Smith Rock fifteen minutes out.

**Blend voice.**
- Above the fold: place + offer + one proof fact + primary CTA. Short
  sentences. Numbers welcome.
- Body: park-host tone — sounds like the office talking to a guest. Specific
  Ranch details (canyon rim, junipers, golf next door, pool in season,
  propane-only fires). Friendly, not cute. Never explain “decision
  frameworks.”
- CTAs: prefer `Book your site` / `Book online` on buttons; mention Firefly
  once in helper text where needed. Beta links labeled `Live map (beta)`.
- Headlines: one natural sentence (optional short second line). H1 should
  echo the page’s search intent. PageHero `<mark>` may highlight place or
  proof — not poetic fragments.

**Banned register (in addition to `content-safety.ts` tourism clichés):**
authoritative inventory; compatible sites; decision-oriented; useful details
in view; “Start with how you want it to feel”; “Self-care… Laughter”;
“See the fit. See the location. Then decide.”; stacked Firefly/beta sermons
on every page.

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
