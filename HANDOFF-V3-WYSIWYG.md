# Handoff V3 — WYSIWYG upgrade + public events calendar

> **Supersedes:** [HANDOFF-V2-AREA-GUIDE.md](HANDOFF-V2-AREA-GUIDE.md) (kept as historical reference for the V2 area-guide cut)
>
> **Date tagged:** 2026-04-18
> **Scope:** everything shipped in the 2026-04-18 session — public events calendar with date-range filter, WYSIWYG milestones M1–M5.
> **Live URL:** https://www.crookedriverranchrv.com (unchanged)

---

## TL;DR

Between V2 and V3 the site gained:

1. **Public events calendar** — `/events` is now linked from the Area Guide dropdown, added to `sitemap.xml`, expands recurring events via `rrule.js`, and has a client-side date-range filter (chips + From/To pickers).
2. **WYSIWYG upgrade, owner-approved Path A** (enhanced block-based, not pixel-freeform Wix):
   - **M1** — Tiptap-based `RichTextEditor` component with full toolbar (fonts, colors, font-family, font-size, alignment, headings, lists, quotes, emoji, case transforms, clear formatting); wired into `AreaGuideAdmin` description fields.
   - **M2** — Replaced Puck's default `richtext` field on every block with the same Tiptap editor — **10 fields across 9 Puck blocks**.
   - **M3** — Added a reusable 11-field per-block style panel (margin / padding / bg / text color / border + radius / shadow) and 4 new blocks: `ShapeBlock`, `LineBlock`, `BackgroundImageBlock`, `FreeformContainerBlock`. All 4 have matching Astro renderers in `PuckRenderer.astro` so they render correctly on published pages. Sanitizer extended to walk `data.zones[*]` for nested container children.
   - **M4** — New `/admin/preview/[slug]` route renders drafts with the **real public-site layout** (Base + nav + footer + CSS). New "Live preview" side pane in the builder: iframe pointing at that route, postMessage refresh after every auto-save. Canvas-side editing; real-site preview side-by-side.
   - **M5** — Auth-gated the preview route, deleted demo routes/harnesses, fixed Vite dep pre-optimization for Tiptap extensions, this handoff doc.

Nothing V2 did was broken. Additive.

---

## What's live (V3)

| Area | State | Notes |
|---|---|---|
| All V1 + V2 functionality | ✅ | unchanged |
| `/events` public calendar | ✅ (new) | Nav + sitemap + date-range filter + rrule expansion |
| Tiptap in Area Guide descriptions | ✅ (new) | trails, things-to-do, local places |
| Tiptap in Puck blocks | ✅ (new) | `TextBlock.body`, `HeroSection.subtitle`, `TwoColumnSection.body`, `ExploreGridSection.intro`, `SiteCardsSection.intro`, `CtaBannerSection.body`, `ReserveFormSection.body`, `InterludeSection.headline` + `body` |
| Per-block style panel | ✅ (new) | `TextBlock` + every new block (M3b–e); existing Hero/TwoCol/etc. **not** yet wrapped — see "Deferred" |
| `ShapeBlock` | ✅ (new) | 5 shapes (rect / rounded / pill / circle / triangle), fill, stroke, size, alignment |
| `LineBlock` | ✅ (new) | horizontal + vertical, 5 line styles, thickness, color, length as % or px |
| `BackgroundImageBlock` | ✅ (new) | image + overlay + rich text over image + parallax attachment |
| `FreeformContainerBlock` | ✅ (new) | nested Puck DropZone; children render on public pages via `renderChildBlock()` helper |
| Live preview side pane in builder | ✅ (new) | `/admin/preview/[slug]` rendered in an iframe; auto-refresh on auto-save |
| Published-site Puck renderer parity | ✅ (new) | All 4 new block types have matching Astro renders in `PuckRenderer.astro` |

---

## New files

