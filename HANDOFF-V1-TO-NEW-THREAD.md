# Handoff — V1.0 Stable → Next Thread

> ⚠ **SUPERSEDED BY [HANDOFF-V2-AREA-GUIDE.md](HANDOFF-V2-AREA-GUIDE.md)** (tagged 2026-04-17).
>
> V2 reflects the current state of the DEV folder: login fix, clickability/lightbox, full destination-guide (/trails, /things-to-do, /dining, /park-map), Zoho sync fixes, and the `/admin/area-guide` CRUD UI. Start there for any new thread.
>
> This V1 file is preserved as a historical snapshot of the V1.0 stable cut only.
>
> ---
>
> **Date tagged:** 2026-04-16
> **Project path (after rename):** `C:\Users\mathe\Documents\RV Park\crr-rv-park-platform-V1.0-STABLE-2026-04-16`
> **Dev copy path:** `C:\Users\mathe\Documents\RV Park\crr-rv-park-platform-DEV`
> **Live URL:** https://www.crookedriverranchrv.com
> **Owner:** Mathew Birchard (mathew.birchard25@gmail.com)

---

## Read this first

This codebase is the **first stable, feature-complete version** of the Crooked River Ranch RV Park website platform. It is a multi-layered product:

1. **Public marketing site** (static/prerendered) — 12 pages, all pull content from Supabase at build time.
2. **Admin console** at `/admin/*` — full CMS with Visual Builder (Puck), media library, events, users, code editor, version history, runbook.
3. **Serverless backend** on Netlify Functions — 40+ API endpoints for content, auth, sync, publish, builder, etc.
4. **External integrations** — Zoho (WorkDrive images + Calendar events), Supabase (DB + Auth + Storage), Netlify (hosting + Functions + Forms + Build hooks), Microsoft Clarity (analytics).

Everything below is what works right now and what remains to be done. Read `PROJECT-DETAILS.md` for deep architecture before making changes.

---

## Current live status

| Area | State | Notes |
|---|---|---|
| Public site renders | ✅ | All 12 pages prerendered at build time |
| Home page hero | ✅ | Puck-driven; `<picture>` with fetchpriority=high |
| Visual Builder (Puck) | ✅ | `/admin/builder/{slug}` — drag, drop, resize, image-side, mobile override |
| Legacy field editor | ✅ (demoted) | `/admin/editor/{slug}` — kept for edge cases, banner directs users to Builder |
| Reservation form (Netlify Forms) | ✅ | Wired into `ReserveFormSection` + `__forms.html` stubs for build-time detection |
| Zoho OAuth | ✅ | Works end-to-end |
| Zoho Calendar sync | ⚠️ | Code is correct; **user must swap calendar UID** (see Open Actions) |
| Zoho WorkDrive sync | ⚠️ | Code is correct; **new Peek diagnostic ready**; first real test pending |
| Publish → Netlify rebuild | ✅ | `/api/publish` AND `/api/builder/save` (publish reason) both trigger |
| Auto-save drafts | ✅ | Puck builder saves every 2s, sendBeacon on page unload |
| Version history + restore | ✅ | Pre-restore snapshot auto-created |
| Role-based access (RBAC) | ✅ | Owner / editor / viewer — see `src/lib/rbac.ts` |
| Content repair button | ✅ | Settings → "Restore default home content" (fixes empty SiteCards + missing Dark Skies bg) |
| RUM metrics targets | ⚠️ projected | LCP / FCP / INP all optimized; confirm after 48h of traffic |

---

## Open actions on the user

1. **Deploy the current code** — Netlify will prerender all public pages at build time. First deploy will be slower than subsequent ones.
2. **Swap `ZOHO_CALENDAR_PUBLIC_EVENTS_ID` env var**: the current value (`zz0801...`) is a 106-char Zoho embed key, not a calendar API UID.
   - Admin → Settings → Zoho Calendar → click **Find my calendars**
   - Copy the short `uid` of the public events calendar
   - Netlify dashboard → Site configuration → Environment variables → replace `ZOHO_CALENDAR_PUBLIC_EVENTS_ID`
   - Redeploy → "Sync now" → events populate
