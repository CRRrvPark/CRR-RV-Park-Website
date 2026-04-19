# Handoff V2 — Area Guide + Sync Fixes → Next Thread

> **Supersedes:** [HANDOFF-V1-TO-NEW-THREAD.md](HANDOFF-V1-TO-NEW-THREAD.md) (kept as historical reference for the original V1.0 stable cut)
>
> **Date tagged:** 2026-04-17
> **Project path:** `C:\Users\mathe\Documents\RV Park\crr-rv-park-platform-DEV`
> **V1.0 frozen snapshot:** `C:\Users\mathe\Documents\RV Park\crr-rv-park-platform-V1.0-STABLE-2026-04-16`
> **Live URL:** https://www.crookedriverranchrv.com
> **Owner:** Mathew Birchard (mathew.birchard25@gmail.com)

---

## Read this first

V1.0 shipped a working CMS-backed marketing site. Between V1 and V2 the site gained:

1. A **destination-guide layer** — `/trails`, `/things-to-do`, `/dining`, `/park-map`, rebuilt `/area-guide` with an interactive Google Map
2. **Clickable cards + image lightboxes** across all public pages
3. **Working Zoho WorkDrive sync** (media library actually populates now)
4. **Working Zoho Calendar sync** (events actually populate now)
5. **A tabbed admin** at `/admin/area-guide` for managing trails / things / places / sites

Nothing V1 did was broken. This is additive.

