# Handoff — Admin rebuild session, April 15 2026

> Previous session ended mid-login debug. This session rebuilt the whole admin
> UI from the ground up and fixed the root-cause behind the Netlify login
> failure. Everything below is what shipped.

---

## Root cause of the Netlify login failure

**`astro.config.mjs` had `output: 'static'`.**

With static output, Astro prerenders every route to HTML at build time and
**silently drops the API routes**. The admin login page calls `/api/auth/*`
and Supabase's browser client, which works locally (because `astro dev`
serves everything dynamically) but blows up on Netlify (no functions, no
env-var hydration beyond build time).

### Fix applied

1. `astro.config.mjs` — changed to `output: 'server'` with the Netlify
   adapter. Every API route in `src/pages/api/**/*.ts` already had
   `export const prerender = false;` so they now deploy as Netlify Functions.
2. `netlify.toml` — removed stale `format: 'file'` assumptions, updated CSP
   to include `wss://*.supabase.co` for realtime, added `Permissions-Policy`
   refinements, and switched the pretty-URL redirects from `200`
   rewrites-to-html to `301` redirects-from-html (server output no longer
   emits `.html` files).
3. `NETLIFY-DEPLOY.md` — step-by-step guide for setting env vars in the
   Netlify dashboard, including the troubleshooting decision tree.

**Why local worked but Netlify didn't:** Matt's `.env` is only on his
machine; Netlify needs the same vars set in its own dashboard under
*Site configuration → Environment variables*. The deploy guide walks
through every variable needed.

### Action Matt must take before the next deploy

1. Apply the code changes (already committed — nothing to do).
2. In the Netlify dashboard: Site configuration → Environment variables, add
   every variable listed in `NETLIFY-DEPLOY.md`. Copy the values from local
   `.env`.
3. Trigger a fresh deploy. Visit `/admin/login` and verify:
   - The form renders (not blank).
   - DevTools console shows no `PUBLIC_SUPABASE_URL is not set` error.
   - Signing in redirects to `/admin` and shows the new dashboard.

---

## Admin UI rebuild — what changed

Entire admin area was rewritten around a shared design system.

### New: design system (`public/styles/admin.css`)

~500 lines of CSS custom properties + component classes. Everything the
admin uses is tokenised (colors, spacing, radii, shadows, typography).
Changing the brand in one place propagates everywhere.

### New: UI primitives (`src/components/react/ui/`)

- `Icon.tsx` — tree-shakable inline SVG icon set (~30 icons)
- `Button.tsx` — variants: primary / secondary / ghost / danger + sizes +
  loading state
- `Field.tsx` — `TextInput`, `TextArea`, `Select`, `Field` wrapper (label,
  hint, error all baked in)
- `Card.tsx` — `Card`, `CardHeader`, `StatCard`
- `Modal.tsx` — `Modal`, `ConfirmModal` with keyboard handling + backdrop
- `EmptyState.tsx` — reusable empty-state with icon + title + body + action

### Rebuilt: admin shell

`src/layouts/AdminBase.astro` now mounts a React `AdminShell` island that
provides:

- Sidebar with icon navigation, grouped into "Content" and "Manage",
  role-filtered (links you can't use are hidden)
- Topbar with page title, Cmd+K search trigger, and a "View live site"
  button
- Mobile hamburger + slide-out drawer
- Sticky session pill with sign-out + role badge
- **Command Palette (⌘K / Ctrl+K)** — fuzzy-search jump to any page
- **Help Panel (?)** — "How do I…" task recipes, keyboard shortcuts,
  runbook links, email escalation

### Rebuilt: every admin screen

| Screen | New features |
|---|---|
| **Login** | Split-screen marketing + form. Env-var diagnostic banner if Supabase isn't configured. Password reset via Supabase's `resetPasswordForEmail`. Show/hide password toggle. Friendlier error messages. |
| **Dashboard** | Hero "Publish" card showing drafts pending. Stat cards. System health with real timestamps from the new `/api/sync/status` endpoint. Recent activity feed with avatars. Quick-link cards to each section. Welcome tour that dismisses to localStorage. |
| **Pages** | Search + filter tabs (all/published/drafts). Per-page badges (Live, Draft, In Nav, Protected). Icon toolbar per row. Modal for settings with hints on every field. |
| **Page editor** | Sticky action bar with Preview + Publish. Add-section dropzones between every section. Drag-grip, up/down, hide, delete per section. Loading + empty states. |
| **Media Library** | Grid with hover-reveal details. Upload instructions tied to Zoho Drive sync. Large preview modal with alt-text editor, copy-URL pills per variant. |
| **Events** | Month-grouped list. Per-event publish toggle (custom toggle switch). Date badge. Sync status banner. |
| **Users** | Role cheat-sheet. Invite modal with role hint. Avatar initials. Inline role-change dropdown. Activate/deactivate and remove buttons. Owner-minimum-2 warning banner. |
| **Change Log** | Filter by action type or user email. Click-to-expand diff viewer. Action badges. |
| **Versions** | Human-friendly reason labels ("Auto: before publish" not `pre_publish`). Inline info card explaining restore safety. |
| **Settings** | Zoho connection status card. Per-service sync cards with "Sync now". Site config key-value list. "Further reading" card. |
| **Runbook** | Warning banner about preserving for successors. Print / PDF button. Source indicator (database vs bundled). Clean textarea editor. |
| **Code Editor** | Monaco with dark theme. File tree sidebar with draft indicators. Required "I understand the risks" gate kept but restyled. |

### New backend endpoints

- `/api/sync/status` — surfaces the most recent run per scheduled service
  (zoho_drive, zoho_calendar, snapshots_prune) plus pending-drafts count.
  Referenced by the Dashboard's System Health card.

### What stayed the same on purpose

- **Zoho data flow** — photos and events are still edited in Zoho, pulled
  here on schedule. Direct upload to WorkDrive via API isn't wired (the
  Zoho SDK calls get complex, and the existing flow is what Matt's admins
  expect). MediaAdmin clearly tells users how to add photos: drop in the
  Zoho folder.
