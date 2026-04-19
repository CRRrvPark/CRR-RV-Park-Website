# Project Details — Crooked River Ranch RV Park Platform

> Deep architectural reference. Read this before making structural changes.
> Companion to `HANDOFF-V1-TO-NEW-THREAD.md`.

---

## 1. Product overview

A full-stack CMS-backed marketing website for a 113-site RV park in Terrebonne, Oregon. The owner (non-technical) edits content via a drag-and-drop Visual Builder; the public site serves fast prerendered pages; Zoho integrations pull media + events automatically.

**Three audiences use this codebase:**

1. **Park guests** (public) — browse site types, amenities, book online (via external Firefly Reservations), check events.
2. **Park staff** (editor/owner roles) — edit pages in Visual Builder, manage media library, post events.
3. **Developer / successor** (anyone holding the code) — deploy, extend, fix.

---

## 2. Tech stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Astro | 5.18 |
| Adapter | @astrojs/netlify | 6.x |
| UI islands | React | 18 |
| Visual Builder | @puckeditor/core | 0.21 |
| Rich text | Tiptap | 2.10 |
| Code editor (admin) | Monaco + @monaco-editor/react | 4.7 |
| Database + Auth + Storage | Supabase | 2.45 |
| Hosting + Functions + Forms | Netlify | — |
| Image processing | sharp | 0.33 |
| Analytics | Microsoft Clarity | tag `w90s0eo24y` |
| External: media source | Zoho WorkDrive | — |
| External: events source | Zoho Calendar | — |
| External: reservations | Firefly Reservations | (link-out only) |
| Validation | Zod | 3.23 |

Astro output mode: `server` (SSR), but every public page opts back into `prerender = true`. Admin + API routes stay dynamic.

---

## 3. High-level architecture

```
        ┌──────────────────────────────────────────────────────────┐
        │                       End user (browser)                  │
        └───────────┬─────────────────────────────────┬────────────┘
                    │                                 │
                    │ /…                              │ /admin/…
                    │ (prerendered HTML from          │ (SSR React islands)
                    │  Netlify CDN edge)              │
                    ▼                                 ▼
        ┌────────────────────┐           ┌────────────────────────┐
        │   Static HTML      │           │   AdminShell (React)   │
        │   (build-time from │           │   Sidebar + topbar     │
        │    Supabase)       │           │   + Command Palette    │
        └───────┬────────────┘           └───────────┬────────────┘
                │                                    │
                │ <img>, <link>                      │ apiGet/apiPost
                ▼                                    ▼
        ┌────────────────────┐           ┌────────────────────────┐
        │  Netlify CDN       │           │  Netlify Functions     │
        │  /images, /assets  │           │  /api/**/*.ts          │
        └─────────┬──────────┘           └───────────┬────────────┘
                  │                                  │
                  │ (cached 1y)                      │ service-role key
                  ▼                                  ▼
        ┌────────────────────┐           ┌────────────────────────┐
        │  Supabase Storage  │◄──────────┤  Supabase Postgres     │
        │  (media variants)  │           │  RLS gates anon/key    │
        └─────────▲──────────┘           └──────────┬─────────────┘
                  │                                 │
                  │ sharp + upload                  │ pg_cron (schedules)
                  │                                 │
        ┌─────────┴──────────┐                      │
        │  Zoho WorkDrive    │                      │
        │  (owner-edited)    │                      │
        └────────────────────┘                      │
                                                    │
                                          ┌─────────┴─────────┐
                                          │  Zoho Calendar    │
                                          │  (public events)  │
                                          └───────────────────┘
```

**Key data flows:**

- **Publish flow**: Admin edits → `page_drafts` → Publish → `page_versions` snapshot → `pages.page_builder_data` → `triggerBuildHook()` → Netlify rebuilds → prerendered HTML updated.
- **Media flow**: Owner drops JPG in Zoho WorkDrive → scheduled/manual drive-sync → `listWorkDriveFolderFiles()` → filter images → download → sharp variants (JPG/WebP/mobile-WebP) → Supabase Storage → `media` table row.
- **Events flow**: Owner adds event in Zoho Calendar → scheduled/manual calendar-sync → `listCalendarEvents()` → upsert into `events` table by `zoho_event_uid` + `etag` → prerendered `/events` page shows them.