```
src/
├── components/react/
│   ├── editors/
│   │   └── RichTextEditor.tsx                 ← NEW — controlled Tiptap rich-text editor
│   └── puck-components/fields/
│       └── RichTextField.tsx                  ← NEW — Puck custom-field adapter for Tiptap
│
├── lib/
│   ├── puck-style.ts                          ← NEW — reusable per-block style fields + computeStyle()
│   └── puck-render-helpers.ts                 ← NEW — pushStyleProps + renderChildBlock for Astro renderer
│
└── pages/admin/preview/
    └── [slug].astro                           ← NEW — live-draft preview route (auth-gated)
```

## Modified files

```
src/
├── components/
│   ├── Nav.astro                              ← UPDATED — added Events link under Area Guide dropdown
│   ├── sections/PuckRenderer.astro            ← UPDATED — 4 new block renders + pageBuilderData prop
│   └── react/
│       ├── AreaGuideAdmin.tsx                 ← UPDATED — RichTextEditor replaces description textareas
│       └── PageBuilder.tsx                    ← UPDATED — Live preview button + iframe side pane + postMessage
│
├── lib/
│   ├── puck-config.tsx                        ← UPDATED — 4 new blocks; TextBlock has style panel; richTextField helper
│   ├── puck-sanitize.ts                       ← UPDATED — new blocks registered; sanitizer walks zones
│   └── (existing libs unchanged)
│
├── pages/events.astro                         ← UPDATED — rrule expansion + date-range filter + chips
└── (public pages unchanged)

public/sitemap.xml                             ← UPDATED — added /events entry
astro.config.mjs                               ← UPDATED — optimizeDeps.include for Tiptap extensions + rrule
package.json                                   ← UPDATED — added rrule and 6 @tiptap/extension-* packages
```

---

## New dependencies

