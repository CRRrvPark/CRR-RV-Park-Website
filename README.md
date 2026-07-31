# Crooked River Ranch RV Park — Platform

The website + admin platform for the Crooked River Ranch HOA's RV park in Terrebonne, Oregon.

> **Operating this in production?** Read [`RUNBOOK.md`](RUNBOOK.md) first — it's written for non-technical operators and covers everything from logging in to recovering from outages.

> **Reviewing or extending the code?** Read on.

---

## Architecture in one diagram

```
PUBLIC SITE                        ADMIN                          DATA
─────────────                      ─────                          ────
Astro static pages         ←←←     /admin (React islands)  →→→    Supabase Postgres
+ /events (from DB)                Auth: Supabase Auth             + auth users
                                   WYSIWYG: Tiptap                 + content blocks
↑                                  Code: Monaco (owner only)       + media
│                                  Publish: Netlify Deploy API     + events (synced from Zoho)
│                                                                  + audit_log + snapshots
│                                  ↓
└────  Netlify Functions  ───────────  Zoho API (Drive + Calendar)
       /api/publish, /api/zoho/*,
       /api/users, /api/audit, etc.
```

**Key principle:** content lives in Supabase; code + schema changes ship through Git → Netlify continuous deployment. The admin UI is the only editing surface non-technical operators ever need to touch — no git, no CLI, no config files. Developer changes flow through `git push` to `main` at [github.com/CRRrvPark/CRR-RV-Park-Website](https://github.com/CRRrvPark/CRR-RV-Park-Website) which Netlify auto-deploys.

---

## Phase status

| Phase | Status | Description |
|---|---|---|
| 0–5 | ✅ Shipped | Foundations, Astro migration, admin UI, auth, Tiptap, code editor, publish, audit, snapshots, Zoho Drive + Calendar |
| V2 | ✅ Shipped | Area-guide (trails, things-to-do, local places, park sites) |
| V3 | ✅ Shipped | WYSIWYG Path A — Puck-based Visual Editor with live preview, section library, global styles, versions, templates |
| V3.1 | ✅ Shipped | Manual photo upload (Supabase Storage), canvas-as-live-preview, link picker, card array-field editors, Zoho sync resilience, section-ID + per-block style panels, legacy page migration (7 static `.astro` → `page_builder_data`), dashboard analytics + conversion tracking |
| V4 | 🚧 Next | Block-level editor rebuild — every headline, paragraph, image, button, spacer is its own clickable Puck atom. See [`HANDOFF-V4-EDITOR-REBUILD.md`](HANDOFF-V4-EDITOR-REBUILD.md). |

**Current home page note:** the home (`index`) still uses the legacy `sections` + `content_blocks` schema. All other nav-linked pages are on `page_builder_data`. Home migration is folded into V4 session 1.

See [`SPEC-PHASE-1.md`](SPEC-PHASE-1.md) for the original Phase 1 spec. Current authoritative handoff is [`HANDOFF-V4-EDITOR-REBUILD.md`](HANDOFF-V4-EDITOR-REBUILD.md).

---

## Local development

```bash
# 1. Clone the repo (once)
git clone https://github.com/CRRrvPark/CRR-RV-Park-Website.git
cd CRR-RV-Park-Website

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your Supabase + Netlify + Zoho credentials

# 4. Run dev server
npm run dev
# Opens at http://localhost:4321

# 5. Build for production (Netlify does this automatically on push)
npm run build
# Output goes to ./dist
```

## Deployment

Every push to `main` on GitHub auto-deploys to Netlify (see [`NETLIFY-DEPLOY.md`](NETLIFY-DEPLOY.md)). No manual drag-drop, no CLI invocation needed. The canonical repo folder on the primary dev machine is `C:\dev\CRR-RV-Park-Website\`.

### Without Supabase configured

The site builds and runs even without Supabase env vars set. Pages render their hardcoded fallback content; the admin shows placeholder data; the `/events` page shows a friendly "no events yet" message.

This is intentional — the public site cannot break just because the database is unreachable.

---

## Project layout

```
crr-rv-park-platform/
├── README.md                    ← you are here
├── RUNBOOK.md                   ← operator's manual (HOA-friendly)
├── SPEC-PHASE-1.md              ← detailed spec for the Astro migration
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── netlify.toml
├── .env.example
│
├── public/                      ← static assets (served as-is by Netlify)
│   ├── images/                  ← all site imagery
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── BingSiteAuth.xml
│   └── rv_park_rules.pdf
│
├── src/
│   ├── layouts/
│   │   ├── Base.astro           ← public page layout
│   │   └── AdminBase.astro      ← admin page layout
│   │
│   ├── components/
│   │   ├── HeadMeta.astro       ← <head> meta tags + fonts + Clarity preload
│   │   ├── Nav.astro            ← global navigation
│   │   ├── Footer.astro         ← global footer
│   │   ├── JsonLd.astro         ← JSON-LD schema renderer
│   │   ├── Breadcrumbs.astro    ← inner-page breadcrumbs
│   │   └── ClarityScript.astro  ← Microsoft Clarity (deferred)
│   │
│   ├── pages/                   ← Astro pages (one per route)
│   │   ├── index.astro          ← home (converted from index.html)
│   │   ├── book-now.astro
│   │   ├── ... (9 more public pages)
│   │   ├── events.astro         ← NEW: pulls from Zoho Calendar
│   │   ├── admin/
│   │   │   ├── index.astro      ← dashboard
│   │   │   ├── login.astro
│   │   │   ├── editor/[slug].astro
│   │   │   ├── code.astro
│   │   │   ├── media.astro
│   │   │   ├── events.astro
│   │   │   ├── users.astro
│   │   │   ├── audit.astro
│   │   │   ├── versions.astro
│   │   │   ├── settings.astro
│   │   │   └── runbook.astro
│   │   └── api/                 ← Netlify Functions (server-side)
│   │       ├── publish.ts
│   │       ├── audit/log.ts
│   │       ├── content/blocks.ts
│   │       ├── snapshots/restore.ts
│   │       ├── users/index.ts
│   │       └── zoho/
│   │           ├── oauth-callback.ts
│   │           ├── drive-sync.ts        (scheduled, every 15 min)
│   │           └── calendar-sync.ts     (scheduled, hourly)
│   │
│   ├── lib/
│   │   ├── supabase.ts          ← browser + server Supabase clients
│   │   ├── auth.ts              ← sign-in, session checks
│   │   ├── rbac.ts              ← role-based capability matrix
│   │   ├── content.ts           ← banned words, snapshot/restore
│   │   ├── audit.ts             ← audit log writer
│   │   ├── netlify.ts           ← Netlify Deploy API client
│   │   └── zoho.ts              ← Zoho OAuth + WorkDrive + Calendar
│   │
│   ├── styles/
│   │   └── global.css           ← unchanged from original site
│   │
│   └── scripts/
│       └── site.js              ← unchanged from original site
│
├── supabase/
│   └── migrations/
│       ├── 001_init.sql         ← tables + enums + triggers
│       ├── 002_rls_policies.sql ← row-level security
│       └── 003_seed_pages.sql   ← page + section seed
│
└── scripts/
    └── convert-html-to-astro.mjs ← one-shot HTML→Astro converter (already run)
```

---

## Dependencies + why each one

| Package | Purpose |
|---|---|
| `astro` | Static site generator (the framework) |
| `@astrojs/netlify` | Netlify adapter for Astro Functions |
| `@astrojs/react` | React integration (for admin UI islands) |
| `@supabase/supabase-js` | Database + auth client |
| `@supabase/ssr` | SSR-friendly Supabase client |
| `@tiptap/*` | WYSIWYG editor for content (admin) |
| `monaco-editor` | Code editor for Owner-only `/admin/code` route |
| `sharp` | Image processing (WebP variants for Zoho-synced media) |
| `zod` | Runtime schema validation for API inputs |
| `cheerio` (dev) | HTML parsing if conversion script ever needs to be re-run |

---

## Code conventions

- **Components** are PascalCase `.astro` files in `src/components/`
- **Layouts** are PascalCase `.astro` files in `src/layouts/`
- **Lib helpers** are camelCase `.ts` files in `src/lib/`
- **API routes** (Netlify Functions) live under `src/pages/api/` per Astro convention
- **TypeScript strict mode** — see `tsconfig.json`
- **No banned words** in user-facing content (enforced server-side in `lib/content.ts` against the list from the original site's HANDOFF.md)

---

## Where to start reading the code

1. `src/layouts/Base.astro` — see how a public page is structured
2. `src/pages/index.astro` — see how a page uses the layout
3. `src/lib/rbac.ts` — see the role/capability model
4. `supabase/migrations/001_init.sql` — see the data model
5. `RUNBOOK.md` — see how operators interact with the system

---

## Where to look when something's wrong

- **Build fails?** Check Netlify deploy logs
- **Page renders wrong?** Run `npm run build` locally and inspect `dist/`
- **API endpoint returns 500?** Check Netlify Function logs in Netlify dashboard
- **Auth not working?** Check Supabase Auth logs
- **Zoho sync silent?** Check `sync_runs` table in Supabase + admin → Settings page

---

## License + ownership

This software is the property of the Crooked River Ranch HOA. Operated by the HOA's designated developer (currently Matt). All accounts and credentials are HOA-owned and survive any change in developer.
