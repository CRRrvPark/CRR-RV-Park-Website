# Status check-in — Path B + Page CRUD + Security audit shipped

> **Matt — good morning.** Path B (Section Library), page CRUD, and a security audit all shipped overnight. Plus the staff login link you asked for.

---

## 🚨 First thing when you wake up: apply 3 new migrations

```bash
cd "C:/Users/mathe/Documents/RV Park/crr-rv-park-platform"
npm run db:migrate
```

Picks up:
- `007_section_types.sql` — section library infrastructure
- `008_seed_explore_section.sql` — fills the previously-empty explore section
- `009_page_crud.sql` — page CRUD columns + slug validation + draft/protect triggers

Then **restart the dev server** (`Ctrl+C` + `npm run dev`) — Path B and page CRUD add new code that Vite only picks up on fresh start.

Also add this new env var to `.env` (any random 32+ char string):
```
SCHEDULED_FN_SECRET=some-long-random-secret-that-only-you-and-netlify-know
```
This gates the webhook + scheduled sync endpoints so they can't be triggered by random internet traffic. Details in the security section below.

---

## PART 1 — Path B: Section Library

15 pre-styled, brand-conformant section templates editors can add/reorder/delete from any page.

**Catalog:** Hero, Trust Bar, Two-Column, Interlude (full-bleed media), Card Grid, Amenity Grid, Explore Grid, Site Type Cards, Customer Reviews, CTA Banner, Text Block, Upcoming Events Widget, Reserve Form, Rates Table, Numbered Feature List.

**Admin UX:** "+ Add section at top" / "+ Add section below" buttons between every section. Per-section toolbar with ↑↓ move, 👁/⊘ visibility, × delete.

**Architecture:** One Astro component per section type, a `PageRenderer.astro` that dispatches by type. Adding a new template later = 3 small files.

---

## PART 2 — Page CRUD

Admin can now add, edit settings on, draft/publish, and delete pages.

**Admin UX:** "Edit Pages" screen replaced with a live list:
- Drafts section (if any) at top
- Published pages below
- Per-page: ⚙ settings, ✓ Publish / ⇣ Draft toggle, × delete (owner only, non-protected only)
- "+ New Page" button opens a modal: title, slug (auto-generated from title, editable), meta description, OG image, hero preload, "Show in main nav" toggle, nav order

**What "protected" means:** The home page, book-now, privacy, terms, and park-policies are flagged `is_protected=true` in the DB. Delete is blocked for these at both the UI and DB level (trigger). You can unprotect one via SQL if you really need to, but the default prevents accidents.

**Drafts:** New pages start as drafts. Drafts render with reduced opacity in the admin list. The public `[slug].astro` route returns 404 for drafts, so visitors can't see them. Unpublishing the home page is blocked by a DB trigger — the site always has a home.

**Dynamic public route:** New file `src/pages/[slug].astro`. When someone visits `/my-new-page`, Astro resolves it to the new dynamic route, which looks up the page in Supabase and renders it via PageRenderer. **Existing hand-coded pages (`index.astro`, `book-now.astro`, etc.) still win** because Astro prioritizes static routes over dynamic ones — so nothing breaks.

**Dynamic navigation:** The public Nav component now also fetches pages with `show_in_main_nav=true` + `is_draft=false` and inserts them into the nav between the static links and the Reservations CTA. If an editor creates "Seasonal Specials" and toggles "Show in main nav", it appears automatically.

**Editor route:** `/admin/editor/[slug]` is now SSR (prerender=false), so it accepts any slug including newly-created pages. No more hardcoded slug list.

---

## PART 3 — Security Audit + Patches

I did a thorough sweep of every file in `src/lib/`, `src/pages/api/`, and the React admin components, looking for the OWASP top-10 classics. Findings + patches:

### 🔴 Fixed: Open redirect in `/admin/login?next=`
**Severity:** High. Before the fix, an attacker could send a victim `/admin/login?next=https://evil.com`. After successful sign-in, the app would redirect them off-site — a phishing primitive.
**Patch:** `LoginForm.tsx` now validates that `next` starts with `/` and not `//` (which would be a protocol-relative URL). Anything else falls back to `/admin`.

### 🔴 Fixed: `javascript:` / `data:` URL injection in content blocks
**Severity:** High. Before the fix, an editor (or an account with a compromised password) could PATCH a content block with `value_image_url: "javascript:alert(1)"` or similar. When rendered as `<img src="...">`, this executes JavaScript.
**Patch:** `/api/content/blocks` PATCH now:
- Validates `value_image_url` against an allow-list (relative paths, https, mailto, tel)
- Rejects URL-like text fields starting with dangerous schemes
- Client-side guard in `EditableImage.tsx` as defense in depth