3. **Test WorkDrive sync diagnostic**: Admin → Media Library → click **Peek**. Paste the result back to a fresh Claude thread if images still don't land.
4. **Verify Netlify Forms registered**: Netlify dashboard → Forms tab should list `contact`, `inquiry`, `group-inquiry`, `extended-stay-inquiry` after the first deploy. If missing, trigger a fresh deploy with cache cleared.
5. **Test the repair button**: Admin → Settings → "Restore default home content". Fills empty Site Cards + Dark Skies background. Idempotent.

---

## What's stable / considered done

- Visual Builder with drag-reorder, image side-of-text, resize, responsive image position (mobile override), 19 component types, version history, auto-save, publish, SEO panel, global styles, templates, onboarding tour
- All public pages prerendered — sub-100ms TTFB from CDN edge
- Hero images use `<picture>` with webp/mobile-webp/jpg fallback, fetchpriority="high"
- Supabase preconnect hint at build time
- Chunk warning silenced; Monaco/Puck/Tiptap/Supabase split into vendor chunks
- Netlify Forms detection via `public/__forms.html`
- Content publishes trigger Netlify build hook
- Comprehensive error surfacing on Zoho sync endpoints
- RBAC capability matrix (`src/lib/rbac.ts`)
- CSP + security headers in `netlify.toml`
- Row-Level Security enforced via Supabase service-role vs anon key split

---

## Known limitations / deferred items

1. **Scheduled Netlify functions** — `netlify.toml` declares `[functions."zoho-drive-sync"]` etc. but Astro's SSR adapter wraps all API routes in a single function. So the named-function scheduler may not fire. Manual "Sync now" works. Options to fix when time permits:
   - Wrap each scheduled endpoint in a dedicated Netlify Functions file, or
   - Move scheduling to Supabase `pg_cron` (migration 000 already enables the extension)

2. **Free-drag image resize handles** — Puck gives field-based resize (width/height number inputs). True visual drag handles would need custom React widgets layered on top.

3. **Inline click-to-edit on live site** — the current UX is a separate `/admin/builder/...` URL. Wix/Webflow-style live overlay is a bigger lift.

4. **Bundle size warning** — silenced to 3000KB. Admin legitimately ships Monaco (~2MB), Puck (~300KB). Public pages ship ~0 React. Not a practical concern.

5. **Direct in-browser photo upload** — admin points users to drop files in Zoho WorkDrive, sync pulls them in. No Supabase Storage multipart endpoint yet.

---

## Environment variables (Netlify dashboard)

Copy values from your local `.env`.

**Public (exposed to browser bundle):**
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SITE_URL` = `https://www.crookedriverranchrv.com`

