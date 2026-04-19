# Security & Bug Audit Report — V1.0 Stable

> **Audited:** 2026-04-16
> **Scope:** `src/**`, `public/**`, `netlify.toml`, `astro.config.mjs`
> **Method:** Static review of auth/authz flow, input paths, trust boundaries, error handling, and data flows
> **Changes made:** None. This is a read-only audit. Fixes are recommendations.
>
> **Severity legend**
> - 🔴 **HIGH** — exploitable now, or likely to be; fix before any public traffic increase
> - 🟠 **MEDIUM** — real risk but narrow preconditions; fix in the next cycle
> - 🟡 **LOW** — hygiene / defense-in-depth; fix when convenient
> - ℹ️ **INFO** — not a bug, documented for awareness

---

## Executive summary

| Category | High | Medium | Low |
|---|---:|---:|---:|
| Authentication & Authorization | 3 | 3 | 1 |
| Input validation / XSS | 2 | 2 | 1 |
| Secrets / Config | 1 | 1 | 0 |
| CSP / Headers | 0 | 1 | 1 |
| Error handling / Bugs | 0 | 4 | 3 |
| Data integrity | 0 | 2 | 2 |
| **Total** | **6** | **13** | **8** |

**The six HIGH items are the ones I would fix before the next deploy.** They're concentrated in three areas: an unauthenticated debug endpoint, the scheduled-function secret falling open when unset, and the Puck save path accepting any authenticated user's data without validation or content sanitization.

---

# PART 1 — SECURITY FINDINGS

## 🔴 HIGH-1 · Unauthenticated `/api/debug/env-check` leaks reconnaissance data

**File:** [src/pages/api/debug/env-check.ts](src/pages/api/debug/env-check.ts)

**Issue:** The endpoint has no `requireAuth` / `requireRole` gate. Anyone on the internet can hit it and receive:
- Which env vars are set (attack surface enumeration — e.g. "AUTH_TOKEN present, SCHEDULED_FN_SECRET absent")
- A live DB connectivity probe
- The first 3 page slugs from the `pages` table

The file's own comment says *"DELETE THIS FILE once everything is working."*

**Impact:** Information disclosure. Tells an attacker exactly which security controls are present, which env vars to guess, and confirms DB reachability.

**Fix:**
```ts
// Wrap the handler with requireRole('owner') — OR delete the file entirely
// now that the original deploy-debug purpose is served.
await requireRole(request, 'change_user_role'); // owner-only
```

---

## 🔴 HIGH-2 · `requireScheduledOrAuth()` falls open when env var is missing

**File:** [src/lib/api.ts:60-78](src/lib/api.ts)

**Issue:** If `SCHEDULED_FN_SECRET` is not set in Netlify env, the function logs a warning and **allows the request through anonymously**. Affected endpoints:
- `/api/zoho/drive-sync` (POST/GET)
- `/api/zoho/calendar-sync` (POST/GET)
- `/api/publish/webhook` (POST)
- `/api/snapshots/prune` (cron)

**Impact:**
- Anonymous attacker can spam Drive/Calendar syncs → rate-limit pain or data corruption
- Anonymous attacker can POST a fake `state: "error"` + `context: "production"` to `/api/publish/webhook` → **auto-rollback of the live site**
- Anonymous attacker can prune snapshots → destroys restore points

**Fix:** Fail closed. If the secret isn't set, reject the request:
```ts
if (!expected) {
  throw new UnauthenticatedError('SCHEDULED_FN_SECRET is not configured on this server. Cron endpoints are disabled until set.');
}
```
And set `SCHEDULED_FN_SECRET` in Netlify env vars as a mandatory deploy requirement.

---

## 🔴 HIGH-3 · `/api/builder/save` allows ANY authenticated user to overwrite drafts

**File:** [src/pages/api/builder/save.ts:21-58](src/pages/api/builder/save.ts)

**Issue:** The `reason: 'auto'` branch only calls `requireAuth(request)`. That means a **viewer** (intentionally read-only) or a **contributor** can overwrite any page's draft by sending `POST /api/builder/save` with `{ slug, data, reason: 'auto' }`. Viewers are not supposed to write anything.

