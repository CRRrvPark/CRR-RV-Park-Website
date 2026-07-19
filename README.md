# Crooked River Ranch RV Park Website

The public website and operational admin for Crooked River Ranch RV Park in
Terrebonne, Oregon.

The production design is the approved V3 system: a restrained forest,
mineral, and sea-glass palette; layered glass-gradient surfaces; direct
navigation; availability-first booking paths; and affirmative, factual copy.

## Architecture

```text
Guests
  -> Astro public pages on Netlify
     -> Rimrock live availability (read-only proxy)
     -> Firefly Reservations (booking and guest portal)
     -> Supabase (sites, trails, activities, dining, events, map data)
     -> Google Maps / Places (maps, directions, current place details)

Park staff
  -> /admin operational console
     -> media, events, area-guide records, park map, users, audit, integrations

Website changes
  -> Netlify Agent Runner (Claude Code or Codex)
     -> isolated Git branch
     -> Deploy Preview + file diff
     -> GitHub pull request
     -> reviewed merge
```

There is deliberately no WYSIWYG, drag-and-drop builder, browser code editor,
or in-admin publishing pipeline. Public-page copy and layout are explicit
Astro source files so every change is reviewable, previewable, and reversible
through Git.

## Start here

- Operators: [RUNBOOK.md](RUNBOOK.md)
- Local setup: [SETUP.md](SETUP.md)
- Netlify AI editing: [NETLIFY-AI-EDITING.md](NETLIFY-AI-EDITING.md)
- Deployment: [NETLIFY-DEPLOY.md](NETLIFY-DEPLOY.md)
- Architecture: [PROJECT-DETAILS.md](PROJECT-DETAILS.md)
- Pre-V3 recovery: [RESTORE-PRE-V3.md](RESTORE-PRE-V3.md)
- Current handoff: [HANDOFF-V5-PRODUCTION-REMODEL.md](HANDOFF-V5-PRODUCTION-REMODEL.md)

## Local development

```bash
npm install
copy .env.example .env
npm run dev
npm run check
npm run build
```

Astro runs at `http://localhost:4321`. Node 20 is the production baseline.

## Important boundaries

- Firefly remains the booking, payment, and guest-account authority.
- Rimrock provides the live availability snapshot shown on the site.
- The RV park and Crooked River Ranch Golf Course are independently managed.
- Zoho WorkDrive and Calendar remain the upstream sources for synchronized
  media and events.
- Supabase authentication and operational records remain active.
- Retired editor code and the pre-remodel site are preserved under `_Archive/`.

## Ownership

This software and its service accounts are owned by the Crooked River Ranch
HOA. Production credentials belong only in local `.env` files and Netlify
environment variables; they are never committed.