---

## 4. Directory structure (annotated)

```
src/
├── layouts/
│   ├── AdminBase.astro      ← Every /admin/* page wraps in this. Includes:
│   │                          - AdminShell React island
│   │                          - ClarityScript OMITTED (admin isn't analytics-tracked)
│   │                          - Robots: noindex,nofollow
│   │                          - Cache-Control: no-store
│   └── Base.astro           ← Every public page wraps in this. Includes:
│                              - HeadMeta (fonts, OG, preconnect, hero preload)
│                              - JsonLd (structured data)
│                              - Nav.astro
│                              - <slot />
│                              - Footer.astro
│                              - ClarityScript (deferred on window.load)
│
├── pages/
│   ├── index.astro          ← ★ Home, prerender=true. Uses PageRenderer which
│   │                          dispatches to PuckRenderer if use_page_builder=true.
│   │                          Has JSON-LD Campground + Organization schemas.
│   ├── [slug].astro         ← Catch-all for dynamic slugs (prerender=false).
│   │                          Rare — most slugs are their own files.
│   ├── {amenities,area-guide,book-now,events,extended-stays,golf-course,
│   │   golf-stays,group-sites,park-policies,privacy,terms}.astro
│   │                        ← Each prerendered. Some still use legacy
│   │                          section-based content (e.g. events.astro pulls
│   │                          from `events` table).
│   │
│   ├── admin/
│   │   ├── login.astro      ← Public login page, splits into marketing +
│   │   │                      form columns. Mounts LoginForm with client:load.
│   │   ├── index.astro      ← Dashboard — stats + health + recent activity.
│   │   ├── editor/
│   │   │   ├── index.astro  ← Pages list (PagesAdmin). Banner → Builder.
│   │   │   └── [slug].astro ← ★ Legacy field editor (PageEditor).
│   │   │                      Banner at top directs users to Visual Builder.
│   │   ├── builder/
│   │   │   └── [slug].astro ← ★★ Puck Visual Builder (PageBuilder).
│   │   │                       Primary edit surface.
│   │   ├── media.astro      ← Media Library (MediaAdmin). Peek + Sync buttons.
│   │   ├── events.astro     ← Events list + publish toggle.
│   │   ├── users.astro      ← User invites + role assignment.
│   │   ├── settings.astro   ← ★ Zoho integrations + repair-home + calendar discovery.
│   │   ├── versions.astro   ← Restore from snapshot.
│   │   ├── audit.astro      ← Change log with diff viewer.
│   │   ├── runbook.astro    ← Operations manual (editable in-place).
│   │   └── code.astro       ← Monaco for layout/template edits (owner only).
│   │
│   └── api/
│       ├── auth/
│       │   └── logout.ts    ← Clears Supabase session cookies.
│       ├── pages/
│       │   ├── index.ts     ← GET: list; POST: create.
│       │   └── [id].ts      ← GET: detail; PATCH: update; DELETE: remove.
│       ├── sections/
│       │   ├── index.ts     ← CRUD for legacy section rows.
│       │   ├── [id].ts
│       │   └── reorder.ts   ← Batch display_order updates.
│       ├── content/
│       │   └── blocks.ts    ← Read all blocks for a page (legacy editor).
│       ├── events/          ← events CRUD.
│       ├── users/           ← invite + role + activate/deactivate.
│       ├── media/           ← list + edit alt/caption + delete.
│       ├── publish.ts       ← ★ Production publish. Creates snapshot,
│       │                      inserts publishes row, triggers build hook,
│       │                      webhook updates status.
│       ├── publish/
│       │   ├── [id]/status.ts
│       │   └── webhook.ts   ← Netlify build-finished callback; auto-rollback on fail.
│       ├── snapshots/
│       │   ├── index.ts     ← list snapshots.
│       │   ├── [id].ts      ← read one.
│       │   ├── restore.ts   ← restore pages from snapshot.
│       │   └── prune.ts     ← cron: delete old snapshots.
│       ├── builder/
│       │   ├── draft.ts     ← GET current Puck data (draft/published/empty).
│       │   ├── save.ts      ← ★ auto/manual/publish modes.
│       │   │                  On publish: snapshot + update page_builder_data
│       │   │                  + use_page_builder=true + trigger build hook.
│       │   ├── restore.ts   ← restore a page version.
│       │   ├── versions.ts  ← list page versions.
│       │   ├── templates.ts ← save + list page templates.
│       │   └── repair-home.ts ← ★ fills empty SiteCards + Interlude bg.
│       ├── zoho/
│       │   ├── oauth-callback.ts   ← handles Zoho consent screen return.
│       │   ├── status.ts           ← connection + last-sync state.
│       │   ├── calendars.ts        ← ★ list user's calendars (for UID discovery).
│       │   ├── calendar-sync.ts    ← pull events for next 6 months.
│       │   ├── drive-sync.ts       ← mirror WorkDrive folder to Supabase.
│       │   └── workdrive-peek.ts   ← ★ diagnostic: what Zoho returns right now.
│       ├── sync/
│       │   └── status.ts    ← multi-service sync health for Dashboard.
│       ├── runbook/
│       │   └── pdf.ts       ← export runbook as PDF.
│       ├── runbook.ts       ← save runbook text.
│       ├── code/
│       │   ├── drafts.ts    ← code editor saves.
│       │   └── publish.ts   ← promote code draft.
│       └── debug/
│           └── env-check.ts ← admin diagnostic for env vars.
│
├── components/
│   ├── HeadMeta.astro       ← Title/meta/OG/canonical/preconnect/fonts/hero-preload.
│   ├── Nav.astro            ← Sticky nav + mobile menu. No JS.
│   ├── Footer.astro         ← Footer columns + copyright.
│   ├── JsonLd.astro         ← <script type="application/ld+json">.
│   ├── ClarityScript.astro  ← Microsoft Clarity, deferred on window.load.
│   ├── Breadcrumbs.astro
│   ├── UpcomingEvents.astro ← Inline events widget for non-Puck pages.
│   ├── PageRenderer.astro   ← ★ Dispatcher: checks use_page_builder on page,
│   │                          then renders PuckRenderer OR legacy sections.
│   │
│   ├── sections/
│   │   ├── PuckRenderer.astro   ← ★★ Server-side Puck JSON → HTML.
│   │   │                           Handles 19 component types.
│   │   │                           This is where the public site's dynamic
│   │   │                           content actually renders.
│   │   └── {Hero,TrustBar,TwoCol,Interlude,CardGrid,AmenityGrid,
│   │       ExploreGrid,SiteCards,Reviews,CtaBanner,TextBlock,
│   │       EventsWidget,ReserveForm,RatesTable,FeatureList}.astro
│   │                            ← 15 legacy section components. Used by
│   │                              PageRenderer when use_page_builder=false.
│   │
│   └── react/
│       ├── AdminShell.tsx       ← Sidebar + topbar + ⌘K palette + ? help.
│       ├── AdminProviders.tsx   ← React Context wrapper (auth/toast/confirm).
│       ├── AuthContext.tsx      ← session state.
│       ├── AuthGuard.tsx        ← redirects to /admin/login if unauth.
│       ├── Toast.tsx, ConfirmDialog.tsx, Spinner.tsx
│       ├── api-client.ts        ← ★ apiGet/apiPost/apiPatch/apiDelete with
│       │                          Supabase JWT injection + ApiError class.
│       │
│       ├── PageBuilder.tsx      ← ★★ Puck editor mount.
│       ├── PageEditor.tsx       ← Legacy field editor (demoted, still works).
│       ├── PagesAdmin.tsx       ← Pages list. Banner → Builder.
│       ├── MediaAdmin.tsx       ← Grid + detail modal + Peek diagnostic.
│       ├── EventsAdmin.tsx      ← Month-grouped list + publish toggle.
│       ├── UsersAdmin.tsx       ← Invite + role + owner-minimum-2 rule.
│       ├── Settings.tsx         ← ★ Zoho integrations + calendar discovery +
│       │                          embed-key warning + repair-home.
│       ├── Versions.tsx, AuditLog.tsx, RunbookEditor.tsx, CodeEditor.tsx
│       ├── Dashboard.tsx        ← hero publish card + stats + health + activity.
│       ├── LoginForm.tsx        ← email/password + Show-password + reset.
│       ├── SectionTypePicker.tsx ← Legacy section picker.
│       ├── CommandPalette.tsx   ← ⌘K fuzzy jump.
│       ├── HelpPanel.tsx        ← docked help drawer.
│       ├── BuilderOnboarding.tsx, BuilderSeoPanel.tsx,
│       │   BuilderStylePanel.tsx, BuilderTemplates.tsx
│       │                        ← Puck-adjacent side panels.
│       │
│       ├── puck-components/     ← Section components registered with Puck.
│       │   ├── index.ts         ← Barrel export → consumed by puck-config.
│       │   ├── sections.tsx     ← ★ 15 component renderers (ImageBlock +
│       │   │                      Hero + TwoColumn + … + TrustBar).
│       │   ├── ErrorBoundary.tsx
│       │   └── fields/
│       │       ├── MediaPickerField.tsx  ← custom field: picks from /api/media.
│       │       └── MediaPickerModal.tsx
│       │
│       ├── editors/             ← Legacy field editors (still used by
│       │   ├── EditableText.tsx    PageEditor on /admin/editor/[slug]).
│       │   ├── EditableRichText.tsx  (Tiptap-based)
│       │   ├── EditableImage.tsx
│       │   └── EditableJson.tsx
│       │
│       └── ui/                  ← Design system primitives.
│           ├── index.ts         ← barrel export.
│           ├── Icon.tsx         ← ~30 inline SVG icons.
│           ├── Button.tsx       ← variants: primary/secondary/ghost/danger.
│           ├── Field.tsx        ← TextInput / TextArea / Select / Field wrapper.
│           ├── Card.tsx, CardHeader, StatCard.
│           ├── Modal.tsx, ConfirmModal.
│           └── EmptyState.tsx.
│
└── lib/
    ├── api.ts               ← json() / requireAuth() / requireRole() /
    │                          requireScheduledOrAuth() / handleError().
    ├── auth.ts              ← verifyRequestUser() — reads Supabase cookie
    │                          OR Authorization: Bearer header.
    ├── rbac.ts              ← ★ capability matrix. Roles: owner / editor / viewer.
    │                          Exports can(role, capability): boolean.
    ├── supabase.ts          ← serverClient() (service-role, SSR/Functions) +
    │                          browserClient() (anon, browser).
    ├── zoho.ts              ← ★ OAuth + buildAuthorizationUrl + exchangeCode
    │                          + refresh + listWorkDriveFolderFiles +
    │                          downloadWorkDriveFile + listCalendarEvents +
    │                          listCalendars + isImageFile() + zohoFetch() wrapper.
    ├── netlify.ts           ← triggerBuildHook() + restoreDeploy (rollback).
    ├── audit.ts             ← logAudit() writes to audit_log table.
    ├── content.ts           ← captureSnapshot() + BannedWordError.
    ├── images.ts            ← sharp: generate jpg/webp/mobile-webp variants.
    ├── email.ts             ← (admin invites — stub).
    ├── page-content.ts, section-blocks.ts, section-types.ts
    │                        ← legacy section content helpers.
    └── puck-config.tsx      ← ★ Puck Config: categories + 19 components.
                              Merges puck-components/* at bottom.

public/
├── styles/
│   ├── global.css           ← Public site design system (~25KB).
│   ├── admin.css            ← Admin design tokens + primitives.
│   └── puck-overrides.css   ← Aligns Puck UI with admin palette.
├── images/                  ← 50+ JPG/WebP/mobile-WebP assets.
│                              Synced from Zoho WorkDrive (not tracked in git
│                              for any new files after initial seed).
├── __forms.html             ← ★ Netlify Forms build-time detection stubs.
│                              Declares: contact, inquiry, group-inquiry,
│                              extended-stay-inquiry. Hidden, not linked.
├── BingSiteAuth.xml, robots.txt, sitemap.xml, rv_park_rules.pdf
└── scripts/                 ← (currently empty).

scripts/
├── supabase-migrate.mjs     ← runs migrations against Supabase.
└── bootstrap-first-owner.mjs ← creates the initial owner account.

supabase/migrations/         ← SQL migration files.

astro.config.mjs             ← output:'server' + manualChunks + chunkWarningLimit.
netlify.toml                 ← CSP + cache headers + redirects + scheduled funcs.
package.json                 ← deps + scripts.
tsconfig.json
```