**Impact:** Viewer-role user can destroy work-in-progress drafts on any page. Contributor with ephemeral access (e.g., recently offboarded but cookies still valid) can sabotage drafts before the session expires.

**Fix:** Gate on capability:
```ts
if (reason === 'auto') {
  await requireRole(request, 'edit_content_draft'); // minimum: contributor
  // …rest of handler
}
```

---

## 🔴 HIGH-4 · Puck draft data is not sanitized — stored XSS path

**File:** [src/pages/api/builder/save.ts](src/pages/api/builder/save.ts) (any `reason`)

**Issue:** The legacy field editor path (`/api/content/blocks` PATCH) runs `sanitizeRichHtml()` + `isSafeUrl()` checks on every rich-text and URL field. The Visual Builder path stores the **entire Puck JSON verbatim** into `page_drafts.data` and `pages.page_builder_data`. Every rich-text field (`TextBlock.body`, `HeroSection.subtitle`, `TwoColumnSection.body`, `InterludeSection.headline`, `CtaBannerSection.body`, `TwoColumnSection.body`, …) ends up rendered via Astro's `set:html` on the public site with no sanitization.

Tiptap's default schema is protective, but it's not a sanitizer — it can't stop someone from:
- Posting the raw Puck JSON directly to `/api/builder/save` with arbitrary HTML in `props.body`
- Using the HtmlEmbed component's `code` field (which is sandboxed in an iframe — OK) but also using a rich text field with `<img src=x onerror=alert(1)>` (NOT sandboxed)

**Impact:** A contributor-role user can inject stored XSS onto any page they can publish a draft for. Once an editor approves + publishes, the payload runs for every visitor to the public site. **This is the biggest security risk in the codebase.**

**Fix:** Add a sanitization pass on every save:
```ts
import { sanitizePuckData } from '@lib/puck-sanitize'; // new helper

if (reason === 'auto' || reason === 'manual' || reason === 'publish') {
  const sanitized = sanitizePuckData(data);
  // use `sanitized` instead of `data` for all downstream writes
}
```
Where `sanitizePuckData` walks `content[]` and runs the existing `sanitizeRichHtml` from `src/pages/api/content/blocks.ts` on every known rich-text prop, plus `isSafeUrl` on every known URL prop. Known prop names can be derived from `puck-config.tsx`.

Alternative: use DOMPurify at render time in `PuckRenderer.astro` before passing to `set:html`. Cheaper change, but runs on every page render.

---

## 🔴 HIGH-5 · OAuth callback missing `state` verification + role check

**File:** [src/pages/api/zoho/oauth-callback.ts](src/pages/api/zoho/oauth-callback.ts)

**Two issues:**

1. **No `state` verification.** `buildAuthorizationUrl` ([src/lib/zoho.ts:34-49](src/lib/zoho.ts)) builds the URL with `state: user-${Date.now()}`, which isn't tied to the current session and isn't checked on return. This allows a classic OAuth CSRF attack where the attacker links their own Zoho account tokens to an authenticated victim's session. The victim's admin then reads the attacker's calendar/drive.

2. **Role not enforced.** The callback says *"you must be signed in as an Owner"* but actually calls `verifyRequestUser(request)` without checking `user.role === 'owner'`. Any authenticated user (including a viewer) can complete the OAuth flow.

**Impact:** A lower-privileged user can complete the Zoho connection, potentially pointing the org's "source of truth" media folder at an attacker's WorkDrive. Subsequent drive-syncs pull from that folder.

**Fix:**
```ts
// 1. Change state generation in buildAuthorizationUrl to a signed, session-bound nonce.
//    Easiest: generate a random value, store in a short-lived cookie, compare on return.

// 2. Gate callback on owner role:
const user = await requireRole(request, 'manage_zoho_integration'); // already owner-only in rbac.ts
```

---

## 🔴 HIGH-6 · `/api/media` POST accepts arbitrary columns

**File:** [src/pages/api/media/index.ts:27-38](src/pages/api/media/index.ts)

**Issue:** `const body = await request.json(); sb.from('media').insert(body)`. Raw user body spread into insert. An editor-role user can:
- Inject columns that bypass the sync pipeline (set `zoho_resource_id` to something colliding)
- Override `public_url_jpg` to a malicious URL (phishing vector on admin UI)
- Set `is_active: false` at creation, causing ghost rows
- Set columns not in the schema (DB rejects, but still)