| Package | Why |
|---|---|
| `rrule@^2.8` | Expands recurring events in the `events` table into individual occurrences at build time |
| `@tiptap/extension-underline` | Underline mark (StarterKit doesn't include it) |
| `@tiptap/extension-text-style` | Backbone for color / font-family / font-size marks |
| `@tiptap/extension-color` | Text color mark |
| `@tiptap/extension-text-align` | Left / center / right alignment |
| `@tiptap/extension-font-family` | Font-family mark |
| `@tiptap/extension-highlight` | Highlight mark with per-colour support |

No schema changes. The existing `page_drafts` / `page_builder_data` JSONB columns carry the new block types verbatim.

---

## Usage

### Public events calendar
Nothing for the owner to do beyond confirming the Zoho Calendar sync is wired up. Recurring events (weekly / monthly / etc.) now appear on every occurrence instead of only their anchor date.

### Rich text editor (Tiptap)
Everywhere a body / subtitle / intro field used to be a textarea, it's now a rich-text box with a full toolbar. Fonts, colors, font sizes, headings, lists, quotes, emoji, alignment, case transforms, clear formatting. Hit the `↻` button in the live-preview pane to force a refresh if it looks stale.

### New Puck blocks
In the builder's Blocks palette you'll now see **Shape**, **Line**, **Background Image**, and **Container (drop blocks inside)** in addition to everything V2 shipped. Drag them in, edit in the field panel on the right. The Container supports dragging other blocks inside it.

### Live preview side pane
In the builder at `/admin/builder/{slug}`, click the new **"Live preview"** button in the top toolbar. A 50%-width iframe opens on the right showing your current draft rendered with the real public-site layout. Auto-refreshes ~2 seconds after each edit. Click again to hide. The old "Preview" button was renamed **"Published"** — it still opens the live-published page in a new tab.

---

## 🔴 Backburnered / deferred

### Inherited from V2 (unchanged priorities)

1. **[SECURITY-PLAN.md](SECURITY-PLAN.md) Sessions N → N+8** — entire security foundation. R&PMS still blocked on this. See V2 handoff for details. This is the natural next track when content + WYSIWYG iteration slows.
2. Content population (60 activities, 109 park sites, trail verification, real Google `place_id`s, park-map image) — admin-only, no Claude needed.
3. Firefly per-site deep-link — **confirmed as NOT supported by Firefly** during this session. Generic deep-link stays. Remove from deferred list.
4. Secret rotation: `GOOGLE_MAPS_SERVER_KEY`, old `crr-rv-park-platform/.env` cleanup.
5. Zoho WorkDrive duplicate-file cleanup.
6. Cyber insurance + operational security ([SECURITY-ANCILLARY-NOTES.md](SECURITY-ANCILLARY-NOTES.md)).

### New in V3

7. **Per-block style panel on the older sections** — M3a wrapped only `TextBlock` and the 4 new blocks. `HeroSection`, `TwoColumnSection`, `CardGridSection`, `SiteCardsSection`, `ExploreGridSection`, `ReviewsSection`, `CtaBannerSection`, `EventsWidgetSection`, `ReserveFormSection`, `RatesTableSection`, `FeatureListSection`, `AmenityGridSection`, `InterludeSection`, `TrustBarSection` still have their hardcoded padding / background. Adding `...styleFields` to each + `computeStyle(props)` in each `render` — mechanical ~1-2 hr task. Low urgency; these sections already look good, the panel is nice-to-have.

### Surfaced from first-use (2026-04-18, post-deploy)

8. **Section-anchor support across every block** — currently `#some-section` links only land on targets with an `id` attribute, and only `ReserveFormSection` hardcodes `id="reserve"`. Proposal: add an optional "Section ID" / "Anchor name" text field to every block so editors can set `id="..."` per-section and make in-page anchor links work anywhere. ~15 min task. Workaround today: drop an `HtmlEmbed` block containing `<span id="anchor-name"></span>`.

9. **`imageLinkUrl` field missing on TwoColumnSection** — the public renderer already wraps `<img>` in `<a href={p.imageLinkUrl}>` when set, but there's no UI field for it in `src/components/react/puck-components/sections.tsx`. Editors can't make the two-column image clickable without hand-editing JSON. Trivial fix: mirror the pattern from `ImageBlock.linkUrl`. ~5 min task.

10. **Editing cards / images inside a section is discoverable only if you already know** — owner reported (2026-04-18) that they couldn't figure out how to edit or replace the cards/images that appear inside `CardGridSection`, `SiteCardsSection`, `ExploreGridSection`, `AmenityGridSection`, and the image slot on `TwoColumnSection`. Root cause: these sections store their cards as a JSON array in a single `textarea` field. Selecting the section shows a giant JSON blob, which is hostile to non-technical editors. Fix direction (significant UX work, NOT deploy-blocking, NOT quick):
    - Replace the raw JSON textarea with a per-card "items" editor: add/remove/reorder cards via buttons, each card's fields (image, title, desc, href, imageWidth, imageHeight) as separate inputs instead of JSON keys.
    - Hook the image field to `MediaPickerField` (the existing media-library browser) so image replacement is a click, not a URL paste.
    - Could be staged: do it for `CardGridSection` + `SiteCardsSection` first (most common), then the rest.
    - Rough estimate: ~1 day per section type to build a clean item-editor, ~3-4 days for all five affected sections.
    - Until that lands: the card data lives in the "Cards (JSON: ...)" textarea. The label string documents the shape. To edit a card's image, change the `"image"` value in that JSON. To make it clickable, add `"href": "/target"`. To resize, add `"imageWidth": 400, "imageHeight": 300`. This is a workaround, not a solution — the UX fix above is what's needed.
8. **Nested-child support for complex Puck sections inside `FreeformContainerBlock`** — `renderChildBlock` in `puck-render-helpers.ts` currently supports `TextBlock`, `Spacer`, `Divider`, `ShapeBlock`, `LineBlock`, and `ImageBlock`. Dropping a `HeroSection` or `TwoColumnSection` inside a container renders a "not yet supported as a nested child on public pages" placeholder. Will need selective expansion of the helper when a real use case shows up.
9. **Live-preview granularity** — currently the preview iframe does a full reload on every auto-save. That's ~200ms and works, but loses scroll position. M4b could be refined to diff the Puck tree and swap just the changed block (react-error-boundary + React portal ported into the iframe). Non-urgent, but a future polish.
10. **Pixel-freeform layout** — deliberately NOT implemented (Path A). If the owner decides later that they want pixel-absolute block positioning for hero / splash pages, a new `CanvasBlock` is a future addition — similar scope to `FreeformContainerBlock` but with absolute positioning and per-breakpoint layout.

---

## Open actions on the user

Same as V2 + two new ones:

1. Deploy V3 via `git push`. No migrations needed (no schema changes).
2. Confirm Netlify env vars are unchanged from V2.
3. Smoke-test after deploy (see next section).
4. **NEW** — open `/admin/builder/{anyslug}`, click **Live preview**, confirm the iframe loads + auto-refreshes on edit.
5. **NEW** — open `/admin/area-guide`, edit a trail / activity / place description, confirm the new toolbar appears and the saved content renders correctly on the public `/trails/{slug}` etc. pages.

---

## Smoke-test after deploy

In addition to the V2 smoke-test list:

- `/events` shows published events; if you have recurring events, they appear on every occurrence in the range; chips filter correctly.
- Nav dropdown under Area Guide shows the Events link.
- `/admin/builder/home` — the old "Preview" button has been renamed **"Published"** (same behaviour), new **"Live preview"** button opens the side pane.
- Live preview pane — iframe loads `/admin/preview/home`, auto-refreshes ~2s after any field edit.
- In the builder field palette: Shape, Line, Background Image, Container (drop blocks inside) all appear and drag in.
- Selecting any block shows the style panel fields (bg, padding, border, radius, shadow) in the right pane.
- `/admin/preview/{slug}` — visiting directly while signed out redirects to `/admin/login?next=...`.

---

## When things break (V3 additions)

| Symptom | Likely cause | Fix |
|---|---|---|
| "Failed to fetch dynamically imported module" on the builder or RTE surfaces | Vite dep pre-optimization missing a package after a new Tiptap extension is added | Add the package to `optimizeDeps.include` in `astro.config.mjs`, delete `node_modules/.vite`, restart dev |
| Preview pane stuck on "No draft yet" | No draft row in `page_drafts` for that page_id yet | Open the builder, make a tiny edit, wait for auto-save — the draft gets written and preview starts rendering |
| Live preview iframe doesn't refresh after editing | postMessage dropped / iframe not fully loaded yet | Click the ↻ button in the pane header; if still nothing, check that `/admin/preview/{slug}` returns 200 server-side |
| Public page renders "[X is not yet supported as a nested child on public pages]" | A Hero / TwoColumn / CardGrid etc. was dropped inside a FreeformContainer | Either expand `renderChildBlock` in `puck-render-helpers.ts` to support that block type, or move the complex section outside the container |
| Events recurring every day when they should be weekly | Zoho returned malformed RRULE | Verify the Zoho event's recurrence rule; the `events.astro` catch falls back to single-instance rendering if the rule is malformed |

---

## Post-deploy fixes (2026-04-18 evening)

Shipped to DEV after the DEPLOYED-2026-04-18 snapshot was cut. Small, worth pulling into the next deploy:

- **Nav gradient fade** — `public/styles/global.css` §NAV now adds `nav#mainNav::before` with a dark-to-transparent gradient (~110px tall) that sits behind the nav on every page. Fixes the "nav text unreadable on non-hero pages" problem (e.g., `/events`, `/trails` list, `/admin/*`). Zero impact on pages that already have a dark hero image — the gradient sits behind both the nav's own solid background (when `.scrolled`) and the hero image.

---

## V3.1 agenda (owner-set 2026-04-18 post-deploy)

Order here is the recommended attack order for the next thread. Items 1 and 2 are the explicit owner priority; 3–6 are the pre-existing V3.1 cleanup list from §Backburnered above.

### 1. Manual photo upload (biggest, most urgent)

**Why now:** owner is done relying on the Zoho WorkDrive sync for photos. The sync just failed with a 504 (Zoho-side gateway timeout), which exposes that our photo pipeline is hostage to a flaky third-party integration. Zoho Calendar sync works fine and stays. WorkDrive sync stays as a secondary path, but manual upload becomes the primary.

**Current state:** `/admin/media` explicitly says *"To upload new photos — drop them in your Zoho WorkDrive media folder."* `POST /api/media` only accepts metadata rows, not file bytes. `MediaPickerModal` has a search + list but no upload affordance.

**Scope (~1–2 working days):**
- **Supabase Storage bucket** (one-time). Create a `media` bucket with RLS policies: read = public (or authenticated), write = authenticated editors only. ~15 min via dashboard or migration.
- **`POST /api/media/upload` endpoint** — accepts `multipart/form-data`, validates (auth via `requireRole('upload_media')`, mime type allow-list, file-size cap ~10 MB), streams to Supabase Storage, runs `generateVariants` from `@lib/images` to produce WebP + thumbnails, inserts a `media` row pointing at the public URL. ~2–3 hrs.
- **Drag/drop zone in `MediaAdmin.tsx`** — file input + drop target, per-file progress, thumbnail preview before upload, multi-file. Update the in-app copy that currently points editors at WorkDrive. ~3–4 hrs.
- **"Upload new" button in `MediaPickerModal`** — same endpoint, returns the new media row's URL, calls `onSelect(url)` to continue the existing flow. Means the Visual Editor also gets direct upload. ~1 hr.
- **Polish** — error messages, rejection states (file too big, wrong type), progress bar, cancel-in-flight. ~1–2 hrs.

**Why this is the right architecture:** decouples content pipeline from a third-party sync. Zoho WorkDrive sync stays as a secondary "sync my phone's photo roll" convenience. Failure modes are now independent.

### 2. Zoho WorkDrive sync resilience (medium, do after manual upload lands)

The 504 we saw was probably transient, but after manual upload is the primary path, Zoho sync failures become annoying rather than blocking. Worth one focused pass to:
- Add pagination to the initial folder-listing call (currently pulls all items in one request — this is the leading candidate for a consistent timeout).
- Log every sync run's outcome to `sync_runs` with a clear error classification (auth / timeout / rate-limit / other).
- Surface the last-known-good sync timestamp in the Media admin header so editors can tell at a glance whether the sync is healthy.
- Optionally: expose a per-folder selector so owners can sync only the folders they care about.

Est: ~1 day.

### 3–6 · Pre-existing V3.1 items (from §Backburnered above)

3. Section-ID field on every block (enables `#anchor` links). ~15 min.
4. `imageLinkUrl` field on TwoColumnSection (the public renderer already supports it; UI field is missing). ~5 min.
5. Card/image-in-section UX overhaul (replace JSON textarea on CardGrid / SiteCards / ExploreGrid / AmenityGrid with a per-card item editor). ~3–4 days for all five, or stage one section at a time.
6. Per-block style panel on the older Puck sections (Hero / TwoCol / etc.). ~1–2 hrs.

### After V3.1

**SECURITY-PLAN.md Session N → N+8** remains the architectural-next priority once V3.1 lands. Session N (crypto primitive + hash-chained audit log, ~3 hrs) is a direct pick-up from the existing spec.

---

## How to start the next thread

> "V3 is live. Read HANDOFF-V3-WYSIWYG.md — the V3.1 agenda is there. Owner's explicit priority is item 1 (manual photo upload via Supabase Storage). Zoho WorkDrive sync stays but stops being the critical path. Start there."

Don't re-litigate the WYSIWYG direction (Path A shipped and approved) or the RPMS integration strategy (Option 3 at T+6–10 months, website-side work deferred — see `memory/strategic_direction_rpms_integration.md`).

---

*V3 tagged 2026-04-18. Post-deploy nav fix applied same day. Next thread picks up V3.1 item 1 — manual photo upload.*