---

## 5. Database schema (high level)

| Table | Purpose |
|---|---|
| `users` | Profile + role (owner/editor/viewer) per auth.users row. |
| `pages` | Public pages. Columns: slug, title, meta, `is_draft`, `is_protected`, `show_in_main_nav`, `use_page_builder`, `page_builder_data` (JSONB). |
| `sections` | Legacy section rows per page. `type`, `display_order`, `is_visible`. |
| `content_blocks` | Legacy per-field content. `block_type` + typed value columns. |
| `page_drafts` | Active Puck draft per page (one row per page_id). |
| `page_versions` | Snapshot history per page. `reason`: auto / manual / publish / pre_restore / migration. |
| `snapshots` | Global site snapshots (all pages, all sections, all blocks) used by /publish flow. |
| `publishes` | Publish events. status: queued / building / success / failed. |
| `audit_log` | Who-did-what-when for every sensitive action. |
| `media` | Image records. `zoho_resource_id`, filenames, sizes, public URLs for 3 variants. |
| `events` | Calendar events. `zoho_event_uid`, `zoho_etag`, `is_published`. |
| `zoho_tokens` | OAuth tokens per service (workdrive/calendar). |
| `sync_runs` | History of each sync execution. |
| `runbook_content` | Editable operations manual. |
| `code_drafts` | Monaco editor saves before publish. |
| `page_templates` | Saved Puck templates. |

