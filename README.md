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

**Key principle:** content lives in Supabase; the static site rebuilds on demand via Netlify Deploy API. **No git is in the editing workflow** — this is a deliberate choice to make the system operable by non-technical HOA successors. See [memory/project_governance.md](.) for the rationale.

---

## Phase status

| Phase | Status | Description |
|---|---|---|
| 0 | ✅ Done (scaffolding) / ⏳ Account provisioning still owed | Foundations + accounts |
| 1 | ✅ Code complete / ⏳ Verification owed | Astro migration of 11 HTML pages |
| 2 | 🚧 Scaffolded | Admin UI + auth + Tiptap WYSIWYG |
| 3 | 🚧 Scaffolded | Code editor + publish + audit + snapshots |
| 4 | 🚧 Scaffolded | Zoho Drive media library |
| 5 | 🚧 Scaffolded | Zoho Calendar /events page |
| 6 | ⏳ Pending | Polish, runbook completion, editor handoff |

See [`SPEC-PHASE-1.md`](SPEC-PHASE-1.md) for what verification is still owed on Phase 1.

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your Supabase + Netlify + Zoho credentials

# 3. Run dev server
npm run dev
# Opens at http://localhost:4321

# 4. Build for production
npm run build
# Output goes to ./dist
```

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
