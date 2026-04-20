# Netlify Deployment Guide

> If the admin login fails after deploying to Netlify, it's almost always
> because one of the environment variables below is missing in the Netlify
> dashboard. This guide walks through every step.

---

## Deployment model (as of 2026-04-19)

**Continuous deployment from GitHub is the primary and only expected path.**

- Every `git push` to `main` on https://github.com/CRRrvPark/CRR-RV-Park-Website triggers a Netlify build automatically.
- Build command: `npm run build` (from `netlify.toml`).
- Publish directory: `dist`.
- Functions directory: `.netlify/v1/functions`.
- Auto-deploy takes roughly 3–5 minutes per push.

**Drag-and-drop deploys are deprecated.** They still work in an emergency (Netlify → Sites → drag a `dist/` folder onto the drop target), but the normal flow is git-first.

**Netlify CLI deploys (`netlify deploy --prod`) also still work**, but are rarely needed. Most common use case: verifying a deploy from a pre-release branch before merging.

### Common gotcha: "Unrecognized Git contributor" blocks a deploy

Netlify's paid plans include a "verified contributors only" deploy gate. If a commit's author or co-author email isn't on the team, the deploy is blocked. The most common trigger is adding a `Co-Authored-By: <bot>` trailer to commits — bot emails aren't team members. Resolution: drop the trailer and keep commits authored by the team member only, **or** loosen the setting in Netlify → Team settings → Members → Deploy permissions.

---

## Why the admin login fails on Netlify (and works locally)

Your `.env` file only exists on your local machine. When Netlify runs `npm run build` on their servers, it has **no access** to your local `.env` — it only knows what you've entered in its own dashboard.

The admin login page needs two variables to reach the Supabase auth service from the browser:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

The server-side API routes need one more to bypass Row-Level Security:

- `SUPABASE_SERVICE_ROLE_KEY`

If any of these are missing, the login page renders blank or the Sign-In button throws an error.

---

## Step-by-step setup

### 1. Make sure you're using the new Astro config

This was a separate fix, already applied in code. Verify `astro.config.mjs` has:

```js
output: 'server',
adapter: netlify(),
```

If you ever see `output: 'static'` again, the login will break because API routes won't deploy as functions.

### 2. Add environment variables in the Netlify dashboard

1. Open the Netlify app: <https://app.netlify.com>
2. Click your site (the one at crookedriverranchrv.com)
3. Go to **Site configuration** → **Environment variables**
4. Click **Add a variable** → **Add a single variable** for each of these:

| Variable name | Where to get the value | Scope |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL | All scopes |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon / public key | All scopes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role key (secret) | All scopes |
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Applications → Personal access tokens → Generate new | All scopes |
| `NETLIFY_SITE_ID` | Netlify → Your site → Site configuration → General → Site ID | All scopes |
| `NETLIFY_BUILD_HOOK` | Netlify → Your site → Build & deploy → Build hooks → Add build hook | All scopes |
| `SITE_URL` | `https://www.crookedriverranchrv.com` | All scopes |
| `ADMIN_EMAIL_FROM` | `rvpark@crookedriverranch.com` | All scopes |
| `SCHEDULED_FN_SECRET` | Any random 32+ char string — same value as in your local `.env` | All scopes |

**Zoho variables** (add these once Zoho is wired up; skip for now if `ZOHO_REFRESH_TOKEN` is empty):

| Variable name | Value |
|---|---|
| `ZOHO_CLIENT_ID` | From your `.env` |
| `ZOHO_CLIENT_SECRET` | From your `.env` (secret) |
| `ZOHO_REDIRECT_URI` | `https://www.crookedriverranchrv.com/api/zoho/oauth-callback` |
| `ZOHO_ACCOUNT_DOMAIN` | `com` |
| `ZOHO_WORKDRIVE_MEDIA_FOLDER_ID` | From your `.env` |
| `ZOHO_CALENDAR_PUBLIC_EVENTS_ID` | From your `.env` |

### 3. Redeploy

After adding env vars, Netlify does **not** automatically rebuild. Trigger one of:

- **Option A (recommended):** push any commit to `main` — auto-deploys.
- **Option B:** Deploys tab → "Trigger deploy" → "Deploy site" (re-runs the last commit).
- **Option C:** `netlify deploy --build --prod` from the CLI in the repo folder.

### 4. Verify the login works

1. Visit `https://www.crookedriverranchrv.com/admin/login`
2. Open browser DevTools (F12) → Console tab
3. You should see **no errors** about `PUBLIC_SUPABASE_URL`
4. Enter credentials and click Sign in
5. On success, you're redirected to `/admin` dashboard

---

## Troubleshooting

### "Supabase not configured. See console for details."

The env vars didn't ship to the browser bundle. Check:

1. You added `PUBLIC_SUPABASE_URL` (with the `PUBLIC_` prefix — not `SUPABASE_URL`)
2. You triggered a fresh Netlify deploy *after* adding the vars
3. In Netlify: Site configuration → Build & deploy → Post-processing → no plugins are stripping env vars

### Sign-in button hangs / nothing happens

Open DevTools → Network tab → click Sign in:

- If you see a 404 on `/api/auth/...` routes — your Astro config still has `output: 'static'`. Fix and redeploy.
- If you see a 500 on Supabase auth — your `SUPABASE_SERVICE_ROLE_KEY` is wrong or missing.
- If you see CORS errors — you're probably hitting the wrong project; double-check `PUBLIC_SUPABASE_URL`.

### Sign-in says "No app_users row found"

Your Supabase Auth account exists but there's no matching row in the `app_users` table. Run:

```bash
npm run bootstrap:first-owner
```

from your local machine with `.env` populated, then try signing in again.

### Dashboard loads but "Checking your session…" spins forever

Probably a CSP violation. Open DevTools → Console → look for `Refused to connect to ... because it violates the Content Security Policy`. Add the blocked domain to `connect-src` in `netlify.toml` and redeploy.

---

## Rotating a secret

If a secret (service role key, Netlify token, Zoho secret) leaks:

1. In Supabase / Netlify / Zoho: regenerate the key, note the new value
2. In Netlify Env Vars: update the variable
3. In your local `.env`: update the variable
4. Trigger a fresh Netlify deploy

Never commit secrets to any shared medium (email, chat, docs). The `.env`
file must stay only on machines you control.

---

## Checklist before every production deploy

- [ ] `astro.config.mjs` has `output: 'server'`
- [ ] All required env vars set in Netlify dashboard
- [ ] Test login on a deploy preview URL before pointing DNS
- [ ] Verify `/admin/login` renders the form (no blank page)
- [ ] Verify signing in redirects to `/admin` and shows the dashboard
- [ ] Verify at least one content edit → publish cycle works end-to-end
