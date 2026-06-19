# PORT_TO_NEW_COMPUTER.md — RV Park Website

**Purpose:** the complete, step-by-step playbook for resuming work on this project on a different computer (e.g., Mathew's office machine), without losing context, secrets, or behavior.

**Last updated:** 2026-04-23 PT (initial authorship during workspace import).

---

## TL;DR

Everything important is in git **except**: `.env`, the local Claude memory directory, and (optionally) the Downloads helper folders for HEIC→JPG conversion and PDF generation. The charter (`CLAUDE.md`) inlines every iron-forged rule that lives in the memory files, so even if you skip the memory copy, the rules survive.

## What's in git (auto-ported on `git clone`)

- All source code (`src/`, `public/`, `supabase/migrations/`, `scripts/`).
- All build config (`package.json`, `package-lock.json`, `astro.config.mjs`, `netlify.toml`, `tsconfig.json`, `.gitignore`, `.gitattributes`, `.netlifyignore`).
- All project docs: `README.md`, `RUNBOOK.md`, `SETUP.md`, `PROJECT-DETAILS.md`, `AREA-GUIDE-SETUP.md`, `NETLIFY-DEPLOY.md`, `CHECKIN.md`, `HANDOFF-V*.md`, `PATCHES-APPLIED.md`, `SECURITY-*.md`, `PEN-TEST-REPORT.md`, `SPEC-PHASE-1.md`.
- **The workspace charter itself** (`CLAUDE.md` at the workspace root) — committed alongside the code, so when this repo is cloned into `C:\Claude Workspace\RV Park Website\` on the new machine, the charter is already there.
- The `_Archive\` folder and its existing contents.
- `.env.example` (template with variable names but no values).

## What's NOT in git (must be brought across manually)

### 1. `.env` (REQUIRED) — the only critical not-in-git file

Located at `C:\dev\CRR-RV-Park-Website\.env` on the current machine. Contains:
- Supabase: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Netlify: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `NETLIFY_BUILD_HOOK`
- Zoho OAuth: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REDIRECT_URI`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_DOMAIN`
- Zoho resource IDs: `ZOHO_WORKDRIVE_MEDIA_FOLDER_ID`, `ZOHO_CALENDAR_PUBLIC_EVENTS_ID`
- Site: `SITE_URL`, `ADMIN_EMAIL_FROM`
- `SCHEDULED_FN_SECRET`
- Google: `GOOGLE_PLACES_API_KEY`

**Transfer it via your password manager** (1Password / Bitwarden secure note), or copy via an encrypted file. Don't email it.

**The same values are also already in the Netlify environment-variables dashboard** for the live site — so even if you lose `.env` on the local machine, prod is fine. Local dev is the only thing that breaks without it.

### 2. Claude memory directory (RECOMMENDED — preserves auto-load behavior)

Located at: `C:\Users\mathe\.claude\projects\C--dev-CRR-RV-Park-Website\memory\`

Contains:
- `MEMORY.md` — index file the harness loads automatically.
- `workflow_claude_owns_git.md` — encodes the "Claude owns git on this project" rule.
- `project_v4_editor_rebuild.md` — V4 editor initiative pointer.
- `feedback_maps_curation_conservative.md` — content-backfill scoping rule.
- `feedback_image_quality_bar.md` — image-selection quality rules.

**Why bring it across:** Claude Code loads these automatically into a session's system context. The charter inlines the same rules (§4 Iron-forged), so you can skip this and the rules still apply — but the auto-load is convenient.

**Key path translation when copying:** the directory key derives from the working directory's path (`C:\dev\CRR-RV-Park-Website` → `C--dev-CRR-RV-Park-Website`). On the new machine, where the working dir will be `C:\Claude Workspace\RV Park Website`, the equivalent key is `C--Claude Workspace-RV Park Website`. So copy memory files to:

```
C:\Users\<office_username>\.claude\projects\C--Claude Workspace-RV Park Website\memory\
```

(Create the directory if it doesn't exist; copy all 5 files from the old machine.)

### 3. (Optional) HEIC→JPG conversion + PDF helpers

Located at `C:\Users\mathe\Downloads\heic-thumbs\`:
- `heic_to_jpg_for_upload.py` — converts site-photo HEICs to web-ready JPGs.
- `make_events_pdf.py` — generates the Central Oregon Events PDF.

These are utility scripts, not project code. Not strictly required — they can be regenerated from this charter / past commits if needed. If you regularly upload HEICs from your phone for site photos, bring them across.

---

## Setup steps on the new computer

1. **Install prerequisites.**
   - Node 20 (`nvm install 20` if using nvm-windows; or download from nodejs.org).
   - Git for Windows.
   - Optional but useful: Python 3 with `pillow`, `pillow-heif`, and `reportlab` for the helper scripts.

2. **Create the workspace folder structure** (mirror what's on the current machine):
   ```
   C:\Claude Workspace\
   ├── CLAUDE.md          ← master charter (copy from old machine OR re-author from scratch)
   ├── FILE_LOG.md        ← generated master log
   ├── _root_FILE_LOG.md  ← root scoped log
   ├── build_file_log.py  ← root tool
   ├── split_charter.py   ← root tool
   └── _Charter_Grok\     ← root charter Grok split
   ```
   Copy these from `C:\Claude Workspace\` on the old machine. They're not in git anywhere — they're workspace-level files.

3. **Clone the website repo into the workspace:**
   ```cmd
   cd "C:\Claude Workspace"
   git clone https://github.com/CRRrvPark/CRR-RV-Park-Website.git "RV Park Website"
   cd "RV Park Website"
   ```

4. **Drop `.env` into the project root** (from your password manager).

5. **Install dependencies + verify:**
   ```cmd
   npm ci          # uses package-lock.json for exact reproduction
   npm run dev     # confirms it builds + serves at http://localhost:4321
   ```

6. **(Optional) Copy memory directory** to `C:\Users\<office_username>\.claude\projects\C--Claude Workspace-RV Park Website\memory\` (see §2 above for path translation).

7. **(Optional) Copy Downloads helpers** if you regularly use them.

8. **Verify by running a non-destructive script:**
   ```cmd
   node scripts/supabase-migrate.mjs   # list migrations (should show 017+ already applied)
   ```

## After-port checklist

- [ ] `npm run dev` serves at `http://localhost:4321` with no errors.
- [ ] Admin login at `http://localhost:4321/admin` works (uses the Supabase auth from `.env`).
- [ ] At least one DB-touching script runs cleanly (e.g., `node -e "fetch(env.PUBLIC_SUPABASE_URL+'/rest/v1/park_sites?select=site_number&limit=1', {headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY}})…"`).
- [ ] `git status` shows a clean tree.
- [ ] `git log --oneline -5` shows the same recent commits as on the old machine (last known: `795e33e Site descriptions: accuracy pass`).
- [ ] Claude Code (the new computer's session) auto-loads memory **OR** the charter's §4 Iron-forged rules are visibly being respected (claude-owns-git, conservative curation, image-quality bar).

## When the old machine is no longer the "current" one

The current local clone at `C:\dev\CRR-RV-Park-Website\` is **not deleted** (per the master charter's *Never delete files* rule). Options:
- Leave it in place as a backup; it'll just go stale relative to the new machine's clone.
- Eventually archive it: move to `C:\Claude Workspace\_Archive\CRR-RV-Park-Website_dev_2026-04-23\` and log in `_root_FILE_LOG.md`. Wait until the new clone has been working cleanly for a week before doing this.

## Recovery scenarios

**"I cloned but `npm run dev` errors out."** Most likely missing `.env`. Look at `.env.example` to see what's expected.

**"I cloned, set up `.env`, but admin login fails."** Supabase auth uses the same Supabase project regardless of computer; if login fails, the issue is the `.env` Supabase URL/keys are stale or wrong, not the new machine.

**"Memory rules aren't being followed."** Either (a) you skipped copying the memory dir AND the new session hasn't read this CLAUDE.md, or (b) the charter is being read but the agent is drifting — call it out, the rules are in §4 of the charter.

**"I made changes on the new machine; how do I sync back?"** They go to the same git remote. `git push` from new machine → `git pull` from old machine. The two clones now share history. (Same as any other multi-computer dev setup.)

---

*Maintain this doc alongside the charter when something changes about the dev environment or what's in `.env` — same living-doc rule the master charter spells out.*