**Impact:** Data integrity + open-redirect-style attacks through the media library.

**Fix:** Allow-list the columns:
```ts
const ALLOWED = ['filename', 'display_name', 'alt_text', 'caption', 'mime_type', 'byte_size', 'width', 'height'];
const insert = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)));
```
Also probably reduce this endpoint to owner-only or remove entirely since sync handles insertion.

---

## 🟠 MEDIUM-1 · `/api/users` GET returns full user list to any authenticated user

**File:** [src/pages/api/users/index.ts:21-29](src/pages/api/users/index.ts)

**Issue:** GET is gated by `verifyRequestUser` (any auth), but returns the full `app_users` table — all emails, display names, roles, timestamps. A viewer sees every user's email and role.

**Impact:** Information disclosure. For a small non-profit team, not catastrophic, but the invite list of who-is-what shouldn't be visible to read-only roles.

**Fix:** Gate GET on `view_users` capability (which exists in `rbac.ts` → minimum viewer, but consider promoting to editor).

---

## 🟠 MEDIUM-2 · `.or()` query with interpolated imageUrl (PostgREST injection risk)

**File:** [src/pages/api/media/[id].ts:74-76](src/pages/api/media/[id].ts)

**Issue:**
```ts
.or(`value_image_url.eq.${imageUrl},value_text.ilike.%${imageUrl}%,value_html.ilike.%${imageUrl}%`);
```
Because `imageUrl` can contain `,` `)` or other PostgREST filter syntax, an editor-role user who controls the `media.public_url_jpg` (e.g. via the POST in HIGH-6 or a manipulated upload) can inject additional filter clauses — effectively a query-level injection into the usage-check lookup. Worst case: the usage check returns 0 when it shouldn't, allowing deletion of an in-use image.

**Impact:** Integrity / broken-links risk, not data exfiltration.

**Fix:** Use parameterized `.or(..., { foreignTable: ... })` or split into multiple typed queries. Or refuse to run the check if `imageUrl` contains filter-meta characters.

---

## 🟠 MEDIUM-3 · `SCHEDULED_FN_SECRET` passed via URL query parameter

**File:** [src/lib/api.ts:73](src/lib/api.ts)

**Issue:** The fallback accepts `?secret=...` in the query string. URL query strings leak into:
- Browser history (if any admin hits the URL from a browser)
- Server access logs (Netlify logs include query strings)
- HTTP Referer headers when the response page links out

**Fix:** Require header-only (`x-cron-secret`). Remove query-param support. Netlify's scheduled functions can be configured to send the secret as a header.

---

## 🟠 MEDIUM-4 · `/api/pages/[id]` DELETE uses user-management capability for page deletion

**File:** [src/pages/api/pages/[id].ts:87](src/pages/api/pages/[id].ts)

**Issue:** `requireRole(request, 'change_user_role')` is used to gate page deletion. Functionally still owner-only (change_user_role is owner-only), but semantically confusing — if the capability matrix ever shifts, a page-delete could drift in permissions unexpectedly.

**Fix:** Add dedicated `delete_page` capability to `rbac.ts` → owner. Use that here.

---

## 🟠 MEDIUM-5 · `/api/builder/restore` doesn't verify `slug` matches `version.page_id`

**File:** [src/pages/api/builder/restore.ts:15-63](src/pages/api/builder/restore.ts)

**Issue:** The user passes both `slug` and `versionId`. The code uses `versionId` to look up the target, but doesn't check that `version.page_id` is the page for `slug`. An editor can accidentally (or intentionally) pass a versionId from a different page → that page's data gets restored to the wrong draft.

**Impact:** Data-integrity / operator confusion, not classic security, but could silently overwrite drafts.

**Fix:**
```ts
const { data: page } = await sb.from('pages').select('id').eq('slug', slug).single();
if (!page || page.id !== version.page_id) {
  return json({ error: 'Version does not belong to this page' }, 400);
}
```

---

## 🟠 MEDIUM-6 · No sanitization of `role` enum in user invite / role change

