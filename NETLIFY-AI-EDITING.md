# Editing the Website with Claude Code or Codex in Netlify

## Purpose

Netlify Agent Runners replace the retired in-site WYSIWYG. They let an
authorized operator describe a website change in the Netlify dashboard while
keeping the safety of source control:

```text
prompt
  -> automated branch
  -> source changes
  -> Deploy Preview
  -> file diff
  -> GitHub pull request
  -> reviewed merge
```

This is appropriate for public copy, images, layout, links, SEO metadata, and
new pages. The `/admin` console remains the right place for events, media,
area-guide data, park-map data, users, integrations, and audit.

## One-time team setup

Netlify's current requirements include an AI-enabled team on a credit-based
plan, available credits, an authorized team role, and a GitHub-connected
project for the existing-site workflow.

1. In Netlify, enable AI features for the team.
2. Open the site's Agent Runners area.
3. Connect Claude Code and/or OpenAI Codex.
4. Confirm GitHub access to
   `CRRrvPark/CRR-RV-Park-Website`.
5. Run a harmless documentation-only prompt first.
6. Confirm that Netlify creates a branch, builds a Deploy Preview, and offers a
   GitHub pull request.

Official references:

- [Agent Runners overview](https://docs.netlify.com/build/build-with-ai/agent-runners/overview/)
- [Make changes with Agent Runners](https://docs.netlify.com/build/build-with-ai/agent-runners/make-changes-with-agent-runners/)
- [Prompt examples](https://docs.netlify.com/build/build-with-ai/agent-runners/prompt-examples-for-agent-runners/)
- [Manage AI features](https://docs.netlify.com/build/build-with-ai/manage-ai-for-your-team/manage-ai-features/)
- [Git workflows](https://docs.netlify.com/build/git-workflows/overview/)

## Normal editing workflow

1. Open the Crooked River Ranch RV Park project in Netlify.
2. Start a Claude Code or Codex Agent Runner.
3. Paste a specific prompt using the template below.
4. Let the runner finish its branch and preview.
5. Review:
   - the exact changed files;
   - desktop and mobile preview;
   - navigation and buttons;
   - factual details;
   - availability, maps, forms, and external service handoffs affected by the
     change.
6. Request a correction in the runner if needed.
7. Create the GitHub pull request only when the preview is correct.
8. Merge the pull request to publish.

Never ask the runner to edit `main` directly. Never merge only because the
build passed; the rendered preview and facts still require human review.

## Prompt template

```text
Change requested:
[One exact outcome.]

Page(s):
[Route names, for example /amenities and /park-policies.]

Factual source:
[The confirmed fact, current park document, named image, or existing record.]

Guest outcome:
[What should become easier to understand or do.]

Keep:
- the approved V3 forest/mineral/sea-glass design;
- restrained glass-gradient depth and strong mobile readability;
- affirmative, non-comparative copy;
- the current header, footer, availability, Firefly, maps, analytics, forms,
  and accessibility behavior unless the request explicitly concerns one;
- truthful alternative text and distinct imagery.

Do not:
- reintroduce a WYSIWYG, Puck, Tiptap, or browser code editor;
- invent park facts, prices, policies, distances, reviews, or amenities;
- claim a saltwater pool or a two-pet maximum;
- imply the RV park operates the golf course;
- merge or publish without a Deploy Preview and pull-request review.

Validation:
- run npm run check;
- run npm run build;
- report the changed routes and any assumption that still needs confirmation.
```

## Example prompts

### Change copy

```text
On /amenities, replace the EV paragraph with:
"EV-friendly stays are $15 per night or charge. Bring the appropriate adapter."
Do not change the price anywhere else. Search the active public source for
conflicting EV language, update only verified conflicts, run check/build, and
produce a Deploy Preview.
```

### Replace an image

```text
On /sites, replace the second image in the confidence gallery with the media
asset at [confirmed URL]. Keep the existing crop rhythm, write literal alt text
for what the photo shows, do not reuse the image elsewhere, and verify the
mobile preview.
```

### Add a page

```text
Add a public page at /[slug] using the production V3 layout and shared header,
footer, review, and final-conversion components. Use only the supplied facts.
Add the route to navigation only if requested. Preserve all current systems,
run check/build, and show the full Deploy Preview before creating a PR.
```

## Where common content lives

| Change | Primary source |
|---|---|
| Global navigation/footer | `src/components/site/` |
| Global production styling | `public/styles/production-v3.css` |
| Global interactions | `public/scripts/production-v3.js` |
| Home | `src/pages/index.astro` |
| Sites hub and details | `src/pages/sites/` |
| Park + area | `src/pages/area-guide.astro` |
| Amenities | `src/pages/amenities.astro` |
| Booking/arrival | `src/pages/book-now.astro`, `src/pages/availability.astro` |
| Policies/legal | `src/pages/park-policies.astro`, `privacy.astro`, `terms.astro` |
| Dynamic destination records | `/admin/area-guide` and Supabase |
| Events | Zoho Calendar and `/admin/events` |
| Media | Zoho WorkDrive and `/admin/media` |

## Undo

For an ordinary website edit, revert the merged pull request, review the
revert Deploy Preview, and merge it. For the complete pre-V3 rollback, use
[RESTORE-PRE-V3.md](RESTORE-PRE-V3.md).