### 🔴 Fixed: HTML sanitization on rich-text content
**Severity:** Medium-high. Tiptap's StarterKit emits a safe subset of HTML, but nothing stops an attacker from posting a crafted `value_html` directly to the API (bypassing the editor). They could inject `<script>`, `<iframe>`, `onclick` attributes, etc.
**Patch:** Server-side sanitizer in `/api/content/blocks` strips:
- Dangerous tags: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<svg>`, `<math>`, `<link>`, `<meta>`, `<base>`
- All `on*` event handler attributes (`onclick`, `onerror`, etc.)
- `javascript:` / `data:` / `vbscript:` schemes in `href` / `src` / `xlink:href`

Defense in depth — Tiptap already doesn't emit these, but if a future extension or extension-compromise allowed them, the server stops them.

### 🟠 Fixed: Unauthenticated scheduled / webhook endpoints
**Severity:** Medium-high. Four endpoints had NO auth check because they're meant to be called by Netlify (webhooks + cron):
- `/api/publish/webhook` (Netlify deploy result callback)
- `/api/snapshots/prune` (daily cleanup)
- `/api/zoho/drive-sync` (every 15 min)
- `/api/zoho/calendar-sync` (hourly)

**The real risk:** publish/webhook specifically. An attacker posting a fake "deploy failed" payload could trigger the auto-rollback code path, forcing the site back to an older version. The sync endpoints are lower-impact (DOS risk).

**Patch:** New `requireScheduledOrAuth()` helper in `lib/api.ts`. Endpoint is reachable if EITHER:
- A valid signed-in user calls it (admin "Sync now" buttons still work)
- The request includes `?secret=...` or `X-Cron-Secret: ...` matching `SCHEDULED_FN_SECRET` env var

**You must set `SCHEDULED_FN_SECRET`** in both `.env` (local) and Netlify env vars (production), then configure Netlify's webhook URL and scheduled functions to include the secret:
- Netlify webhook URL: `https://.../api/publish/webhook?secret=THE_SECRET`
- Scheduled functions: either rebuild them to include the secret in the URL, or set the header (Netlify scheduled functions can set custom headers in `netlify.toml`)

### 🟠 Fixed: Error message disclosure
**Severity:** Low-medium. `handleError()` was returning raw `err.message` to the client on 500 errors. That can leak DB column names, constraint names, Supabase internals, file paths, etc. — useful to an attacker for reconnaissance.
**Patch:** In production (when `import.meta.env.DEV` is false), `handleError` returns a generic "Internal server error" message. Full error still logged server-side. In dev mode, the real message is surfaced for debugging.

### 🟢 Already good: Authentication & authorization
All write-path endpoints check `requireAuth()` or `requireRole()`. The service-role Supabase key is only used in Netlify Functions (server-side), never shipped to the browser. JWT verification goes through Supabase's `auth.getUser()` which validates the token against the auth server. Audit log `actor_id` is always pulled from the server-verified JWT, never from the client body — can't be spoofed.

### 🟢 Already good: SQL injection
All DB interactions use Supabase's parameterized query builder. No raw SQL string concatenation anywhere. The one SQL execution RPC (`exec_sql`) used by the migration runner is `security definer` AND restricted to the `service_role` via explicit `GRANT/REVOKE`.

### 🟢 Already good: RLS policies
Row-Level Security is enabled on every table. Public reads limited to published/visible content. Writes require role at least 'editor'. Code editor + user management + Zoho tokens are owner-only via policy.

### 🟢 Already good: CSRF
We use Bearer tokens, not cookies, for auth. No CSRF exposure.

### 🟢 Already good: Secret management
`SUPABASE_SERVICE_ROLE_KEY` only ever read in server code (`serverClient()` throws if called from browser). `.env` gitignored. Env vars in Netlify are encrypted at rest. Zoho tokens stored in a DB table restricted by RLS to owners.

### 🟡 Noted but not patched: Rate limiting
We don't rate-limit any endpoint. An attacker with a valid editor/owner login could hammer `/api/content/blocks` or `/api/sections` to DOS the DB. Given the tiny user base (a few HOA staff), this is unlikely. Netlify applies platform-level rate limits that catch the worst cases. If this ever needs hardening, use Netlify Edge Functions or Supabase rate-limiting extension.