All tables have RLS enabled. Service-role key bypasses RLS (server-only). Anon/authenticated keys are subject to per-table policies (documented in migrations).

---

## 6. RBAC capability matrix

Defined in `src/lib/rbac.ts`. Three roles:

- **viewer** — read-only access to admin (for onboarding/training).
- **editor** — content + media + events CRUD + publish.
- **owner** — everything, plus user management, code editor, settings.

Capabilities include: `edit_content_draft`, `publish_content`, `upload_media`, `delete_media`, `view_events`, `view_users`, `view_audit_log`, `view_snapshots`, `view_runbook`, `view_code`, etc.

`requireRole(request, capability)` in `src/lib/api.ts` enforces this at the endpoint level. Every API endpoint gates at least on `requireAuth` and usually on `requireRole`.

---

## 7. Visual Builder (Puck) internals

- **Library**: @puckeditor/core v0.21 (React-based drag-drop editor).
- **Config**: `src/lib/puck-config.tsx` registers 19 components in 7 categories.
- **Components**: 4 inline (TextBlock, Spacer, Divider, HtmlEmbed/VideoEmbed) + 15 from `puck-components/sections.tsx` (HeroSection, TwoColumnSection, CardGridSection, …).
- **Data shape**: `{ content: [{ type, props }], root: { props }, zones: {} }`.
- **Auto-save**: 2s debounce to `/api/builder/save?reason=auto`. Also uses `navigator.sendBeacon` on page unload.
- **Publish**: writes to `pages.page_builder_data`, flips `use_page_builder=true`, creates a `page_versions` row with reason=publish, clears the draft, triggers Netlify build hook.
- **Restore**: pre-restore snapshot is auto-created, then the selected version is written to the draft (admin must publish it to go live).
- **Public render**: `src/components/sections/PuckRenderer.astro` pattern-matches on `item.type` and emits hand-written Astro JSX. This mirrors each Puck component's editor-side render.
- **Mobile image position**: `TwoColumnSection` has `mobileImagePosition` field. Emits `data-mobile-img` attribute. CSS media query at `max-width:900px` uses flex `order` to swap.
- **ImageBlock / resize**: `width`, `height`, `objectFit`, `borderRadius` fields. PuckRenderer applies them inline.
- **SEO panel**: `BuilderSeoPanel.tsx` writes title/meta/OG to the `pages` table.
- **Global styles**: `BuilderStylePanel.tsx` persists to `root.props.globalStyles` in the Puck data.
- **Templates**: saved to `page_templates` table; load replaces the current draft.

