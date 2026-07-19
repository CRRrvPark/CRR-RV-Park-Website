# Local and Service Setup

Use Node 20. This project is an established Astro, TypeScript, React,
Supabase, and Netlify application.

## Local setup

```bash
npm install
copy .env.example .env
npm run dev
```

The local site runs at `http://localhost:4321`.

Before handing off a change:

```bash
npm run check
npm run build
```

## Environment variables

Copy `.env.example` and provide the values held by the HOA:

- Supabase: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- Netlify: `NETLIFY_BUILD_HOOK`
- Zoho OAuth: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`,
  `ZOHO_REDIRECT_URI`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_DOMAIN`
- Zoho sources: `ZOHO_WORKDRIVE_MEDIA_FOLDER_ID`,
  `ZOHO_CALENDAR_PUBLIC_EVENTS_ID`
- Google: `GOOGLE_PLACES_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`,
  `PUBLIC_GOOGLE_MAPS_API_KEY`, and optional `PUBLIC_GOOGLE_MAPS_MAP_ID`
- Site and operations: `SITE_URL`, `ADMIN_EMAIL_FROM`,
  `SCHEDULED_FN_SECRET`

Never commit `.env`.

## Database

For a new Supabase project, run `supabase/migrations/000_bootstrap.sql` once in
the Supabase SQL editor, then:

```bash
npm run db:migrate
npm run bootstrap:first-owner -- --email rvpark@crookedriverranch.com --name "RV Park Owner"
```

Create the public `media` Storage bucket and keep the checked-in migrations as
the schema authority.

## Netlify

1. Connect the GitHub repository.
2. Use Node 20.
3. Build command: `npm run build`.
4. Publish output and functions are configured by the Astro Netlify adapter.
5. Add the environment variables listed above.
6. Confirm the two scheduled functions:
   - `zoho-drive-sync` every 15 minutes
   - `zoho-calendar-sync` hourly at minute 17
7. Enable Netlify AI features and Agent Runners for the team, then connect
   Claude Code and/or OpenAI Codex as described in
   [NETLIFY-AI-EDITING.md](NETLIFY-AI-EDITING.md).

## First verification

- Public home, Sites, Park + Area, Plan, policies, and dynamic detail pages load.
- `/availability` shows a fail-soft state when Rimrock is unavailable.
- Firefly reservation and guest-portal links open the external service.
- Admin authentication succeeds.
- Media, events, area guide, map, users, audit, settings, and runbook load.
- Zoho sync calls require either an authenticated administrator or the
  scheduled-function secret.
- `npm run check` reports no errors.
- `npm run build` completes successfully.

The retired WYSIWYG schema remains in Supabase only for recovery compatibility;
there is no active editor route or API.