**Server-only (secrets):**
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS; only used in SSR/Functions
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`
- `ZOHO_REDIRECT_URI` = `https://www.crookedriverranchrv.com/api/zoho/oauth-callback`
- `ZOHO_ACCOUNT_DOMAIN` = `com` (or your Zoho region)
- `ZOHO_WORKDRIVE_MEDIA_FOLDER_ID` — the resource ID of your WorkDrive `Media` folder
- `ZOHO_CALENDAR_PUBLIC_EVENTS_ID` — **replace with real `uid`, not embed key**
- `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `NETLIFY_BUILD_HOOK`
- `SCHEDULED_FN_SECRET` — shared secret for cron endpoints
- `ADMIN_EMAIL_FROM` = `rvpark@crookedriverranch.com`

See `NETLIFY-DEPLOY.md` for step-by-step.

---

## File map — where things live

```
src/
├── layouts/
│   ├── AdminBase.astro           ← admin shell wrapper (React island)
│   └── Base.astro                ← public site wrapper
├── pages/
│   ├── index.astro               ← home (prerender=true, Puck-rendered)
│   ├── {amenities,…}.astro       ← 11 public pages, all prerendered
│   ├── admin/
│   │   ├── login.astro
│   │   ├── index.astro           ← dashboard
│   │   ├── editor/               ← legacy field editor (demoted)
│   │   ├── builder/[slug].astro  ← ★ Visual Builder (primary edit path)
│   │   └── {media,events,users,settings,versions,audit,runbook,code}.astro
│   └── api/
│       ├── auth/                 ← session/logout
│       ├── pages/, sections/, content/
│       ├── events/, users/, media/
│       ├── publish.ts, publish/  ← publish + webhook + status
│       ├── snapshots/            ← versions + prune
│       ├── builder/              ← draft/save/restore/versions/templates + repair-home
│       ├── zoho/                 ← oauth-callback/status/calendars/calendar-sync/drive-sync/workdrive-peek
│       ├── sync/status.ts        ← dashboard health widget
│       └── runbook/, code/
├── components/
│   ├── HeadMeta.astro, Nav.astro, Footer.astro, ClarityScript.astro, JsonLd.astro
│   ├── PageRenderer.astro        ← dispatcher: builder vs legacy sections
│   ├── sections/                 ← 15 .astro section components + PuckRenderer
│   └── react/
│       ├── AdminShell.tsx        ← sidebar + topbar + palette + help
│       ├── PageBuilder.tsx       ← ★ Puck editor mount
│       ├── PageEditor.tsx        ← legacy field editor
│       ├── PagesAdmin.tsx        ← Pages list with Builder banner
│       ├── MediaAdmin.tsx        ← media library + WorkDrive Peek
│       ├── Settings.tsx          ← integrations + repair-home button
│       ├── Builder{Seo,Style,Templates,Onboarding}.tsx
│       ├── puck-components/      ← 15 section components for Puck
│       │   └── fields/MediaPickerField.tsx
│       ├── editors/              ← EditableText/RichText/Image/Json (legacy path)
│       └── ui/                   ← Icon, Button, Field, Card, Modal, EmptyState
└── lib/
    ├── api.ts                    ← json() / requireAuth() / requireRole() / handleError()
    ├── auth.ts                   ← Supabase SSR session verify
    ├── rbac.ts                   ← capability matrix + can()
    ├── supabase.ts               ← serverClient() / browserClient()
    ├── zoho.ts                   ← OAuth + WorkDrive + Calendar API client
    ├── netlify.ts                ← triggerBuildHook()
    ├── audit.ts                  ← logAudit()
    ├── content.ts                ← captureSnapshot()
    ├── images.ts                 ← sharp variants
    ├── page-content.ts, section-blocks.ts, section-types.ts
    └── puck-config.tsx           ← Puck component registry
public/
├── styles/global.css, admin.css, puck-overrides.css
├── images/                       ← hero.jpg/webp + 50+ synced assets
└── __forms.html                  ← ★ Netlify Forms build-time detection

astro.config.mjs                  ← output:'server' + manualChunks + prerender:true per-page
netlify.toml                      ← CSP + cache headers + scheduled-function stubs
supabase/migrations/              ← SQL migrations (RBAC tables, pg_cron, etc.)
```

---

## How to start a new thread

Paste this entire file + `PROJECT-DETAILS.md` into the context. Mention:

> "V1.0 stable is at `crr-rv-park-platform-V1.0-STABLE-2026-04-16`. I'm working in `crr-rv-park-platform-DEV`. Don't touch stable. Read both handoff docs before proposing changes."

A new thread should be able to:
- Understand the data flow without re-exploring
- Know which env vars matter
- Know what's deferred
- Refer users to the right admin UI
- Avoid regressing the Visual Builder flow

---

## Deploy procedure (as of V1.0)

1. `git add -A && git commit -m "..."` (from DEV folder after testing)
2. `git push` — Netlify auto-builds
3. Wait for build success email / dashboard green
4. Hit the home page. Verify:
   - Hero image loads immediately
   - No console errors
   - `/admin/login` shows the form
5. If anything wrong: Netlify dashboard → Deploys → previous deploy → "Publish deploy" (instant rollback)

---

## When things break

| Symptom | Likely cause | Fix |
|---|---|---|
| `/admin/login` blank | Env vars not set in Netlify | See `NETLIFY-DEPLOY.md` |
| Calendar sync "JSON_PARSE_ERROR" | Wrong calendar UID (embed key) | Use "Find my calendars" button |
| WorkDrive sync runs but 0 images | Folder ID wrong OR scope issue | Use "Peek" button in Media Library |
| Published content not on live site | Build hook didn't fire | Netlify dashboard → trigger deploy manually |
| Builder shows "could not load" | Supabase unreachable | Check `PUBLIC_SUPABASE_URL` env var |
| Forms don't submit | Netlify didn't detect form | Redeploy with cleared cache; check Forms tab |
| Users can't invite | Owner count would drop below 2 | Minimum-2-owners rule in RBAC |

---

Good luck in the next thread. V1.0 is a legit, stable milestone. Protect it.