**The thing that is backburnered:** the entire security foundation in [SECURITY-PLAN.md](SECURITY-PLAN.md) Sessions N → N+8. R&PMS work (the owner's 12-month goal) is blocked on that foundation. The area-guide push was an intentional, near-term content/UX investment — it earns bookings now but doesn't move R&PMS closer. When this thread's momentum ends, the next priority is Session N (encryption primitive + hash-chained audit log).

---

## Current live status (V2)

| Area | State | Notes |
|---|---|---|
| Public site (V1 pages) | ✅ | Unchanged; still prerendered |
| Visual Builder (Puck) | ✅ | `/admin/builder/{slug}` |
| Legacy field editor | ✅ (demoted) | `/admin/editor/{slug}` |
| Netlify Forms | ✅ | All four forms registered via `public/__forms.html` |
| Zoho OAuth | ✅ | Full cycle works |
| **Zoho WorkDrive sync** | ✅ (fixed this thread) | Filename sanitization + upload retry + silent-insert fail-loud + timestamp normalization |
| **Zoho Calendar sync** | ✅ (fixed this thread) | Embed-key detection + JSON-range format + 30-day window chunking |
| Publish → Netlify rebuild | ✅ | |
| Auto-save drafts | ✅ | |
| Version history + restore | ✅ | |
| RBAC | ✅ | New capability `manage_area_guide`/`view_area_guide` added |
| **Clickable cards + Lightbox** | ✅ (new) | Cards with `href` in JSON render as `<a>`; TwoColumn images auto-lightbox |
| **`/trails` list + detail** | ✅ (new) | 6 seeded trails with verified general info |
| **`/things-to-do` list + detail** | ✅ (new) | 60 seeded activities with persona filter |
| **`/area-guide` with big map** | ✅ (new) | Pins every trail + activity with coordinates |
| **`/dining` with Google Places** | ✅ (new) | Auto-hidden from nav until real `place_id`s filled in |
| **`/park-map` clickable sites** | ✅ (new) | 109 placeholder sites; real data goes in admin |
| **`/admin/area-guide`** | ✅ (new) | Tabbed CRUD for trails/things/places/sites |
| RUM / Core Web Vitals | ⚠ projected | No change from V1 |

---

## What's new since V1

### New public pages
- **`/trails`** — list with interactive map, on-property / nearby sections
- **`/trails/[slug]`** — detail page (distance, elevation, difficulty badge, hazards chips, trailhead map, external AllTrails link)
- **`/things-to-do`** — 60-item card grid with persona filter buttons (Families / Active / RVers / Dogs / Day Trippers / Winter / Food & Community); URL preserves filter state
- **`/things-to-do/[slug]`** — per-activity detail page
- **`/dining`** — Google Places cards (auto-updating hours, ratings, photos)
- **`/park-map`** — clickable park map with site detail modal + "Book this site" deep-link (Firefly URL pattern pending owner confirmation)
- **Rebuilt `/area-guide`** — big interactive Google Map at top + CTA buttons to the new pages, original narrative content preserved below

### New admin
- **`/admin/area-guide`** — single page, four tabs (Trails / Things / Places / Sites). Drawer-based create+edit forms. Delete with confirm.
- Sidebar nav now includes "Area Guide" with 🌐 icon, gated on `view_area_guide`

### New libraries / components
- [src/lib/area-guide.ts](src/lib/area-guide.ts) — typed server-only data access (`getTrails`, `getThingsToDo`, `getLocalPlaces`, `getParkSites`, admin-variant readers, category labels, formatters)
- [src/components/GoogleMap.astro](src/components/GoogleMap.astro) — reusable map component with lazy SDK load, IntersectionObserver gate, graceful fallback when API key missing
- [src/components/LocalPlaceCard.astro](src/components/LocalPlaceCard.astro) — renders a `local_places` row with Google data
- [src/components/Lightbox.astro](src/components/Lightbox.astro) — single global lightbox via native `<dialog>`; delegated click/keyboard handler
- [src/components/react/ParkSiteMap.tsx](src/components/react/ParkSiteMap.tsx) — pinned site map + modal
- [src/components/react/AreaGuideAdmin.tsx](src/components/react/AreaGuideAdmin.tsx) — the four-tab admin

### New API endpoints
- `GET /api/area-guide/trails`, `POST /api/area-guide/trails`, `PATCH/DELETE /api/area-guide/trails/[id]`
- Same pattern for `things`, `places`, `park-sites`
- Bulk `PATCH /api/area-guide/park-sites` for batched map-position updates
- `GET /api/places/[id]` — Google Places proxy with 24h caching; `POST` for force-refresh (editor+)

### New tables (migrations 011 + 012)
- `trails` — hiking trails with stats, hazards, optional GPX data
- `things_to_do` — 60 activities with primary category + persona array
- `local_places` — Google Places cache
- `park_sites` — 109 RV sites with map coordinates

### Bug fixes (not tracked anywhere else)
| Issue | Fix |
|---|---|
| Login page didn't hydrate (eye icon dead, form refresh-submits) | Removed no-op `src/middleware.ts` that was forcing Astro to bundle the SSR middleware sequence handler; added dedicated `vendor-react` chunk to break `vendor-puck ↔ vendor-tiptap` TDZ cycle |
| Area Guide admin spammed infinite "Failed to load" toasts | Memoized `toast` object in ToastProvider; removed `toast` from useCallback deps |
| `.env.example` contained real Supabase keys AND was whitelisted from Netlify's secret scanner | Sanitized `.env.example` to placeholders; removed it from `SECRETS_SCAN_OMIT_PATHS` so scanner now checks it |
| Zoho WorkDrive sync added 0 rows | Filename sanitization (colons/spaces broke S3 paths); upload retry for 502/504; fail-loud on insert errors; Zoho timestamp normalization (human-readable `"Apr 14, 7:26 PM"` → ISO-8601) |
| Zoho Calendar sync `JSON_PARSE_ERROR` | Calendar API expects `range={"start":"...","end":"..."}` JSON-encoded, not three separate params; 30-day window chunking for >31-day queries; embed-key-vs-UID detection with actionable error message |
| `handleError` returned `"unknown error"` for non-Error-instance throws (most Supabase errors) | Extracts `.message`, `.code`, `.hint`, `.details` from plain-object errors in dev mode |
| `.env.example` in old `crr-rv-park-platform/.env` had real secrets | Noted in security task; rotation pending (see Deferred ops below) |

---

## 🔴 Backburnered — **READ BEFORE PRIORITIZING NEXT THREAD**

These are the non-trivial items we deliberately deferred during the V1 → V2 push. They do not resolve themselves. The owner's own stated priority ordering is: **R&PMS in 12 months**. Every week spent on marketing-content iteration is a week Session N doesn't ship.

### 1 · Security foundation ([SECURITY-PLAN.md](SECURITY-PLAN.md)) — completely untouched

The entire Session N → N+8 roadmap is the next priority once content-track momentum slows. R&PMS feature work is blocked on N → N+8 being complete.

| Session | Deliverable | Effort |
|---|---|---|
| **N** | `src/lib/crypto.ts` (AES-256-GCM envelope) + hash-chained audit log | ~3 hrs |
| N+1 | WebAuthn/passkey enforcement for owner + editor | ~4 hrs |
| N+2 | RBAC expansion (staff, accountant, board_member, contractor) + second Supabase project | ~3 hrs |
| N+3 | KMS migration (AWS or GCP) | ~3 hrs |
| N+4 | Immutable backup pipeline + restore verification | ~4 hrs |
| N+5 | Private `ops-docs` bucket + crypto for PMS | ~3 hrs |
| N+6 | DOMPurify + CSP nonces + SRI (replaces the current regex sanitizer) | ~4 hrs |
| N+7 | Lockdown + anomaly scorer + AI triage | ~6 hrs |
| N+8 | First R&PMS feature on top of everything above (validation) | ~4 hrs |

All of these are well-specified in [SECURITY-PLAN.md](SECURITY-PLAN.md) § 4. The plan is the spec — a new Claude thread can pick up Session N directly from it.

### 2 · Content population (Kendra / owner / contracted writer, not Claude)

The DB was seeded with scaffolding. Real content still needs to be entered via the admin UI:

- **60 things-to-do** — descriptions (HTML), `hero_image_url`, verified `lat`/`lng` if map-worthy. Current seed has title + summary + icon only.
- **6 trails** — **verify hazards and difficulty before publishing** (liability). Add hero images, verify distances, verify drive times. The on-property canyon trail is the crown jewel — consider recording a GPS track with a phone app (CalTopo / Gaia) so we own GPX data nobody else has.
- **5 local places** — replace placeholder `google_place_id` values (currently `TODO_PLACE_ID_*`) with real IDs via the admin UI → click Refresh. `/dining` auto-appears in nav once at least one real place is saved.
- **109 park sites** — real dimensions, amp service, rate, site type, `hero_image_url`, `map_position_x`/`y`. Placeholders ship with `$42/night standard 30-amp` for every site and evenly-distributed map positions.
- **Park map background image** — upload to Media Library, set as `/park-map` background (currently requires a DB row edit; proper config UI deferred — see §5 below).

### 3 · Unconfirmed Firefly integration

The park-map's "Book this site" button currently deep-links to the generic Firefly property page (`https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK`). Users pick the site manually on Firefly's screen.

**Open question for owner:** does Firefly support per-site deep-linking (URL parameter that pre-selects a specific site)? If yes, grab 2 example URLs and paste into each `park_sites.firefly_deep_link` via admin. If no, the generic link stays.

### 4 · Deferred operational work

- **Rotate `GOOGLE_MAPS_SERVER_KEY`** — owner pasted it in the earlier chat while providing values; server key is not domain-restricted, so chat-log exposure is a real (low-but-nonzero) risk. Google Cloud Console → Credentials → regenerate → update Netlify env var. ~60 seconds.
- **Clean up old `crr-rv-park-platform/.env`** (the pre-rename folder still on Matt's laptop) — contains real JWT-format Supabase keys + real `NETLIFY_AUTH_TOKEN` + real `ZOHO_CLIENT_SECRET` + real `SCHEDULED_FN_SECRET`. Either rotate all of those or delete the old folder entirely.
- **Zoho WorkDrive duplicate cleanup** — owner's WorkDrive folder has auto-generated timestamped duplicates (`aerial_canyon_rim 16-04-2026 23:53:44:985.webp`). Our sync handles them fine now but re-ingests as separate source images, producing bloat. Owner should delete the timestamped variants, keep only the clean-named originals. (Likely cause: a phone auto-upload tool with rename-on-conflict behavior.)
- **Cyber insurance + operational security** — all of [SECURITY-ANCILLARY-NOTES.md](SECURITY-ANCILLARY-NOTES.md) remains untouched. Admin-action items: insurance quote, endpoint EDR, YubiKey issuance, legal/privacy counsel, incident-response tabletops.

### 5 · Deferred features (nice-to-have, not blocking anything)

- **Drag-to-position UI for park sites** — currently numeric `map_position_x`/`y` inputs in admin. A click-to-drag canvas overlay would cut site-map data entry from hours to minutes.
- **Dedicated config UI for park-map background image** — currently a DB row edit.
- **Auto-scheduled Places cache refresh** — currently lazy (on page load if stale) + manual (admin "Refresh" button). A nightly scheduled job would be cleaner.
- **Rich-text editor for trail / activity descriptions** — currently a plain textarea that accepts HTML. Kendra would prefer WYSIWYG.
- **GPX upload + rendering on trail detail pages** — for the on-property canyon trail. Only from owner-recorded tracks — never from AllTrails/Strava/Gaia (ToS).
- **3D trail map** — Mapbox GL JS + OpenStreetMap trail data. Deferred because it's cool but not a conversion feature; 2D Google Map does 90% of the job. Revisit in 6 months based on traffic data.
- **Scheduled Netlify Functions** — still an open V1 item. `netlify.toml` declares three scheduled functions, but Astro's Netlify adapter wraps all API routes in a single SSR function, so named-function schedules may not fire. Workaround: manual "Sync now" buttons work; move scheduling to Supabase `pg_cron` when time permits.

---

## Open actions on the user

In priority order. None require Claude.

1. **Deploy DEV → Netlify (the big V2 deploy).** Single `git push`. Everything in this handoff lands at once.
2. **Run `npm run db:migrate`** against the prod Supabase project. Creates the 4 new tables + seeds. Safe to re-run.
3. **Confirm Netlify env vars are set:**
   - `PUBLIC_GOOGLE_MAPS_API_KEY` — domain-restricted browser key
   - `GOOGLE_MAPS_SERVER_KEY` — server-only key (consider rotating, see §4)
   - `ZOHO_CALENDAR_PUBLIC_EVENTS_ID` — **Calendar UID** (short 32-char hex), NOT the embed key (long `zz08…` string)
   - `SITE_URL` = `https://www.crookedriverranchrv.com` (exactly, no trailing slash)
   - All V1 env vars still required
3a. **Supabase → Authentication → URL Configuration** — must be set correctly or every invite email lands at `localhost:3000` (Supabase default) and invitees see access-denied:
   - **Site URL**: `https://www.crookedriverranchrv.com`
   - **Redirect URLs**: includes `https://www.crookedriverranchrv.com/**`
3b. **Always invite users through the admin UI** (`/admin/users` → Invite), NOT through Supabase's dashboard buttons. Our invite flow explicitly passes `redirectTo=/admin/login`; the dashboard buttons use Site URL only and won't land invitees on a functional page.
3c. **New in V2:** LoginForm now handles the "just-invited, need a password" case. When users arrive with `type=invite` or `type=recovery` in the URL hash, they see a "Welcome — set a password to activate your account" form. Same form also serves the "Forgot password" reset flow.
3d. **Consider configuring custom SMTP** (Supabase → Authentication → Email Templates → SMTP Settings). Default Supabase email has aggressive rate limits (3–4 auth emails/hour) and middling deliverability; SendGrid / Postmark / SES free tiers lift both limits permanently.
4. **Smoke-test after deploy:**
   - Hard refresh `/admin/login` → eye icon clicks, sign-in works
   - `/area-guide` → big map pins appear
   - `/trails` → 6 trail cards + map
   - `/things-to-do` → 60 cards + persona filter works, URL updates
   - `/admin/area-guide` → 4 tabs load with data
   - Media library → Zoho WorkDrive sync populates images
   - Events → Zoho Calendar sync populates events
5. **Content entry** (ongoing, Kendra-friendly): replace placeholders per §2 above.

---

## Environment variables (Netlify dashboard)

All V1 variables still required. New for V2:

| Variable | Purpose | Public? |
|---|---|---|
| `PUBLIC_GOOGLE_MAPS_API_KEY` | Browser Google Maps + Places | Yes (domain-restricted) |
| `GOOGLE_MAPS_SERVER_KEY` | Server-side Places API lookups | **No — server-only** |

Both documented in [AREA-GUIDE-SETUP.md](AREA-GUIDE-SETUP.md).

---

## File map — what changed since V1

```
src/
├── components/
│   ├── Lightbox.astro                        ← NEW (global lightbox)
│   ├── GoogleMap.astro                       ← NEW (reusable map)
│   ├── LocalPlaceCard.astro                  ← NEW
│   ├── Nav.astro                             ← UPDATED (Area Guide dropdown)
│   └── sections/
│       ├── PuckRenderer.astro                ← UPDATED (href cards + data-lightbox)
│       ├── CardGrid.astro, AmenityGrid.astro,
│       │   SiteCards.astro, TrustBar.astro,
│       │   TwoCol.astro, Interlude.astro     ← UPDATED (matching href/lightbox)
│       └── ... (other sections unchanged)
│
├── components/react/
│   ├── AreaGuideAdmin.tsx                    ← NEW (four-tab admin)
│   ├── ParkSiteMap.tsx                       ← NEW (clickable park map)
│   ├── Toast.tsx                             ← UPDATED (memoized — fixed loop)
│   └── AdminShell.tsx                        ← UPDATED (sidebar link)
│
├── layouts/
│   └── Base.astro                            ← UPDATED (mounts Lightbox)
│
├── lib/
│   ├── area-guide.ts                         ← NEW (data-access helpers)
│   ├── zoho.ts                               ← UPDATED (timestamp normalize,
│   │                                            calendar chunking, JSON range)
│   ├── api.ts                                ← UPDATED (handleError surfaces
│   │                                            Supabase error details)
│   ├── rbac.ts                               ← UPDATED (new capabilities)
│   └── (others unchanged)
│
├── pages/
│   ├── trails/index.astro, [slug].astro     ← NEW
│   ├── things-to-do/index.astro, [slug].astro ← NEW
│   ├── dining.astro                          ← NEW
│   ├── park-map.astro                        ← NEW
│   ├── area-guide.astro                      ← UPDATED (big map + CTAs)
│   ├── admin/area-guide.astro                ← NEW
│   └── api/
│       ├── places/[id].ts                    ← NEW (Google Places proxy)
│       └── area-guide/
│           ├── trails.ts, trails/[id].ts    ← NEW
│           ├── things.ts, things/[id].ts    ← NEW
│           ├── places.ts, places/[id].ts    ← NEW
│           └── park-sites.ts, park-sites/[id].ts ← NEW
│
└── (middleware.ts — DELETED, fixed login hydration)

supabase/migrations/
├── 011_area_guide_tables.sql                 ← NEW (4 tables + RLS)
└── 012_seed_area_guide.sql                   ← NEW (seed data)

astro.config.mjs                              ← UPDATED (vendor-react chunk)
public/styles/global.css                      ← UPDATED (card-link hover styles)
public/sitemap.xml                            ← UPDATED (+4 routes)
netlify.toml                                  ← UPDATED (scanner whitelist trimmed)

Docs added this thread:
├── AREA-GUIDE-SETUP.md                       ← post-deploy setup guide
└── HANDOFF-V2-AREA-GUIDE.md (this file)
```

---

## How to start a new thread

Paste this file into the context. Mention:

> "V1.0 stable is frozen at `crr-rv-park-platform-V1.0-STABLE-2026-04-16`. V2 (area-guide expansion) is live in `crr-rv-park-platform-DEV`. Read HANDOFF-V2-AREA-GUIDE.md to see the current state and the backburnered list. SECURITY-PLAN.md Session N is the top non-content priority. Don't touch the stable snapshot."

A new thread should be able to:
- Understand where the destination-guide layer ends and V1 infrastructure begins
- Know that Session N is the top non-content priority when content momentum slows
- Know where the content gaps are (per §2 Backburnered)
- Avoid re-litigating decisions already made (SECURITY-PLAN.md is the plan; don't re-plan it)

---

## Deploy procedure (unchanged from V1)

1. `git add -A && git commit -m "feat(v2): area guide + clickability + Zoho sync fixes"`
2. `git push`
3. Wait for Netlify build (single ~3 min deploy for all of V2)
4. Run migrations against prod Supabase (one-time, then future deploys only need migrations for new schema)
5. Run smoke-test list above
6. If anything breaks → Netlify → Deploys → pick last known good → "Publish deploy" (instant rollback, no rebuild cost)

---

## When things break (V2 additions)

| Symptom | Likely cause | Fix |
|---|---|---|
| `/area-guide`, `/trails` etc. show empty states | Migrations haven't run on prod | `npm run db:migrate` |
| Google Map shows "Map will appear here" fallback | `PUBLIC_GOOGLE_MAPS_API_KEY` missing or referrer-restricted to wrong domain | Check env var + referrer list in Google Cloud Console |
| `/dining` cards show "Unnamed place" with no photos | `google_place_id` values are still `TODO_*` placeholders | Admin → Area Guide → Local Places → edit + paste real IDs → Refresh |
| Admin toast loop ("Failed to load …" stacked) | Regression of the V2 Toast memoization fix | Check `src/components/react/Toast.tsx` — `toast` must be wrapped in `useMemo` |
| Zoho calendar sync says "JSON_PARSE_ERROR" | UID is the embed key, not the API UID | Settings → Find my calendars → copy short UID → update Netlify env |
| Zoho calendar sync says "RANGE_CANNOT_EXCEED_31DAYS" | Regression of the window chunking fix | Check `listCalendarEvents` in `src/lib/zoho.ts` — must loop in 30-day windows |
| WorkDrive sync says "+N added" but no photos | Regression of the fail-loud insert check | Check `ingestFile` in `src/pages/api/zoho/drive-sync.ts` — must throw on insert error |
| Login page doesn't hydrate (eye icon dead, form reloads) | `src/middleware.ts` got recreated OR `vendor-react` chunk removed from `astro.config.mjs` | Delete middleware.ts + confirm vendor-react rule exists |

---

## Philosophy (carried forward from SECURITY-PLAN.md §7)

- **Disconnect as defense** — phone + staff is the business; lockdown is free + brand-positive
- **Secure-by-design, before-the-feature** — crypto + audit-chain ship before R&PMS data
- **Offline-first staff ops** — the PWA keeps the park bookable by phone even during lockdown

The V2 content push doesn't violate any of these; it just adds content surface area. The philosophical posture applies fully to Session N onward.

---

*V2 tagged 2026-04-17. Next thread starts with either Session N (security foundation → R&PMS unlocked) or continued content work (admin-only, no more Claude needed), depending on owner priority.*
