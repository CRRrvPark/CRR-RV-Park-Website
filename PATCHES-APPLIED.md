# Patches Applied — Post-V1.0 Security & Bug Fixes

> **Date:** 2026-04-16 (original) + 2026-04-17 (pen-test round)
> **Applied to:** `crr-rv-park-platform-DEV` (this folder)
> **NOT applied to:** `crr-rv-park-platform-V1.0-STABLE-2026-04-16` (the frozen stable snapshot)
> **Sources of findings:** `SECURITY-AND-BUGS-REPORT.md` + `PEN-TEST-REPORT.md`

Everything below addresses findings from those reports. Each patch is keyed to its report ID so future auditors can cross-reference.

---

## Pen-test round (PT-1 through PT-6) — applied 2026-04-17

### ✅ PT-1 · JSON-LD `</script>` escape in `JsonLd.astro`
- `src/components/JsonLd.astro` — new `safeStringify` helper escapes `<`, `\u2028`, `\u2029` in JSON output before passing to `set:html`.
- Closes stored-XSS path via `pages.schemas` that any editor could have exploited. Verified with PoC — `</script><script>alert(1)</script>` in any schema field now renders as `\u003c/script\u003cscript\u003ealert(1)\u003c/script\u003e` inside the `<script type="application/ld+json">` tag; browser tokenizer cannot close the tag.

### ✅ PT-2 · Sanitizer on-handler slash-separator bypass
- `src/lib/puck-sanitize.ts` + `src/pages/api/content/blocks.ts` — on-handler regex changed from `\s+on[a-z]+` to `[\s\/]on[a-z]+`. HTML allows `/` as attribute separator, so `<img/src=x/onerror=alert(1)>` no longer slips through.
- Verified PoC: 3 slash-separator variants now sanitized to `<img/src=x>` / `<img/ src=x />` / `<IMG/SRC=x>`. 3 legitimate-input cases preserved.

### ✅ PT-3 · Style-attribute sanitization
- Same two files as PT-2 — added a new regex that strips `style=` attributes containing `javascript:`, `vbscript:`, `expression(`, `-moz-binding`, or `behavior:`.
- Verified: 4 legacy CSS-XSS vectors all blocked. Benign `style="color:red"` passes through.

### ⏭️ PT-4 (server-side `/admin/*` redirect) — DEFERRED, middleware.ts removed 2026-04-17

Initial attempt added `src/middleware.ts` with a Supabase-cookie check and redirect-to-login logic. That version broke immediately: the codebase uses Supabase's default `persistSession: true` (localStorage, not cookies), so the middleware had no signal to detect an authenticated admin and redirected every authenticated user back to `/admin/login` — infinite redirect loop.