- **RBAC** — `src/lib/rbac.ts` capability matrix unchanged.
- **Migrations** — no DB schema changes.
- **Section Library** — `section-types.ts` unchanged; SectionTypePicker
  just got a visual refresh.

### What remains open

1. **Verify login end-to-end on Netlify** after env vars are set.
2. **Scheduled functions** (netlify.toml has `[functions."zoho-drive-sync"]` and friends) — these assume the Astro SSR wraps each API route in a discoverable-by-name function. If scheduled triggers don't fire, we'd need dedicated Netlify Function wrappers. Not urgent if syncs also run via pg_cron (migration 000 enables it).
3. **Direct photo upload** — currently points users to Zoho. If you want
   true in-browser upload, add a Supabase Storage bucket + `/api/media`
   multipart handler.
4. **EditableText/RichText/Image** — still use the original inline-styled
   brand colors (same palette). Not broken, but not on the design system.
   Low-priority restyling.

---

## Quick sanity check after deploying

Visit `/admin/login` on the deployed Netlify URL:

1. Page renders with split-screen (form on right, brand panel on left on desktop)
2. **Browser console is clean** — no `[supabase]` warnings
3. Sign in → redirects to `/admin` → sidebar + dashboard visible
4. Press `⌘K` → palette opens
5. Press `?` → help panel opens
6. Click "Publish changes" on dashboard → confirm → "Publish started" toast
7. Navigate to Pages → click Home → editor loads with sections

If any of steps 1–3 fail, it's an env-var issue (see `NETLIFY-DEPLOY.md`).
If steps 4–7 fail, the code is broken (open an issue).

---

## File map for quick orientation

```
src/
  layouts/
    AdminBase.astro            ← shell wrapper, imports AdminShell
    Base.astro                 ← public site wrapper (unchanged)
  pages/
    admin/
      login.astro              ← two-column login page
      index.astro              ← Dashboard mount
      editor/
        index.astro            ← Pages list
        [slug].astro           ← Page editor
      {media,events,users,
       versions,audit,settings,
       runbook,code}.astro     ← thin wrappers, all use AdminBase
    api/
      sync/status.ts           ← NEW — drives Dashboard health
      … all other endpoints untouched
  components/
    react/
      AdminShell.tsx           ← NEW — sidebar + topbar + palette + help
      CommandPalette.tsx       ← NEW — ⌘K launcher
      HelpPanel.tsx            ← NEW — docked help drawer
      ui/
        index.ts               ← NEW — barrel export
        Icon.tsx, Button.tsx,
        Field.tsx, Card.tsx,
        Modal.tsx, EmptyState.tsx
      Dashboard.tsx            ← rewritten
      LoginForm.tsx            ← rewritten
      Toast.tsx, ConfirmDialog.tsx,
      Spinner.tsx              ← rewritten on top of design system
      AuthGuard.tsx            ← cleaner
      PagesAdmin.tsx           ← rewritten
      PageEditor.tsx           ← rewritten
      MediaAdmin.tsx, EventsAdmin.tsx,
      UsersAdmin.tsx, AuditLog.tsx,
      Versions.tsx, Settings.tsx,
      RunbookEditor.tsx, CodeEditor.tsx
                               ← all rewritten
      SectionTypePicker.tsx    ← restyled
      editors/
        EditableText.tsx       ← unchanged (works with new system)
        EditableRichText.tsx   ← unchanged
        EditableImage.tsx      ← unchanged
        EditableJson.tsx       ← unchanged
public/
  styles/
    admin.css                  ← NEW — full design system
    global.css                 ← unchanged (public site)

astro.config.mjs               ← FIXED — output: 'server'
netlify.toml                   ← FIXED — CSP, redirects, functions
NETLIFY-DEPLOY.md              ← NEW — step-by-step deploy guide
```

---

Good luck. Test on a deploy-preview first; main only after the preview works.
