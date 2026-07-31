# HANDOFF V4 — Visual Editor Block-Level Rebuild

**Written:** 2026-04-19. Next thread: read this top-to-bottom, then execute. No exploratory work first. The plan is here.

## The one-paragraph brief

The current Visual Editor (Puck-based, shipped in V3) lets editors click a *section* and see all of that section's fields as one flat form. That's unacceptable to the owner. Rebuild the editor so every **block-level** element on a page is individually clickable: headlines, paragraphs, buttons, images, spacers, dividers, cards — each is its own selectable Puck component with its own fields. Not character-level — block-level. Everything visible on the published site must be editable by clicking it. Public-site HTML output must stay byte-identical.

## Scope: what counts as a "block"

**Each of these is its own atom component, individually clickable in the canvas:**
- Headline (the whole H1/H2/H3 — one click, one editable unit)
- Sub-headline / section label / eyebrow
- Paragraph (one block per `<p>`; rich text inside)
- List item (each bullet one block)
- Badge / spec-tag / callout text
- Button / link
- Image (including captions, alt, sizing)
- Icon (emoji or inline SVG)
- Spacer
- Divider
- Line
- Each card inside a grid
- Tabs (if used)
- Containers (layout boxes that hold children)

**NOT atoms** (owner rejected character-level): individual characters, commas, letters, spaces, or structural wrappers.

## Architectural change

### Today

```jsonc
// page_builder_data.content item today
{
  "type": "HeroSection",
  "props": {
    "eyebrow": "Central Oregon",
    "headlineLine1": "Park near",
    "headlineLine2Italic": "the canyon.",
    "subtitle": "<p>Full hookup sites…</p>",
    "backgroundImageUrl": "/images/hero.jpg",
    "ctaPrimaryLabel": "Reserve Your Site",
    "ctaPrimaryUrl": "https://app.fireflyreservations.com/..."
  }
}
```

Click Hero in the editor → right panel shows all 7 fields in one form. No way to click just the headline.

### Target

```jsonc
{
  "type": "HeroSection",
  "props": { "id": "hero-1", "backgroundImageUrl": "/images/hero.jpg", "overlay": "dark" },
  "zones": {
    "hero-content": [
      { "type": "EditableEyebrow", "props": { "id": "…", "text": "Central Oregon" } },
      { "type": "EditableHeading", "props": { "id": "…", "level": 1, "text": "Park near" } },
      { "type": "EditableHeading", "props": { "id": "…", "level": 1, "italic": true, "text": "the canyon." } },
      { "type": "EditableRichText", "props": { "id": "…", "html": "<p>Full hookup sites…</p>" } },
      { "type": "EditableButton", "props": { "id": "…", "label": "Reserve Your Site", "url": "https://app.fireflyreservations.com/...", "variant": "primary" } }
    ]
  }
}
```

Click the headline → right panel shows only headline fields (text, level, italic). Click the button → only button fields (label, url, variant).

## Repo state at handoff