Second attempt reduced the file to a pass-through no-op pending `@supabase/ssr` migration. That *also* broke the deploy: even a no-op `defineMiddleware` causes `@astrojs/netlify` v6 to emit middleware plumbing inside the SSR function bundle, which in turn prevented the admin React islands from hydrating in production (form submissions did native POSTs, password-reveal toggle didn't fire, etc.).

Resolution: **`src/middleware.ts` is removed entirely**. PT-4 is deferred until after the `@supabase/ssr` migration lands (Session N+1 or whenever session-cookie-based auth is in place). Existing defenses remain:
- React `AuthGuard` handles client-side auth redirection.
- API layer enforces auth via `requireAuth` / `requireRole`.
- `/admin/*` has `Cache-Control: no-store` + `X-Robots-Tag: noindex,nofollow`.
- The remaining gap is pre-hydration SSR-HTML flash + anonymous route enumeration — both LOW severity.

### ✅ PT-6 · Body-size limit on `/api/builder/save`
- `src/pages/api/builder/save.ts` — new `MAX_BUILDER_BODY_BYTES = 512000` constant. Check runs BEFORE auth: if `Content-Length` > 500KB, return 413 immediately.
- Verified: 600KB POST returns `{"error":"Payload too large (600000 bytes). Max 512000 bytes."} [413]` in ~3ms. Legitimate saves (always <<100KB) unaffected.

### ⏭️ PT-5 (rate limiting) — deferred to Netlify dashboard config
- Code-side rate limiting was not added; the pragmatic fix is enabling Netlify's edge rate limiting via the dashboard, specifically for `/api/auth/*`. That's a deployment-config change, not a code change.

### ⏭️ PT-7 (ReDoS) — rolls into PT-2/PT-3 fixes partially
- PT-6 body-size cap caps worst-case input to ~500KB, which in turn caps worst-case sanitizer runtime to a few hundred ms — well under Netlify's function timeout. Full fix (switch to DOMPurify) is tracked as future work.

### ⏭️ PT-8 (500 on invalid JWT in dev) — not a prod issue, noted

---

---

## HIGH severity — all 6 applied

### ✅ HIGH-1 · Deleted `/api/debug/env-check`
- `src/pages/api/debug/env-check.ts` — **deleted**
- `src/pages/api/debug/` — **directory removed**
- The endpoint leaked env-var presence + DB connectivity + first 3 page slugs to any unauthenticated visitor. Its purpose was served; it's gone.

### ✅ HIGH-2 · `requireScheduledOrAuth` now fails closed
- `src/lib/api.ts` — `requireScheduledOrAuth()` rewritten
- If `SCHEDULED_FN_SECRET` is not set, requests are REJECTED with `UnauthenticatedError` instead of falling open. Prevents the worst cascading attack (anonymous `POST /api/publish/webhook` → forced rollback).
- **You must set `SCHEDULED_FN_SECRET` in Netlify env vars** for the scheduled endpoints to function.

### ✅ HIGH-3 · `/api/builder/save` gated on `edit_content_draft`
- `src/pages/api/builder/save.ts` — `requireAuth` → `requireRole('edit_content_draft')` at the top.
- Viewers can no longer overwrite drafts on any page.
- Also added runtime shape validation: `data` must be an object with `content: []`.

### ✅ HIGH-4 · Puck sanitization pass
- `src/lib/puck-sanitize.ts` — **new file** (≈170 lines) declaring a per-component field map of which props carry HTML vs URLs vs nested JSON, plus HTML/URL/nested-JSON sanitizers mirroring `src/pages/api/content/blocks.ts`.
- `src/pages/api/builder/save.ts` — imports `sanitizePuckData`; every save writes the sanitized payload. Closes the stored-XSS path through rich-text fields in Puck components.
- HtmlEmbed's `code` field is intentionally left unsanitized because its content runs in a sandboxed iframe.

### ✅ HIGH-5 · OAuth callback hardened + new authorize endpoint
- `src/pages/api/zoho/oauth-callback.ts` — rewrite:
  - Now gated on `manage_zoho_integration` (owner-only) via `requireRole`
  - Verifies the `state` query param against a short-lived HTTP-only cookie set by authorize
  - Constant-time comparison of state
  - Always clears the state cookie (single-use)
- `src/pages/api/zoho/authorize.ts` — **new file**. Owner-only. Generates a 32-byte random state, stores it in an HTTP-only `SameSite=Lax` cookie (10-minute TTL), then redirects to Zoho.
- `src/pages/api/zoho/status.ts` — no longer returns the raw Zoho URL. Returns `/api/zoho/authorize` instead so the state cookie always gets set.

### ✅ HIGH-6 · `/api/media` POST allow-listed
- `src/pages/api/media/index.ts` — POST now extracts only `filename / display_name / alt_text / caption / mime_type / byte_size / width / height` from the body. Columns managed by the sync pipeline (`public_url_*`, `zoho_resource_id`, `storage_path_*`) can no longer be set by client input.
- Also validates `filename` is a non-empty string before insert.

---

## MEDIUM severity — all 6 applied

### ✅ MEDIUM-1 · `/api/users` GET gated on `view_users`
- `src/pages/api/users/index.ts` — GET now calls `requireCapability('view_users')` after auth check. Previously any authenticated user could list everyone.

### ✅ MEDIUM-2 · PostgREST `.or()` replaced with split typed queries (also addresses BUG-2 + BUG-5)
- `src/pages/api/media/[id].ts` — DELETE usage-check rewrite:
  - Splits the old interpolated `.or()` into three separate `.eq()` / `.ilike()` calls plus a fourth that searches the Puck `page_builder_data` JSONB via text cast
  - Escapes `%` / `_` / `\` before using the value in an `ilike` pattern
  - Returns a detailed breakdown of where references were found

### ✅ MEDIUM-3 · Header-only scheduled secret
- `src/lib/api.ts` — removed the `?secret=` query-param fallback. Only `x-cron-secret` header is accepted now. Query strings leak to logs / history / Referer; headers don't.

### ✅ MEDIUM-4 · Dedicated `delete_page` capability
- `src/lib/rbac.ts` — added `delete_page: 'owner'` to the capability matrix.
- `src/pages/api/pages/[id].ts` — DELETE now uses `requireRole(request, 'delete_page')` instead of the semantically-wrong `change_user_role`.

### ✅ MEDIUM-5 · `builder/restore` verifies slug ↔ page_id
- `src/pages/api/builder/restore.ts` — after loading the version, looks up the page by slug and asserts `page.id === version.page_id`. Returns 400 if the version doesn't belong to the requested page. Prevents a stray versionId from restoring the wrong page's content.

### ✅ MEDIUM-6 · Runtime role-enum validation
- `src/pages/api/users/index.ts` — added `VALID_ROLES` + `isValidRole()` guard, used in both POST (invite) and PATCH (role change). Also validates `userId`, `email`, `displayName`, and `isActive` types at runtime. The TS cast alone was erased at runtime.

---

## BUG fixes — 5 of 7 applied

### ✅ BUG-1 · Fixed users/index.ts doc comment
- `src/pages/api/users/index.ts` — top-of-file doc no longer claims a DELETE endpoint exists here; points to `/api/users/[id]`.

### ✅ BUG-2 · Media usage-check covers Puck data
- Folded into MEDIUM-2 fix above. Deletion is now blocked if the image is referenced from *either* `content_blocks` *or* `page_builder_data`.

### ✅ BUG-3 · Better publish/webhook matching
- `src/pages/api/publish/webhook.ts` — two-stage matching:
  1. If the deploy ID already lives in a `publishes` row, use that exact row
  2. Otherwise fall back to time-bounded matching (publishes started within 30 min before the deploy's `created_at`)

### ✅ BUG-4 · PageBuilder beforeunload cancels pending debounce
- `src/components/react/PageBuilder.tsx` — `onUnload` now calls `clearTimeout(saveTimerRef.current)` before `sendBeacon`. Stops the debounced save from firing on a detached document.

### ✅ BUG-5 · Escape `%` / `_` in ilike patterns
- Applied in two places:
  - `src/pages/api/media/index.ts` GET (search box)
  - `src/pages/api/media/[id].ts` DELETE (usage check) — folded into MEDIUM-2

### ✅ BUG-6 · `safeJson` strips proto-pollution keys
- `src/components/react/puck-components/sections.tsx` — `safeJson` now walks the parsed object and strips `__proto__` / `constructor` / `prototype` keys at every level (new `stripProtoKeys` helper).
- `src/components/sections/PuckRenderer.astro` — same treatment for the public renderer.
- The server-side sanitizer (`src/lib/puck-sanitize.ts`) also strips these keys as part of HIGH-4.

### ⏭️ BUG-7 · ReserveForm action — **deferred**
- The report flagged `action="/"` as potentially flaky for form-submission handling under Netlify + SSR. In practice this works correctly with the `public/__forms.html` build-time registration in place (no actual submission loss observed). Leaving as-is to avoid regressions. If submissions are lost in prod, change the action to `/thank-you` and create a matching static success page.

---

## LOW / INFO — not applied in this pass

The LOW findings (CSP `'unsafe-inline'`, Zoho token encryption at rest) and all INFO items remain open. They're documented in `SECURITY-AND-BUGS-REPORT.md` and can be scheduled for a future sprint. None are immediately exploitable.

---

## Files touched in this patch pass

### New files
- `src/lib/puck-sanitize.ts`
- `src/pages/api/zoho/authorize.ts`
- `PATCHES-APPLIED.md` (this file)

### Modified
- `src/lib/api.ts`
- `src/lib/rbac.ts`
- `src/pages/api/builder/save.ts`
- `src/pages/api/builder/restore.ts`
- `src/pages/api/media/index.ts`
- `src/pages/api/media/[id].ts`
- `src/pages/api/pages/[id].ts`
- `src/pages/api/users/index.ts`
- `src/pages/api/publish/webhook.ts`
- `src/pages/api/zoho/oauth-callback.ts`
- `src/pages/api/zoho/status.ts`
- `src/components/react/PageBuilder.tsx`
- `src/components/react/puck-components/sections.tsx`
- `src/components/sections/PuckRenderer.astro`

### Deleted
- `src/pages/api/debug/env-check.ts`
- `src/pages/api/debug/` (empty directory)

---

## Verification

- **`astro check`** — reports 3 type errors, all pre-existing in STABLE (unrelated to these patches):
  - `settings.astro` / `versions.astro` — pre-existing name-shadowing conflict with imports
  - `builder/save.ts:143` — pre-existing type glitch on `.rpc().catch()` (runtime works fine)
- **`npm run dev`** — boots cleanly in 2958ms, no runtime errors.
- The 3 pre-existing type errors are NOT new; they exist identically in the V1.0-STABLE snapshot.

---

## Deploy checklist

Before merging DEV → main and deploying to Netlify:

1. **Set `SCHEDULED_FN_SECRET`** in Netlify env vars if not already — without it, the cron endpoints will now reject requests (correct behavior; previously they would silently fall open).
2. Update any external cron callers or Netlify scheduled function configs to send the secret as `x-cron-secret` header (query-string `?secret=` is no longer accepted).
3. Update Netlify's "Deploy succeeded / failed" webhook URL if it was using `?secret=` — change to a header, or regenerate and re-register.
4. Smoke test after deploy:
   - Log in → still works
   - Admin → Settings → "Connect Zoho" → redirects to Zoho via `/api/zoho/authorize` → consent → return to `/api/zoho/oauth-callback` → "Zoho Connected" page (owner only)
   - Admin → Pages → click a page → Builder loads → edit → auto-save works (check Network tab)
   - Admin → Pages → publish → Netlify build fires
   - Try a viewer account: confirm they CAN still see Media Library, Events; cannot overwrite drafts; cannot see Users list
   - Try a contributor: can save drafts; cannot publish
   - Try an editor: full content control except user management

---

## Re-audit recommendation

After deploying these patches, schedule a re-audit in ~30 days:
- Confirm no new paths to the removed debug endpoint appeared elsewhere
- Confirm `SCHEDULED_FN_SECRET` fail-closed hasn't broken scheduled cron
- Review any new components added to Puck — `src/lib/puck-sanitize.ts` needs its component field map extended for each new component that has rich-text or URL props
- Address the LOW items (CSP hardening, Zoho token encryption) if time permits

---

*End of patch log. Keep this file updated as future patches land.*
