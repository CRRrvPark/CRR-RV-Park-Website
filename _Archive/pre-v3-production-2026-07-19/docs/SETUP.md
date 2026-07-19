# First-run setup

> Step-by-step for launching the platform the first time. Run through this once, then use [RUNBOOK.md](RUNBOOK.md) for ongoing ops.

---

## 1. Prerequisites

- [x] Node 20+ installed (`node --version`)
- [x] `npm install` has run at least once in the project root
- [x] You have `rvpark@crookedriverranch.com` credentials (or whichever HOA address is the master)

---

## 2. Create Supabase project (~5 min)

1. Go to [app.supabase.com](https://app.supabase.com) → sign in as `rvpark@crookedriverranch.com`
2. Click **New project**
   - **Name:** `crr-rv-park`
   - **Region:** `West US 2` (Oregon — minimizes latency)
   - **Database password:** generate a strong one, save to your password vault
3. Wait ~2 minutes for provisioning
4. From **Project Settings → API**, grab:
   - **Project URL** → goes in `.env` as `PUBLIC_SUPABASE_URL`
   - **`anon` `public` key** → goes in `.env` as `PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` `secret` key** → goes in `.env` as `SUPABASE_SERVICE_ROLE_KEY` (NEVER share this; bypasses RLS)

---

## 3. Bootstrap the database (~2 min)

Two SQL files must run in order. The first is manual (it installs the tools the automatic runner needs), then the runner does the rest.

### 3a. Bootstrap (manual, one-time)

1. In Supabase dashboard: **SQL Editor** → **New query**
2. Paste the contents of [`supabase/migrations/000_bootstrap.sql`](supabase/migrations/000_bootstrap.sql)
3. Click **Run**
4. Should output "Success. No rows returned."

### 3b. Apply the rest

```bash
cp .env.example .env
# Edit .env — paste in the 3 Supabase values from step 2

npm run db:migrate
```

Expected output:
```
Found 5 migration file(s):
  - 001_init.sql
  - 002_rls_policies.sql
  - 003_seed_pages.sql
  - 004_seed_home_content.sql
  - 005_runbook_table.sql

  → 001_init.sql … OK
  → 002_rls_policies.sql … OK
  → 003_seed_pages.sql … OK
  → 004_seed_home_content.sql … OK
  → 005_runbook_table.sql … OK

Done. Ran: 5, skipped: 0, failed: 0
```

---

## 4. Create the first owner user (~1 min)

```bash
npm run bootstrap:first-owner -- --email rvpark@crookedriverranch.com --name "Matt Birchard"
```

You'll be prompted for a password (min 12 chars). This creates both the Supabase Auth user and the `app_users` row with `role=owner`.

> **Note:** the system requires **≥2 active owners** at all times. Create a second owner from the admin UI shortly after first login.

---

## 5. Create the Supabase Storage bucket (~1 min)

1. Supabase dashboard → **Storage** → **New bucket**
2. **Name:** `media`
3. **Public:** ON (required — the website serves images from here)
4. **File size limit:** 10 MB (reasonable default)
5. **Allowed MIME types:** `image/jpeg, image/webp, image/png, image/gif`
6. Click **Save**

---

## 6. Set up Netlify (~5 min)

1. Go to [app.netlify.com](https://app.netlify.com) → sign in as `rvpark@crookedriverranch.com`
2. **Add new site** → **Import from Git** (connect the repo if using one) **OR** Manual deploy later
3. In **Site settings → Environment variables**, add EVERY variable from your `.env`:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NETLIFY_AUTH_TOKEN` (from your Netlify user settings → Personal access tokens — create one scoped to this site)
   - `NETLIFY_SITE_ID` (from Site settings → General)
   - `NETLIFY_BUILD_HOOK` (from Build & deploy → Build hooks → Add build hook)
4. Under **Build & deploy → Deploy notifications**:
   - Add **Outgoing webhook** for "Deploy succeeded" → URL `https://<your-site>/api/publish/webhook`
   - Add another for "Deploy failed" → same URL
5. Trigger a deploy

---

## 7. Set up Zoho OAuth (~5 min)

1. Go to [api-console.zoho.com](https://api-console.zoho.com) as the HOA Zoho admin
2. **Add Client** → **Server-based Applications**
   - **Client Name:** `CRR Website Platform`
   - **Homepage URL:** `https://www.crookedriverranchrv.com`
   - **Authorized Redirect URIs:** `https://www.crookedriverranchrv.com/api/zoho/oauth-callback`
3. Copy **Client ID** and **Client Secret** into your Netlify env vars:
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
   - `ZOHO_REDIRECT_URI=https://www.crookedriverranchrv.com/api/zoho/oauth-callback`

### 7a. Designate the media folder

1. In Zoho WorkDrive, find (or create) the Team Folder you want to use for website media
2. Right-click → **Get Folder ID** (or check the URL path)
3. Set `ZOHO_WORKDRIVE_MEDIA_FOLDER_ID` in Netlify env vars

### 7b. Designate the public events calendar

1. In Zoho Calendar, find (or create) the calendar for public events (e.g. "CRR Public Events")
2. Get its UID (Calendar settings → Calendar UID)
3. Set `ZOHO_CALENDAR_PUBLIC_EVENTS_ID` in Netlify env vars

### 7c. Connect

1. Deploy the site (or run locally with the env vars)
2. Sign in as an owner → **Settings** → **Zoho Integration** → **Connect Zoho**
3. Approve the scopes on the Zoho consent screen
4. You should be redirected back to the admin with "✓ Connected"

---

## 8. Test the full loop

From the admin dashboard, in order:

- [ ] **Sign in** — `/admin/login`
- [ ] **Dashboard loads** — shows your name + role + system health
- [ ] **Edit home page** — `/admin/editor/index` → change the hero subtitle → click out to save
- [ ] **Publish** — click "Publish Now" on the dashboard
- [ ] **Verify live site** — wait ~1–2 min, reload `/index.html`, confirm the edit appears
- [ ] **Check change log** — `/admin/audit` → confirm your edit + publish are recorded
- [ ] **Media sync** — Settings → "Sync now" next to WorkDrive → verify a few images appear at `/admin/media`
- [ ] **Calendar sync** — Settings → "Sync now" next to Calendar → verify events appear at `/admin/events`
- [ ] **Restore test** — Versions page → pick a snapshot → Restore → verify site reflects the snapshot after publishing

---

## 9. Invite a second owner

Per the HOA succession principle, you should never be the only owner:

1. **Admin → Users → + Invite user**
2. Email: pick a trusted HOA board member
3. Role: **Owner**
4. Send — they'll get an email with a sign-in link

---

## Troubleshooting

### "SQL execution failed" during `npm run db:migrate`
- Re-check you ran `000_bootstrap.sql` in Supabase SQL Editor before running `npm run db:migrate`. The migration runner depends on the `exec_sql` function created by bootstrap.

### Login works but admin shows "No app_users row found"
- The first-owner bootstrap inserts an `app_users` row, but if you created the auth user manually (via Supabase dashboard), you'll need to insert the row yourself:
  ```sql
  insert into app_users (id, email, display_name, role, is_active)
  values ('<uuid-from-auth.users>', 'you@example.com', 'Your Name', 'owner', true);
  ```

### Zoho "Connect" button does nothing
- Check browser dev tools for the redirect — if it's `null`, the env vars aren't set in Netlify
- Verify `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_REDIRECT_URI` are all in Netlify env vars and that you've redeployed after adding them

### Images aren't appearing in Media Library after sync
- Verify the Supabase Storage `media` bucket exists and is public (step 5)
- Check `/admin/settings` → WorkDrive last sync for the actual error message
- The Zoho API response shape could differ slightly from what the code expects; check Netlify Function logs and I can adjust

### Build fails with "EPERM: operation not permitted, rmdir .netlify"
- OneDrive file locking — close any editors with the project open, or delete `.netlify/` manually and retry