---

## 8. External integrations

### Zoho

- **OAuth app**: Owner registers at api-console.zoho.com, sets redirect URI to `https://www.crookedriverranchrv.com/api/zoho/oauth-callback`.
- **Scopes requested**: `WorkDrive.files.ALL`, `WorkDrive.team.READ`, `ZohoCalendar.event.READ`, `ZohoCalendar.calendar.READ`.
- **API hosts**: `accounts.zoho.com` (OAuth), `workdrive.zoho.com/api/v1` (drive), `calendar.zoho.com/api/v1` (calendar). DO NOT use `www.zohoapis.com/calendar/*` — it 404s.
- **Token storage**: `zoho_tokens` table. Refresh token is long-lived; access token refreshed automatically when ≤5 min from expiry.
- **Verbose logging**: every API call flows through `zohoFetch()` which logs actual response body on non-2xx.
- **Image filter**: `isImageFile()` checks `mime_type` starting with `image/` OR `type === 'image'` OR extension in (jpg/jpeg/png/webp/gif/avif/bmp/tiff/heic).

### Supabase

- **Auth**: email/password. Password reset via `resetPasswordForEmail`.
- **Session**: Supabase SSR client reads HTTP-only cookies on the server, browser client uses localStorage.
- **Storage**: `media` bucket — public-read, service-role-write. 3 variants per image (jpg + webp + mobile-webp).
- **Row-Level Security**: enabled on every table. Anon/authenticated clients see only what policies allow.
- **Service role**: used by SSR functions for privileged writes (after `requireAuth`/`requireRole` gate).

