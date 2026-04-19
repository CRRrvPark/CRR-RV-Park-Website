# Phase 1 Spec — Astro Migration

> **Status:** Draft (April 2026). Awaiting Matt's review before production cutover.
>
> **Audience:** developer (current or future) who needs to verify, finish, or maintain the Phase 1 work.

---

## Goal

Convert the existing 11 hand-written HTML pages into Astro components, producing **byte-identical static HTML output**, with shared elements (nav, footer, head meta, JSON-LD) extracted into reusable components.

This is the foundation for Phase 2+. By itself, Phase 1 changes nothing user-visible — same site, same look, same speed.

---

## What's been done

### ✅ Project scaffolding
- `package.json` with Astro 5, React, Supabase, Tiptap, Monaco, Sharp, TypeScript
- `astro.config.mjs` configured for static output + Netlify adapter
- `tsconfig.json` with path aliases (`@components`, `@layouts`, `@lib`)
- `netlify.toml` with security headers, scheduled functions, redirects (mirrors current site)
- `.env.example` documenting every needed environment variable
- `.gitignore` (defensive — git is not in the workflow)

### ✅ Asset migration
- `css/global.css` → `src/styles/global.css` (unchanged)
- `js/site.js` → `src/scripts/site.js` (unchanged)
- All `images/` → `public/images/` (unchanged)
- `robots.txt`, `sitemap.xml`, `BingSiteAuth.xml`, `rv_park_rules.pdf` → `public/`

### ✅ Shared components
- `src/components/HeadMeta.astro` — all `<head>` meta tags + font preload
- `src/components/Nav.astro` — global navigation
- `src/components/Footer.astro` — global footer
- `src/components/JsonLd.astro` — JSON-LD schema renderer
- `src/components/Breadcrumbs.astro` — inner-page breadcrumbs
- `src/components/ClarityScript.astro` — Microsoft Clarity (deferred)
- `src/layouts/Base.astro` — composes the above into the standard page wrapper

### ✅ Page conversion (automated)
All 11 pages converted via `scripts/convert-html-to-astro.mjs`:
- `src/pages/index.astro`
- `src/pages/book-now.astro`
- `src/pages/amenities.astro`
- `src/pages/area-guide.astro`
- `src/pages/extended-stays.astro`
- `src/pages/golf-course.astro`
- `src/pages/golf-stays.astro`
- `src/pages/group-sites.astro`
- `src/pages/park-policies.astro`
- `src/pages/privacy.astro`
- `src/pages/terms.astro`

Plus the new public page:
- `src/pages/events.astro` — pulls from Supabase `events` table

### ✅ Conversion script
- `scripts/convert-html-to-astro.mjs` — extracts head meta, body content, JSON-LD; rewrites asset paths; wraps in Base layout. Re-runnable; idempotent.

---

## What still needs verification

These are the items Matt or the next developer must check before declaring Phase 1 done:

### 1. Visual diff: built output vs. current production
**How:**
1. `npm install && npm run build`
2. Open `dist/index.html` in a browser, compare against current production https://www.crookedriverranchrv.com
3. Repeat for each of the 11 pages

**Expected:** pixel-identical rendering. Any difference is a Phase 1 bug.

**Common diff sources to ignore:**
- Whitespace differences in HTML source (browsers normalize)
- Comment removal by Astro

**Diffs that ARE bugs:**
- Missing meta tags
- Image paths broken
- JSON-LD changed
- Any visible text/layout change

### 2. Hero image preload
The original site uses `<link rel="preload" as="image" href="images/hero.webp" type="image/webp">` for the home hero. Verify this still appears in `dist/index.html` and points to `/images/hero.webp` (with leading slash now).

### 3. Microsoft Clarity loads on every page
Check the bottom of each page's `<head>` in dist output — `ClarityScript.astro` should have rendered the deferred-load IIFE.

### 4. Netlify Forms still work
The 3 forms (`contact` on home, `inquiry` on book-now, `monthly-application` on extended-stays) need to be detected by Netlify on first deploy. Verify in Netlify dashboard → Forms after first build.

The `data-netlify="true"` attribute is preserved by the conversion script, but Netlify needs the form HTML to be present at build time (which it is, since Astro pre-renders).

### 5. Clean URLs
Visiting `/book-now` (no .html) should serve `/book-now.html`. The `netlify.toml` redirects handle this. Verify after deploy.

### 6. JSON-LD schema integrity
Spot-check 2–3 pages in a JSON-LD validator (e.g., https://search.google.com/test/rich-results) — should still pass.

---

## What's NOT in Phase 1 scope

These are intentionally deferred to later phases:

- **Pulling content from Supabase** — Phase 1 leaves content hardcoded in the .astro files. Phase 2 wires up the DB.
- **The admin UI** — scaffolded but not functional yet (Phase 2/3).
- **Auth + roles** — scaffolded but not wired to login flow yet (Phase 2).
- **Actual Zoho sync** — endpoints exist but env vars not set (Phase 4/5).
- **Tiptap editor** — installed but not mounted yet (Phase 2).
- **Monaco code editor** — installed but not mounted yet (Phase 3).
- **Snapshot/restore UI** — endpoints exist, UI is placeholder (Phase 3).

---

## Files Matt or developer may want to hand-tweak

The conversion script does its best, but a few page-specific things may need polish:

- **`src/pages/index.astro`** — the home hero has `class="page-hero full"` (full-height). Verify this still applies.
- **`src/pages/extended-stays.astro`** — long form with many fields. Verify all `for`/`id` pairs preserved (WCAG accessibility).
- **Any page with inline `<style>` blocks** — these were preserved verbatim, but consider extracting to global.css if there are duplicates.

---

## Next steps after Phase 1 sign-off

1. Deploy the Astro build to a Netlify deploy preview (NOT production yet)
2. Compare deploy preview against production side-by-side
3. If clean, repoint production at the new build
4. Begin Phase 2 (admin UI + Tiptap + content from Supabase)

See [README.md](README.md) for the full phase plan.
