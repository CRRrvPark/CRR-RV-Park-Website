# CRR RV Park — Operations Runbook

> **Audience:** any HOA board member, office staff member, or developer who needs to understand, operate, recover, or hand off this system.
>
> **Why this document exists:** the website is owned by the Crooked River Ranch HOA, not by any individual. This runbook ensures the system can be operated by anyone with appropriate access, even if the original developer is unavailable.
>
> **Print this annually.** Hand the printed copy to the HOA board. If electronic access is ever compromised, the paper version still works.

---

## TABLE OF CONTENTS

1. [System overview](#1-system-overview)
2. [Account inventory](#2-account-inventory)
3. [Access management](#3-access-management)
4. [How to do common tasks](#4-how-to-do-common-tasks)
5. [Recovery procedures](#5-recovery-procedures)
6. [Billing](#6-billing)
7. [Hiring a new developer](#7-hiring-a-new-developer)
8. [Glossary](#8-glossary)

---

## 1. SYSTEM OVERVIEW

The Crooked River Ranch RV Park website lives at **https://www.crookedriverranchrv.com**.

It is built from three connected services:

| Service | What it does | Where to log in |
|---|---|---|
| **Netlify** | Hosts the public website; runs the admin behind the scenes | https://app.netlify.com |
| **Supabase** | Database holding all editable content + admin user accounts | https://app.supabase.com |
| **Zoho One** | Source of media (WorkDrive folder) + events calendar | https://www.zoho.com |

The website is split into two parts:

- **Public site** — the pages every visitor sees (home, book now, amenities, etc.)
- **Admin** — at `/admin`, only accessible after sign-in. This is where all editing happens.

**Booking is NOT done through this website.** Reservations go through Firefly Reservations, an external service. The "Reservations" button on the site links there. We do not handle payments, customer accounts, or booking data — Firefly does.

---

## 2. ACCOUNT INVENTORY

Every account below is registered to **`rvpark@crookedriverranch.com`** (the HOA-owned address in Zoho Mail). If you can sign into that mailbox, you can recover access to every other account via "forgot password" emails.

| Account | Login URL | Email | What it controls | Renewal cost |
|---|---|---|---|---|
| Domain registrar (TBD — confirm) | (registrar URL) | rvpark@crookedriverranch.com | The `crookedriverranchrv.com` domain itself | ~$15/year |
| Netlify | https://app.netlify.com | rvpark@crookedriverranch.com | Website hosting + admin functions | $0 free tier; ~$19/mo if exceeded |
| Supabase | https://app.supabase.com | rvpark@crookedriverranch.com | Content database + user logins | $0 free tier; $25/mo if exceeded |
| Zoho One | https://accounts.zoho.com | rvpark@crookedriverranch.com | Drive (media), Calendar (events), Mail | already paid via existing Zoho One subscription |
| Microsoft Clarity | https://clarity.microsoft.com | rvpark@crookedriverranch.com | Visitor analytics (heatmaps, recordings) | Free |
| Firefly Reservations | (their dashboard URL) | (separate account) | Booking system (independent of website) | (separate billing) |

**Critical:** the email account `rvpark@crookedriverranch.com` itself is the master key. Make sure at least 2 HOA people have access to that mailbox at all times.

---

## 3. ACCESS MANAGEMENT

### Who can log into the admin

There are 4 role tiers, set per user in the admin's "Users" page:

| Role | Can do |
|---|---|
| **Owner** | Everything — code editing, user management, billing, restore from snapshots. **Always have at least 2 active owners.** |
| **Editor** | Edit any content + publish to the live site. Approve drafts from Contributors. Cannot edit code or manage users. |
| **Contributor** | Draft content edits — they are held until an Editor or Owner approves them. Cannot publish directly. |
| **Viewer** | Read-only access. Useful for board members who want to see what's happening without edit risk. |

### How to add a new admin user

1. Sign into `https://www.crookedriverranchrv.com/admin` as an Owner
2. Click "Users" → "Invite User"
3. Enter email, display name, role
4. They receive an email with a sign-in link
5. They set their own password on first sign-in

### How to remove an admin user

1. Sign in as Owner
2. Click "Users" → find them → "Deactivate" or "Remove"
3. The system blocks you from removing the last Owner — promote someone else first

---

## 4. HOW TO DO COMMON TASKS

### Edit text on the home page (or any page)

1. Sign into `/admin`
2. Click "Edit Pages" in the left sidebar
3. Click the page you want to edit
4. Click any text or image directly to edit it
5. Click "Publish Now" in the top right to push the change live
   - Or "Save Draft" if you want an Editor to review first

### Replace an image

1. Add the new image to your designated Zoho WorkDrive folder
2. Wait up to 15 minutes for the sync (or click "Sync Now" on the Media page)
3. Edit the page where the image appears, click the image, choose the new one from the library
4. Publish

### Add an upcoming event

1. Add the event to your designated Zoho "CRR Public Events" calendar
2. Within an hour, it appears at `/events` on the public site automatically
3. To hide a synced event from the public site, go to admin → Events → toggle it off

### Publish changes

The "Publish Now" button on the dashboard:
- Captures a snapshot of current content (so you can undo)
- Triggers Netlify to rebuild the site
- Takes 1–2 minutes; you'll see a status indicator

### Restore a previous version

1. Admin → Versions / Restore
2. Find the version you want (each is timestamped + labeled with what triggered it)
3. Click "Preview" to see what it looked like
4. Click "Restore" to make it live
5. The system snapshots the current state first, so restoring is itself reversible

---

## 5. RECOVERY PROCEDURES

### "The site is down"

1. Visit `https://www.crookedriverranchrv.com` in an incognito window — confirm the site is actually down vs. a local browser issue
2. Visit `https://app.netlify.com` and check the deploy status
3. If the latest deploy failed, click "Restore" on the previous successful deploy (Netlify provides one-click rollback)
4. If Netlify itself is down, check https://www.netlifystatus.com

### "I can't sign into the admin"

1. Use the "Forgot password" link on the login page — Supabase emails a reset link
2. If you can't access the email account, ask another Owner to reset your role
3. If there are no other Owners, this is the worst-case scenario — you need a Supabase admin to manually fix the database. See "Hiring a new developer" below.

### "Content I edited disappeared"

1. Check the change log (admin → Change Log) — search for your name and the date
2. If the edit shows there but isn't on the live site, you forgot to publish. Click "Publish Now"
3. If the edit doesn't show in the change log either, it didn't save. Try again

### "Zoho sync is broken"

1. Admin → Settings → Zoho Integration — check status
2. If it shows disconnected, click "Reconnect Zoho" and complete the OAuth flow again
3. The most common cause: the Zoho token expired or was revoked. Reconnecting fixes it

### "I made a code change and the site broke"

The system is designed to prevent this:
- Code edits require a successful preview build before publishing
- If a production build fails, the site automatically rolls back to the previous version

But if it happens anyway:
1. Admin → Versions / Restore → click "Restore" on the last known good snapshot
2. Then either fix the code or contact the developer

---

## 6. BILLING

All charges go to the payment method on file under `rvpark@crookedriverranch.com`.

| Service | Approximate cost | When billed |
|---|---|---|
| Domain renewal | ~$15/year | Anniversary of registration |
| Netlify | $0 (free tier) — could reach $19/mo if traffic spikes | Monthly |
| Supabase | $0 (free tier) — could reach $25/mo if database grows past free limits | Monthly |
| Zoho One | (already paid) | Existing subscription |
| **Total expected** | **$0–$45/month** | |

### To check current bills

- Netlify: https://app.netlify.com → Billing
- Supabase: https://app.supabase.com → Project Settings → Billing

### If a bill spikes unexpectedly

1. Check what changed (new traffic spike? large image uploads? lots of database queries?)
2. Both Netlify and Supabase let you set spending caps — go to Billing → Limits
3. Contact your developer if you're unsure

---

## 7. HIRING A NEW DEVELOPER

Any reasonable web developer can take over this system. Send them this runbook + the [README.md](README.md) in the repository.

### Onboarding checklist

1. Add them to Netlify as a "Collaborator" (Site settings → Members)
2. Add them to Supabase as a "Member" with appropriate access (Project Settings → Members)
3. Create them an Owner-role admin account (Admin → Users → Invite)
4. Give them access to the project source code (the `crr-rv-park-platform` directory)
5. Walk them through the project structure (or send them [SPEC-PHASE-1.md](SPEC-PHASE-1.md))

### Removing a former developer

1. Remove their Netlify Collaborator access
2. Remove their Supabase Member access
3. Deactivate their admin account (Admin → Users → Deactivate)
4. (Optional) Rotate the `SUPABASE_SERVICE_ROLE_KEY` and `NETLIFY_AUTH_TOKEN` env vars on Netlify

### What to look for in a developer

The system uses: **Astro**, **TypeScript**, **React**, **Supabase** (Postgres + Auth + Storage), **Netlify Functions**, **Tiptap**, **Monaco**. Any developer comfortable with modern JavaScript/TypeScript and a Postgres database can work on it. Estimated handoff time: **half a day** for someone competent.

---

## 8. GLOSSARY

- **Astro** — the framework that builds the public website pages
- **Build** — the process of generating the live website from the latest content (takes 1–2 minutes)
- **Content block** — the smallest editable unit of the site (a paragraph, an image, a price)
- **Deploy** — the act of putting a built website on the live server
- **Netlify** — the company that hosts the website
- **OAuth** — a way for one service (us) to read data from another (Zoho) without sharing passwords
- **Publish** — taking edits in the admin and pushing them to the live site
- **Roll back / Restore** — reverting the live site to a previous version
- **Snapshot** — a saved copy of all content at a point in time
- **Supabase** — the database that stores all editable content + user accounts
- **Tiptap** — the in-page text editor visitors to the admin use to edit content
- **Zoho One** — the suite that includes WorkDrive (file storage) + Calendar + Mail

---

*Document version: 0.1 (initial scaffold). Last updated: April 2026.*