### 🟡 Noted but not patched: No CSP strict mode
Current `Content-Security-Policy` in `netlify.toml` allows `'unsafe-inline'` for scripts and styles (required by Astro's HMR in dev and some inline styles in pages). Tightening would require refactoring all inline styles to classes. Nice-to-have for later.

### 🟡 Noted but not patched: Banned-word check is bypassable
Client can skip the banned-word check by sending the PATCH directly. The server ALSO checks, so it's not bypassable in practice — but worth knowing: the server-side enforcement is the one that matters.

---

## What you do in the morning

### Order of operations
1. `npm run db:migrate` (applies 007, 008, 009)
2. Add `SCHEDULED_FN_SECRET=...` to `.env`
3. `npm run dev` (fresh start)
4. Hard refresh browser on `localhost:4321/admin`

### Test scenarios

#### Path B — Section Library
- Edit Pages → Home → click "+ Add section below" between two existing sections → picker modal opens
- Pick **CTA Banner** → new section appears at that position with placeholder content
- Edit its headline/body/button → blur to save → reload `/` → see it live
- Use ↑↓ to move it, 👁/⊘ to hide/show, × to delete

#### Page CRUD
- Edit Pages → **"+ New Page"** → fill in title ("Seasonal Specials"), slug auto-fills, toggle "Show in main nav" → Create
- New page appears in Drafts list
- Click "Edit content →" on it → add some sections
- Return to page list → click ✓ Publish
- Public nav should show "Seasonal Specials" between "Area Guide" and "Reservations"
- Visit `localhost:4321/seasonal-specials` → see your sections
- Try to delete the home page from the UI → should be blocked (🔒 protected)
- Try to delete the Seasonal Specials page → confirmation modal → delete → 404 on `/seasonal-specials`

#### Security patches
- Try visiting `/admin/login?next=https://evil.com` and signing in → should redirect to `/admin` (not evil.com) after success
- Try to PATCH `/api/content/blocks` with `value_image_url: "javascript:alert(1)"` via browser devtools or curl → should 422
- Try to POST `/api/zoho/drive-sync` WITHOUT auth and WITHOUT the secret → should 401
- Try WITH `?secret=THE_SECRET` → should work

---

## Files added/modified this session

**NEW:**
```
Migrations:
  supabase/migrations/009_page_crud.sql

API:
  src/pages/api/pages/index.ts        (POST create, GET list)
  src/pages/api/pages/[id].ts         (GET, PATCH, DELETE)

React admin:
  src/components/react/PagesAdmin.tsx (list + create + settings dialog)

Public route:
  src/pages/[slug].astro              (dynamic renderer for user-created pages)
```

**MODIFIED (for page CRUD + security):**
```
src/lib/api.ts                        + requireScheduledOrAuth(), safer handleError()
src/components/react/LoginForm.tsx    + open-redirect fix
src/components/react/EditableImage.tsx + client URL guard
src/components/Nav.astro              + dynamic nav pages
src/pages/admin/editor/index.astro    → uses PagesAdmin
src/pages/admin/editor/[slug].astro   → SSR so new slugs work
src/pages/api/content/blocks.ts       + URL validation, HTML sanitization
src/pages/api/publish/webhook.ts      + requireScheduledOrAuth
src/pages/api/snapshots/prune.ts      + requireScheduledOrAuth
src/pages/api/zoho/drive-sync.ts      + requireScheduledOrAuth
src/pages/api/zoho/calendar-sync.ts   + requireScheduledOrAuth
```

---

## Remaining work to fully ship product

| Task | Effort |
|---|---|
| Refactor remaining 10 pages to use PageRenderer + seed content | 3–4 days |
| Wire + test Zoho integration end-to-end | 0.5 day |
| Cut Netlify over to platform code + configure env vars (including SCHEDULED_FN_SECRET) | 0.5 day |
| Editor onboarding tour + tooltips | 1 day |
| Polish + bug-fix pass | 1–2 days |
| **Total to v1 complete** | **6–8 days** |

---

## Heads-up on potential issues

1. **`image_caption` row in migration 004** — fixed during earlier session, still valid after 007/008/009
2. **`/[slug].astro` routing** — Astro's static routes (`index.astro`, `book-now.astro`) take precedence, so existing pages are unchanged. New slugs you create route through the dynamic file. If you see a 404 on a newly-created page, hard-refresh once (SSR caching).
3. **Nav dynamic pages require `show_in_main_nav=true` AND `is_draft=false`** — setting either wrong = doesn't appear in nav.
4. **If you see `SCHEDULED_FN_SECRET not set` warnings in the dev server output**, that's the security-audit gate falling open for local dev. Set the env var to silence.
5. **The setting dialog doesn't let you change a slug after creation** — intentional. Slug changes break links + SEO. If you really need to change one: delete + recreate.

---

## When you're back, tell me

- Did migrations apply cleanly?
- Path B: can you add/delete/reorder sections?
- Page CRUD: can you create a draft page, add sections, publish it?
- Do you see your dynamic page in the nav?
- Does anything look broken?

If everything works, next mechanical task is refactoring the other 10 pages to use PageRenderer. After that + Netlify wiring + Zoho wiring, you have a full v1.