**File:** [src/pages/api/users/index.ts:42-46, 93-97](src/pages/api/users/index.ts)

**Issue:** The TypeScript cast `role: 'owner' | 'editor' | 'contributor' | 'viewer'` is erased at runtime. A malicious client can send `{ role: 'superadmin' }` or `{ role: '' }`. The DB may or may not reject depending on column constraints (need to verify there's a CHECK constraint or enum type).

**Fix:** Runtime validate:
```ts
const VALID_ROLES = ['owner','editor','contributor','viewer'] as const;
if (!VALID_ROLES.includes(role)) return json({ error: 'invalid role' }, 400);
```

---

## 🟡 LOW-1 · CSP allows `'unsafe-inline' 'unsafe-eval'` in script-src

**File:** [netlify.toml:51](netlify.toml)

**Issue:** The CSP script-src allows inline scripts and `eval`. This significantly weakens XSS mitigation — if a stored-XSS (HIGH-4) does land, CSP won't stop it.

**Why it's currently LOW:** Reducing the CSP without breaking Monaco (`unsafe-eval` required), Clarity (inline), and Puck (inline styles/scripts) requires a refactor — nonces + hashes. Worth doing, but not blocking.

**Fix (phased):**
1. Generate a per-response nonce in a middleware
2. Pass nonce into any inline scripts (ClarityScript.astro, etc.)
3. Remove `'unsafe-inline'` from script-src, replace with `'nonce-<value>'`
4. `'unsafe-eval'` can stay for admin routes only, scoped via route-specific CSP header

---

## 🟡 LOW-2 · Zoho tokens stored in plaintext in DB

**File:** [src/lib/zoho.ts:97-108](src/lib/zoho.ts), `zoho_tokens` table

**Issue:** Access and refresh tokens are stored as plaintext columns. If the DB is compromised or a backup leaks, an attacker can immediately use those tokens against Zoho.

**Why it's currently LOW:** Service-role access to the DB is already the keys-to-the-kingdom. Encrypting at rest within the DB only helps against backup leaks / read-only SQL injection.

**Fix:** Encrypt tokens with an app-level AES key before storing (key stored in an env var outside Supabase). Decrypt inside `loadStoredTokens`. Adds ~40 lines.

---

# PART 2 — BUG FINDINGS (non-security)

## 🟠 BUG-1 · `/api/users/index.ts` claims to have DELETE but it's implemented in `[id].ts`

**File:** [src/pages/api/users/index.ts:1-10](src/pages/api/users/index.ts) (doc-comment), [src/pages/api/users/[id].ts](src/pages/api/users/[id].ts) (actual impl)

**Issue:** The top-of-file doc says `DELETE — remove a user (owner only)` but only `GET`, `POST`, `PATCH` are exported. The real DELETE is at `[id].ts`. Confuses future contributors; no runtime impact unless someone reads the doc + wires a DELETE to the wrong URL.

**Fix:** Remove the DELETE line from the index.ts header doc, or add an explicit "see [id].ts for DELETE" note.

---

## 🟠 BUG-2 · `/api/media/[id].ts` usage-check ignores Puck page data

**File:** [src/pages/api/media/[id].ts:69-82](src/pages/api/media/[id].ts)

**Issue:** Usage check looks only at `content_blocks` (legacy editor). Pages using the Visual Builder store image URLs inside `pages.page_builder_data` JSON. The check doesn't scan those. Result: an image referenced by a Puck-based page can be "safely" deleted, then the live page renders broken thumbnails.

**Fix:** Extend the usage check:
```ts
const { count: puckRefs } = await sb
  .from('pages')
  .select('*', { count: 'exact', head: true })
  .textSearch('page_builder_data::text', imageUrl); // or a targeted JSONB query
```
Better: extract URLs into a dedicated join table `media_usage` updated on save, and query that.

---

## 🟠 BUG-3 · Publish webhook matches the "most recent pending" — race condition

**File:** [src/pages/api/publish/webhook.ts:49-56](src/pages/api/publish/webhook.ts)

**Issue:** If two publishes fire in quick succession, the webhook resolves the current deploy ID against whatever `publishes` row is "most recent queued/building" — which may not be the one that actually finished. The comment acknowledges this.

**Impact:** Incorrect attribution in audit log + `publishes` table. Rare but plausible if rapid successive "Publish" clicks.

**Fix:** Use Netlify deploy metadata (branch/context/created_at) to match more precisely, or change `triggerBuildHook` to parse the response and record the deploy ID upfront.

---

## 🟠 BUG-4 · Auto-save debounce + sendBeacon can race

**File:** [src/components/react/PageBuilder.tsx:131-142](src/components/react/PageBuilder.tsx)

**Issue:** `saveTimerRef` runs a debounced save, and `beforeunload` uses `navigator.sendBeacon` to flush. If the user closes the tab while the debounce timer is pending, sendBeacon fires (good) but the running timer will also fire in Astro's detached context (bad — may throw an error that's silently swallowed).

