# OFFICE_SETUP_RUNBOOK.md — for the office-computer Claude session

**Audience:** the Claude Code session Mathew starts on his **office computer** the first time he wants to work on this project there.
**Goal:** unbox the transfer package, lay the workspace down, install dependencies, prove the site runs locally. End-to-end, no questions back to Mathew unless something genuinely won't work.

**Companion docs:** `PORT_TO_NEW_COMPUTER.md` in this same folder is the prose version for humans. This file is the action-oriented runbook for Claude.

---

## How Mathew will trigger this

He'll plug in his Z: drive (or the network share is already mounted) at `Z:\RV Park\Matts\RV Park Website - Office Transfer\`, open a Claude Code session at `Z:\RV Park\Matts\RV Park Website - Office Transfer\` (or `C:\Claude Workspace\RV Park Website\` if he's already pre-extracted), and tell me something like *"run the office setup runbook."*

When he does that, execute the steps below **in order**. After each phase, give him a one-line status update — silent execution is not the right pattern when the user is watching a setup take 5–10 minutes.

---

## Phase 0 — Detect where I am

Run these in order; the first one that succeeds is the scenario:

1. Does `C:\Claude Workspace\RV Park Website\CLAUDE.md` already exist and contain "Iron-Forged"? → **Scenario B: already-extracted.** Skip to Phase 4.
2. Does `Z:\RV Park\Matts\RV Park Website - Office Transfer\workspace\RV Park Website\CLAUDE.md` exist? → **Scenario A: fresh-from-Z.** Continue with Phase 1. (Mathew may also open the session directly at `Z:\RV Park\Matts\RV Park Website - Office Transfer\` and read this runbook from there — same scenario, same steps.)
3. Neither? → Tell Mathew the transfer package isn't found at `Z:\RV Park\Matts\RV Park Website - Office Transfer\` and stop. Don't guess.

---

## Phase 1 — Mirror the workspace from Z: to C:

Source: `Z:\RV Park\Matts\RV Park Website - Office Transfer\workspace\`
Destination: `C:\Claude Workspace\`

If `C:\Claude Workspace\` doesn't exist, create it. If it exists and contains other project workspaces (RPMS, Rimrock, etc.), **do not overwrite** them — robocopy only the files we're bringing.

```powershell
robocopy "Z:\RV Park\Matts\RV Park Website - Office Transfer\workspace" "C:\Claude Workspace" /E /COPY:DAT /R:1 /W:1 /XD node_modules dist .netlify /NFL /NDL /NJH /NJS /NP
```

Robocopy exit codes 0–7 = success. 8+ = error (report exact code to Mathew and stop).

---

## Phase 2 — Drop `.env` into the project

Source: `Z:\RV Park\Matts\RV Park Website - Office Transfer\env\.env`
Destination: `C:\Claude Workspace\RV Park Website\.env`

```powershell
Copy-Item "Z:\RV Park\Matts\RV Park Website - Office Transfer\env\.env" "C:\Claude Workspace\RV Park Website\.env" -Force
```

Then verify with `Test-Path` and report file size to Mathew (should be 2–3 KB).

---

## Phase 3 — Copy Claude memory directory (optional but recommended)

The memory dir's path-key depends on the project's working directory. Old machine used `C:\dev\CRR-RV-Park-Website` → key `C--dev-CRR-RV-Park-Website`. Office machine uses `C:\Claude Workspace\RV Park Website` → key `C--Claude Workspace-RV Park Website` (literal spaces in the key).

```powershell
$dest = "$env:USERPROFILE\.claude\projects\C--Claude Workspace-RV Park Website\memory"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item "Z:\RV Park\Matts\RV Park Website - Office Transfer\claude_memory\*" $dest -Recurse -Force
```

Verify 5 files in `$dest`: MEMORY.md + 4 individual memory files.

Note: skipping this step is OK — the project charter (CLAUDE.md §4) inlines the rules these memory files encode, so the behavior survives memory loss. The auto-load is a convenience.

---

## Phase 4 — Install deps + dev-server smoke test

```powershell
Set-Location "C:\Claude Workspace\RV Park Website"
node --version  # confirm v20.x; if not, tell Mathew to install/switch via nvm-windows
npm ci          # uses package-lock.json — exact reproduction
```

Then start the dev server in the background and verify it serves:

```powershell
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd "C:\Claude Workspace\RV Park Website"; npm run dev'
# Wait ~10 seconds for Astro to come up
Start-Sleep -Seconds 12
Invoke-WebRequest http://localhost:4321 -UseBasicParsing -TimeoutSec 5 | Select-Object StatusCode
```

Expected: `StatusCode 200`. If it times out, check `.env` exists (Supabase calls will hang on missing keys) and report which Supabase env var is missing.

---

## Phase 5 — Git sanity check

```powershell
Set-Location "C:\Claude Workspace\RV Park Website"
git status --short
git log --oneline -5
```

Expected:
- Clean working tree (`.env` shows nothing because it's gitignored).
- Most recent commit on top of `git log -5` should be commit `8820ff4` ("Workspace charter, port playbook, and FILE_LOG…") OR something newer if Mathew has been pushing from another machine.

If the working tree has uncommitted changes after the import, those came from the transfer package being out of sync with the latest remote — pull and resolve:

```powershell
git fetch origin
git pull --rebase origin main
```

---

## Phase 6 — Report back

Once Phases 1–5 are all green, tell Mathew (one-message summary):

- ✓ Workspace mirrored to `C:\Claude Workspace\`
- ✓ `.env` in place ({N} KB)
- ✓ Memory dir copied (or skipped — call it out)
- ✓ Node {version}, `npm ci` clean, `npm run dev` serving 200 on :4321
- ✓ Git clean, on commit `{hash}` ({message})
- ⚠ Any open follow-ups (e.g. memory dir skipped, Maps Static API key restrictions need re-verification on the office machine if he wants to run the static-maps endpoint, etc.)

Then ask him what he wants to work on first.

---

## What NOT to do

- **Don't `git clone` fresh** when a perfectly good clone with full history was just shipped on Z:. The Z: clone has the right `.git` already — using it preserves any pushes made from the old machine since the package was built.
- **Don't `git push` from the office machine until you've pulled** — the two clones (work + office) share a remote; the office one may be behind by however many commits the work machine pushed after the package was built.
- **Don't reinstall via `npm install` (no lock-respecting).** Use `npm ci` so it matches `package-lock.json` exactly.
- **Don't propose changes to the master `C:\Claude Workspace\CLAUDE.md` from this session** unless Mathew asks. The master charter is the cross-workspace canon; copying it across is enough — *editing* it from the office should only happen when adding office-specific stuff that he explicitly wants in the shared canon.
- **Don't delete `Z:\RV Park\Matts\` after copy** — it's the backup. Mathew can decide when (and whether) to remove it.

---

## If the transfer package is missing pieces

The transfer package is built by the work-machine Claude script `build_office_transfer.ps1` (lives at `C:\Claude Workspace\RV Park Website\scripts\build_office_transfer.ps1` if the work-machine Claude wrote it; otherwise the steps that built it are in the master charter's 2026-04-23 Revision History entry).

If the package looks incomplete (e.g., no `.env`, no memory dir), tell Mathew what's missing and ask him to either:
(a) Re-run the package build on the work machine, or
(b) Bring the missing pieces over via another route (password manager for `.env`; manual `Copy-Item` for the memory dir).