### Netlify

- **Hosting**: Astro adapter emits one SSR function + static prerendered pages.
- **Functions**: 40+ API endpoints bundled into `.netlify/v1/functions`.
- **Forms**: detects `<form data-netlify="true">` at build time. Because we're on SSR, we can't rely on Netlify scanning runtime HTML — static stubs in `public/__forms.html` register the form names.
- **Build hooks**: `triggerBuildHook()` POSTs to `NETLIFY_BUILD_HOOK` URL to kick off a deploy. Called by `/api/publish` and `/api/builder/save?reason=publish`.
- **Auto-rollback**: `/api/publish/webhook` listens for `deploy_failed` events and calls Netlify's `restoreDeploy` API to roll back.

### Microsoft Clarity

- Inline script loads the Clarity snippet deferred on `window.load`. Tag: `w90s0eo24y`. No admin tracking.

---

## 9. CSS architecture

- `public/styles/global.css` — public site. ~300 lines, heavily shorthand (`.st`, `.sl`, `.sv`, `.fl`, `.fi`, `.fn`, `.ft`, `.am-card`, `.site-card`, etc.). Uses CSS variables for brand palette (`--rust`, `--sand`, `--gold`, `--deep`, `--serif`).
- `public/styles/admin.css` — admin design system. ~500 lines of tokens + primitive classes.
- `public/styles/puck-overrides.css` — aligns Puck's default UI with admin palette.

