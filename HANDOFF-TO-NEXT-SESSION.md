# Handoff — read this first

> **Current authoritative handoff:** [HANDOFF-V4-EDITOR-REBUILD.md](HANDOFF-V4-EDITOR-REBUILD.md).
>
> Everything below is pointer material — the actual next-session plan lives in the V4 handoff.

## State as of 2026-04-19

- **Repo:** https://github.com/CRRrvPark/CRR-RV-Park-Website (main branch auto-deploys to Netlify).
- **Live site:** https://www.crookedriverranchrv.com (unchanged URL; now deployed via git, not drag-drop).
- **Local working folder on primary dev machine:** `C:\dev\CRR-RV-Park-Website\` (the old `C:\Users\mathe\Documents\RV Park\crr-rv-park-platform-DEV\` is deprecated).

## What shipped up through 2026-04-19

- V1–V3 in full (see [HANDOFF-V1-TO-NEW-THREAD.md](HANDOFF-V1-TO-NEW-THREAD.md), [HANDOFF-V2-AREA-GUIDE.md](HANDOFF-V2-AREA-GUIDE.md), [HANDOFF-V3-WYSIWYG.md](HANDOFF-V3-WYSIWYG.md) for historical context).
- V3.1 end-to-end: manual photo upload (Supabase Storage), canvas-is-live-preview, rich-text + field-level link pickers, card array-field editor, Zoho sync resilience with classified errors + last-success stamp, section-IDs + per-block styles across every section, `TwoColumnSection.imageLinkUrl`, and migration of 7 legacy static `.astro` pages into `page_builder_data`.
- Dashboard upgrade: conversion-click tracking (Book Now / Reserve / tel: / mailto: / golf-tee), dashboard AlertsStrip for missing env vars, "Full analytics (Clarity) →" button linking to clarity.microsoft.com.

## What's next — V4 editor rebuild

Block-level atomization of the Visual Editor. Every headline, paragraph, image, button, spacer, divider, card becomes its own clickable Puck component. Owner-approved scope 2026-04-19.

**The full plan + step-by-step execution guide is in [HANDOFF-V4-EDITOR-REBUILD.md](HANDOFF-V4-EDITOR-REBUILD.md).** Do not re-plan — read that doc and execute.

## Known outstanding items

1. **Home page (`index`) is still on legacy `sections` + `content_blocks` schema.** Folded into V4 session 1 as the first full-page migration proof.
2. **Google Maps API key** needs configuration in Google Cloud Console (enable Maps JavaScript API, allowlist domains, verify billing). UI link to the right pages is on the admin's Area Guide tab.
3. **Netlify "only verified contributors" gate** was tripping deploys when commits had a `Co-Authored-By` trailer on 2026-04-19. Rule going forward: no `Co-Authored-By` on commits. If you hit the same block again, either remove the trailer or have the owner loosen the Netlify setting.

## For the V4 thread — first message template

> Read HANDOFF-V4-EDITOR-REBUILD.md. The plan is there. Start Session 1 step 1 (create EditableHeading atom). Commit + push each logical chunk. No exploratory work — just execute. Ping me at the end of each session with what landed + what's next.

## For any OTHER thread kicking off later

If you're not here to work on V4, first clarify scope with the owner. Do NOT start V4 work opportunistically — that rebuild needs owner-present context.