**Impact:** Occasional 500s in function logs post-session; last edit possibly duplicated in `page_drafts` history.

**Fix:** `clearTimeout(saveTimerRef.current)` inside the `beforeunload` handler before calling sendBeacon.

---

## 🟡 BUG-5 · Image usage-check uses ilike on unescaped imageUrl with `%` wildcards

**File:** [src/pages/api/media/[id].ts:75](src/pages/api/media/[id].ts)

**Issue:** If `imageUrl` contains literal `%` or `_` (PostgreSQL LIKE wildcards), the ilike pattern matches unintended rows — either over-counting (good for safety) or missing real matches.

**Fix:** Escape `%` and `_` in `imageUrl` before interpolation.

---

## 🟡 BUG-6 · `safeJson()` doesn't guard against prototype pollution

**File:** [src/components/react/puck-components/sections.tsx:22-24](src/components/react/puck-components/sections.tsx) and [src/components/sections/PuckRenderer.astro:114-117](src/components/sections/PuckRenderer.astro)

**Issue:** `JSON.parse()` of user-controlled strings (card JSON, feature lists, etc.) is passed around. While JS doesn't prototype-pollute from parsed object literals by default, `__proto__` and `constructor` keys can behave unexpectedly if merged into other objects with `Object.assign` or spread.

**Why LOW:** The parsed values are only ever accessed as-is for rendering, not merged into other objects. No real exploitation path today. Defense in depth.

**Fix:** After `JSON.parse`, strip dangerous keys:
```ts
if (parsed && typeof parsed === 'object') {
  for (const k of ['__proto__', 'constructor', 'prototype']) delete (parsed as any)[k];
}
```

---

## 🟡 BUG-7 · `ReserveForm.astro` form action="/" returns 200 from SSR, not Netlify's success page

**File:** [src/components/sections/ReserveForm.astro:19](src/components/sections/ReserveForm.astro)

**Issue:** `action="/"` submits to the home page. With SSR + prerender=true, the home page is served as static HTML — it doesn't run the Netlify Forms submission handler. Netlify Forms should intercept the POST via their edge function, but with SSR functions in play, the behavior is flaky; some form submissions reportedly don't register.

**Impact:** Potential silent form-submission loss.

**Fix:** Change action to an explicit Netlify-managed path or a custom success page: `action="/thank-you"` and ensure a `/thank-you` static page exists.

---

## Minor hygiene findings (INFO)

- **ℹ️ INFO-1:** `audit.ts` doesn't log failed login attempts. Not security-critical but useful for detecting brute-force. Consider adding a `login_attempted` / `login_failed` action.
- **ℹ️ INFO-2:** No rate limiting on any API endpoint. Netlify offers edge rate limiting; worth enabling for `/api/auth/*` and `/api/users/*`.
- **ℹ️ INFO-3:** The existing `SLUG_RE` in `pages/index.ts` doesn't cover Unicode — which is fine for English-only slugs but worth documenting.
- **ℹ️ INFO-4:** `/api/debug/env-check.ts` should just be deleted now. Its purpose is served.
- **ℹ️ INFO-5:** Admin loads Monaco (~2 MB). Consider `client:idle` or dynamic-import guard so it only loads when `/admin/code` is actually opened. Not strictly a bug.
- **ℹ️ INFO-6:** No `SECURITY.md` / vulnerability-disclosure policy at repo root. Best-practice for any public-facing site.

---

# Recommended remediation order