**Responsive breakpoints**: 900px (tablet/mobile-landscape) and 580px (phone).

---

## 10. Build / deploy / dev

### Local dev

```bash
npm install
cp .env.example .env   # then fill with real values from vault
npm run dev            # http://localhost:4321
```

### Migrations

```bash
npm run db:migrate
```

### Bootstrap first owner

```bash
npm run bootstrap:first-owner
```

### Build

```bash
npm run build   # emits dist/ with static pages + .netlify/v1/functions
```

### Deploy

Push to git main → Netlify auto-builds. Or Netlify CLI: `netlify deploy --prod`.

---

## 11. Performance notes

- **Prerender** on all public pages: sub-100ms TTFB from CDN.
- **Hero image**: `<picture>` with mobile/desktop WebP sources + JPG fallback, `fetchpriority="high"`.
- **Fonts**: preloaded with `media="print" onload="this.media='all'"` swap — non-blocking.
- **Cache headers**: `/images/*` and `/assets/*` → `max-age=31536000, immutable`. Admin + API → `no-store`.
- **Manual chunks**: Monaco, Puck, Tiptap, Supabase split into vendor chunks for cacheability.
- **Clarity**: deferred until window.load (zero critical-render impact).

---

## 12. Naming + style conventions

- Astro components: PascalCase, `.astro` extension.
- React components: PascalCase, `.tsx`, one component per file where reasonable.
- Lib modules: lowercase with hyphens, `.ts`. Export small, pure functions.
- API routes: follow REST-ish semantics. Prefer `GET` for reads, `POST` for writes when resource-less, `PATCH` for updates.
- `requireAuth` on every protected route at the top of the handler.
- Errors: throw typed Error classes (`UnauthenticatedError`, `ForbiddenError`, `BannedWordError`) → caught by `handleError` → mapped to HTTP status.
- CSS class names on public site: short (2-4 chars) for the hand-written original site's aesthetic. Admin uses full design-tokens.

---

## 13. Cross-cutting concerns

### Error surfacing

- **Public API errors** go through `handleError(err)` which distinguishes auth errors from unknown ones and doesn't leak internals to the browser in prod.
- **Zoho API errors** go through `zohoFetch()` which logs the full response body to Netlify function logs (for postmortem).
- **Editor UI errors** use `<Toast>` notifications.

### Auditing

- Every sensitive action writes to `audit_log` via `logAudit()`.
- Fields: actor_id, actor_email, action, target_table, target_id, target_label, ip, user_agent, notes.
- Viewable in `/admin/audit`.

### Idempotency

- Builder save is idempotent per (page_id, reason=auto) — upserts draft.
- repair-home endpoint is idempotent — only touches empty fields.
- Sync endpoints upsert on Zoho resource IDs / event UIDs.

### Draft vs published

- `page_drafts` — ephemeral working copy per page.
- `pages.page_builder_data` — the published version.
- Public site ALWAYS reads `pages.page_builder_data`, never the draft.

---

## 14. Accessibility + SEO

- Every page has canonical URL, description, OG image.
- Home page includes Campground + Organization JSON-LD.
- Images have `alt` attributes (admin can edit in Media Library).
- Admin has `noindex, nofollow` robots + X-Robots-Tag.
- Sidebar nav uses `aria-current="page"` for active item.
- Forms have explicit `<label for>` associations.

---

## 15. Testing

No automated tests are in place. The project has been manually verified against the reference multipage site in `../Website/crr-rv-park-multipage`. Recommended additions when time permits:

- Playwright E2E for login → dashboard → builder → publish → live page update.
- Vitest unit tests for `rbac.ts`, `zoho.ts` (isImageFile, toZohoCompactDate), `page-content.ts`.

---

*End of project details. Keep this file updated as the architecture evolves.*