- **Repo:** `C:\dev\CRR-RV-Park-Website\` → https://github.com/CRRrvPark/CRR-RV-Park-Website
- **Default branch:** `main`
- **Most recent commits (at handoff):** `46fc9de` (dashboard analytics), `799e834` (Puck id fix), `d8155bf` (V3.1 import).
- **Netlify:** linked to repo; pushes to `main` auto-deploy.
- **`.env`:** lives at `C:\dev\CRR-RV-Park-Website\.env` (git-ignored, not committed).

## Files the next thread will touch

### New files to create

- `src/components/react/puck-components/atoms/` — new folder:
  - `EditableHeading.tsx`
  - `EditableRichText.tsx`
  - `EditableEyebrow.tsx`
  - `EditableButton.tsx`
  - `EditableImage.tsx`
  - `EditableIcon.tsx`
  - `EditableSpacer.tsx`
  - `EditableDivider.tsx`
  - `EditableLine.tsx`
  - `EditableBadge.tsx`
  - `EditableListItem.tsx`
  - `EditableContainer.tsx` — layout helper
- `scripts/migrate-sections-to-atoms.mjs` — one-shot data transformer per section type
- `docs/V4-ATOM-CATALOG.md` (optional) — keep the atom list + field definitions documented

### Existing files to refactor

- `src/components/react/puck-components/sections.tsx` — every section becomes a layout shell with `<DropZone>` regions. Flat props (`headline`, `subtitle`, …) disappear; they become child atoms in zones.
- `src/components/react/puck-components/index.ts` — register atoms in `PUCK_SECTIONS`. Update `withStyle()` HOC to handle atoms correctly (styles shouldn't double-apply when nested).
- `src/lib/puck-config.tsx` — categorize atoms, register them alongside sections, update the palette structure.
- `src/components/sections/PuckRenderer.astro` — walk nested zones on the public site. Emit byte-identical HTML to the current output.
- `src/lib/puck-data-migrate.ts` — extend to handle legacy-flat-props → nested-zones migration on load (so old saves still open correctly).

### Tests to add (or expand)

- Before/after HTML diff per slug (`index`, `group-sites`, `amenities`, `golf-stays`, `golf-course`, `extended-stays`, `book-now`, `area-guide`). Store pre-rewrite HTML snapshots; diff after the rewrite lands. Any divergence is a bug to fix.
- Data round-trip: open page in editor → save draft → republish → read DB → content matches.

## Execution plan for the next thread

**Session 1: scaffold + first atom + first section**
1. Create `EditableHeading` atom (simplest).
2. Create `EditableRichText` atom (uses existing `richTextField`).
3. Create `EditableButton` atom (uses existing `linkPickerField`).
4. Create `EditableImage` atom (uses existing `MediaPickerField`).
5. Refactor `HeroSection` into a layout shell with a `hero-content` drop zone; allow only the 4 atoms above.
6. Write migration transform for `HeroSection` flat-props → nested zone.
7. Extend `puck-data-migrate.ts` to run this transform on load.
8. Update `PuckRenderer.astro` to render the new Hero zone format and preserve old format (fallback).
9. Seed script: run transform on DB page_builder_data, snapshot before/after, verify HTML identical for all 7 slugs that use Hero.
10. Commit + push.

**Session 2: rest of the atoms + rest of sections (in chunks)**
- Each section's rewrite is 1-2 commits. Keep commits atomic: one atom, or one section + its data migration + its renderer update + its verified HTML diff.

**Session 3: polish + verify**
- Make sure `withStyle()` HOC plays nicely with atoms (the style panel should still work on section shells; atoms should have their own style fields).
- Make sure the canvas-is-live-preview stays intact after zones are nested.
- Update the handoff once the work lands so the owner has a clean state-of-the-art summary.

## Non-goals for V4

- **No new public-site features.** No new pages, no new integrations, no new section types.
- **No new admin routes.** The dashboard, audit log, area-guide, media library, users pages stay as-is.
- **No design changes to the public site.** If the output HTML changes visually for a guest, you've gone off-scope.
- **No GA4.** Owner explicitly said no. Clarity (already wired) is the analytics layer.
- **No RPMS work.** Owner decision: T+6-10 months, not this track.

## Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| Content loss on migration | Before/after DB diff per slug. Commit only after clean diff. Keep legacy-format fallback in the renderer during the transition. |
| Visual drift on public site | HTML snapshot diff per slug (pre vs. post migration). Byte-identical is the bar. |
| Puck can't handle the nesting depth we need | Build a canary: nest 5 levels deep (section → container → card → text → emoji). If Puck breaks, switch to Craft.js — but that's a 2-week fallback plan. Verify canary first. |
| Editor auto-save races during refactor | Feature-flag the new renderer. New zones only render when the page has `use_page_builder_v4: true`. Flip per-slug once verified. |
| Owner hits a half-migrated state mid-session | Each commit is self-contained: either the whole section is migrated (atoms + data + renderer) or none of it. No "atoms built but not wired" commits. |

## Hard requirements carried from V3.1 (do not regress)

1. **Canvas IS the live preview.** Puck's iframe must render with public-site CSS (`/styles/global.css` + Google Fonts). Already wired via `CanvasStyleInjector` in `PageBuilder.tsx`.
2. **Every page editable in the Visual Editor.** No blank canvases. All 8 nav pages (`index`, `golf-stays`, `golf-course`, `group-sites`, `extended-stays`, `amenities`, `book-now`, `area-guide`) must work. Home page (`index`) still uses legacy sections schema — it needs page_builder_data migration as part of this work.
3. **`.env` never committed.** `.gitignore` blocks it, scan before every `git add .`.
4. **Claude owns git.** Owner never runs git commands. Auto-commit + push on each logical chunk.
5. **Netlify secret scanner must remain satisfied.** `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` lists the public identifiers; don't disable scanning.

## First-message template for the V4 thread

> "Read HANDOFF-V4-EDITOR-REBUILD.md. The plan is there. Start Session 1 step 1: create EditableHeading atom. Commit + push each logical chunk. No exploratory work — just execute. Ping me at the end of each session with what landed + what's next."

## Open questions for the owner (answer BEFORE session 2 if possible)

1. Is the HeroSection's "two-line headline with italic second line" pattern something you want preserved as ONE atom (an `EditableHeading` with a `line2Italic` field) or SPLIT into two `EditableHeading` atoms? Splitting is more atomic; keeping combined is how the current hero looks.
2. For card grids — should each card-internal element (icon, name, description) be its own atom inside the card, or should cards stay as compound atoms? Compound cards = fewer clicks; atomic cards = edit the name without touching the icon.
3. Do you want the block-picker UI to group atoms by category (Text / Media / Layout / Interactive) or show them in a flat list?

These are UX polish decisions, not architecture blockers. Session 1 can start without them.

## State of V3.1 at handoff

All V3.1 items shipped:

1. Manual photo upload (Supabase Storage) ✓
2. Canvas = live preview ✓
3. Rich-text link picker ✓
4. Field-level link picker (7 URL fields converted) ✓
5. Zoho sync resilience (error classes + last-success stamp) ✓
6. Section-ID field on every block ✓
7. TwoColumn imageLinkUrl field ✓
8. Card-editor UX (9 components moved from JSON textarea → Puck array fields) ✓
9. Per-block style panel on older sections ✓
10. Legacy page migration: 7 static `.astro` pages → `page_builder_data` ✓

Dashboard enhancements also shipped (conversion tracking + alerts + Clarity link).

**Outstanding V3.x item:** home page (`index`) still uses legacy `sections`/`content_blocks` schema. Needs migration to `page_builder_data`. Do this BEFORE V4 rewrite starts, or fold it into V4 Session 1 as the first full-page migration proof.

---

*Good luck, V4 thread. The owner has been patient. Execute cleanly.*