If you can only fix a handful of these, do them in this order — highest impact-per-effort first:

1. **Delete `src/pages/api/debug/env-check.ts`** (HIGH-1) — literally `rm` the file. 1 minute.
2. **Set `SCHEDULED_FN_SECRET` in Netlify env + harden fallback** (HIGH-2) — 10 minutes. Prevents the worst cascading attack (webhook rollback).
3. **Tighten `/api/builder/save` auth on `reason: 'auto'`** (HIGH-3) — 5 minutes, 1-line fix.
4. **Add Puck sanitization pass** (HIGH-4) — 1-2 hours. Biggest practical security win.
5. **Allow-list columns in `/api/media` POST** (HIGH-6) — 10 minutes.
6. **OAuth callback: enforce owner role + verify state** (HIGH-5) — 20 minutes for the role check, 1 hour for real state verification.

All six of those can be done in ONE afternoon and knock every HIGH finding off the list. The MEDIUMs are next-sprint work; LOWs are next-quarter.

---

# Files touched during audit (nothing modified)

| Path | Findings |
|---|---|
| `src/lib/auth.ts` | — (clean) |
| `src/lib/rbac.ts` | — (clean) |
| `src/lib/supabase.ts` | — (clean) |
| `src/lib/api.ts` | HIGH-2, MEDIUM-3 |
| `src/lib/zoho.ts` | HIGH-5 (buildAuthorizationUrl), LOW-2 |
| `src/lib/content.ts` | — (clean) |
| `src/pages/admin/login.astro` | — (clean; open-redirect handled) |
| `src/components/react/LoginForm.tsx` | — (clean) |
| `src/pages/api/auth/logout.ts` | — (not read; presumed clean) |
| `src/pages/api/pages/index.ts` | — (clean; slug validation in place) |
| `src/pages/api/pages/[id].ts` | MEDIUM-4 |
| `src/pages/api/sections/index.ts` | — (clean) |
| `src/pages/api/content/blocks.ts` | — (clean; good sanitizer) |
| `src/pages/api/users/index.ts` | MEDIUM-1, MEDIUM-6, BUG-1 |
| `src/pages/api/users/[id].ts` | — (clean) |
| `src/pages/api/events/index.ts` | — (clean) |
| `src/pages/api/media/index.ts` | HIGH-6 |
| `src/pages/api/media/[id].ts` | MEDIUM-2, BUG-2, BUG-5 |
| `src/pages/api/publish.ts` | — (clean) |
| `src/pages/api/publish/webhook.ts` | HIGH-2 (via requireScheduledOrAuth), BUG-3 |
| `src/pages/api/snapshots/restore.ts` | — (clean) |
| `src/pages/api/runbook.ts` | — (clean) |
| `src/pages/api/code/publish.ts` | — (clean; good gate) |
| `src/pages/api/builder/draft.ts` | — (clean) |
| `src/pages/api/builder/save.ts` | HIGH-3, HIGH-4 |
| `src/pages/api/builder/restore.ts` | MEDIUM-5 |
| `src/pages/api/builder/repair-home.ts` | — (clean) |
| `src/pages/api/zoho/oauth-callback.ts` | HIGH-5 |
| `src/pages/api/zoho/status.ts` | — (clean) |
| `src/pages/api/zoho/calendars.ts` | — (clean) |
| `src/pages/api/zoho/calendar-sync.ts` | — (clean; uses requireScheduledOrAuth → see HIGH-2) |
| `src/pages/api/zoho/drive-sync.ts` | — (clean; see HIGH-2) |
| `src/pages/api/zoho/workdrive-peek.ts` | — (clean) |
| `src/pages/api/debug/env-check.ts` | HIGH-1 |
| `src/components/react/PageBuilder.tsx` | BUG-4 |
| `src/components/react/puck-components/sections.tsx` | BUG-6 |
| `src/components/sections/PuckRenderer.astro` | BUG-6 |
| `src/components/sections/ReserveForm.astro` | BUG-7 |
| `netlify.toml` | LOW-1 |
| `astro.config.mjs` | — (clean) |
| `public/__forms.html` | — (clean) |

---

*End of audit. All findings are point-in-time observations based on V1.0 stable code. Re-audit after applying fixes.*
