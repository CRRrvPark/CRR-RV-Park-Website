# FILE_LOG.md — RV Park Website Activity Log

Activity log for the `RV Park Website` workspace. Records every file and folder
**added, archived, or moved/renamed** within this folder tree only. These entries
are also mirrored in the master log at `C:\Claude Workspace\FILE_LOG.md`.

Files are never deleted; phased-out files are archived, and the archive action is logged.

**Timestamps** are Pacific Time. Entries marked *Backfilled* were recorded
retroactively on 2026-05-21 for actions taken earlier the same day; times approximate.

## Log

| # | Timestamp (PT)   | Action  | Item                       | Detail                                            | Notes                                       |
|--:|------------------|---------|----------------------------|---------------------------------------------------|---------------------------------------------|
| 1 | 2026-05-21 21:11 | Added   | `RV Park Website\` (folder)| Created at `C:\Claude Workspace\RV Park Website`   | Backfilled; time approximate.               |
| 2 | 2026-05-21 21:12 | Added   | `claude.md` (blank)        | `...\RV Park Website\claude.md`                    | Backfilled; time approximate.               |
| 3 | 2026-05-21 21:13 | Renamed | `claude.md` → `CLAUDE.md`  | in `...\RV Park Website\`                          | Backfilled; case-correction for convention. |
| 4 | 2026-05-21 21:42 | Added   | `FILE_LOG.md`              | `...\RV Park Website\FILE_LOG.md` (this file)      | —                                           |
| 5 | 2026-05-21 21:59 | Added   | `_Archive\` (folder)       | `...\RV Park Website\_Archive\`                    | Workspace archive folder.                   |
| 6 | 2026-04-23 15:30 | Archived | scaffold `CLAUDE.md` (0 bytes placeholder) | moved → `_Archive\CLAUDE_placeholder_2026-04-23_1530.md` | Cleared to make room for the authored charter. |
| 7 | 2026-04-23 15:31 | Added (bulk import) | Full project tree from `C:\dev\CRR-RV-Park-Website\` | `.git\` (full history, 17 MB), `src\`, `public\`, `scripts\`, `supabase\`, `.env`, `.env.example`, plus inherited docs: `README.md`, `RUNBOOK.md`, `SETUP.md`, `PROJECT-DETAILS.md`, `AREA-GUIDE-SETUP.md`, `NETLIFY-DEPLOY.md`, `CHECKIN.md`, `HANDOFF-V1…V4`, `PATCHES-APPLIED.md`, `SECURITY-*.md`, `PEN-TEST-REPORT.md`, `SPEC-PHASE-1.md`, build config (`package.json`, `package-lock.json`, `astro.config.mjs`, `netlify.toml`, `tsconfig.json`, `deno.lock`, `.gitignore`, `.gitattributes`, `.netlifyignore`) | Robocopy with `/E /COPY:DAT`, excluded `node_modules\` (587 MB) + `dist\` (20 MB) + `.netlify\` (regenerable). Source `C:\dev\CRR-RV-Park-Website\` retained per *Never delete files* rule. |
| 8 | 2026-04-23 15:34 | Added   | `CLAUDE.md` (authored)     | `…\RV Park Website\CLAUDE.md` (project charter)    | Aligned with the master root charter; inlines iron-forged rules from `~/.claude/memory/` so they survive porting. |
| 9 | 2026-04-23 15:35 | Added   | `PORT_TO_NEW_COMPUTER.md`  | `…\RV Park Website\PORT_TO_NEW_COMPUTER.md`        | Office-machine porting playbook. |

<!-- Append new entries below this line. One row per file/folder added, archived, or moved/renamed. -->
| 10 | 2026-07-19 ~23:00 | Added (merged + pushed LIVE) | `src/pages/availability.astro`, `src/pages/api/availability.ts`, `src/components/AvailabilityMap.astro`, `Nav.astro` (+1 line) | `main` (ff from `feat/live-availability-map` `8d7bce2`) → pushed to origin → Netlify deploy | Live park-availability map backed by Rimrock's public endpoint; booking remains on the Firefly flow (FF = booking authority). Gate: the Rimrock import-engine 5-cycle idempotency soak PASSED 2026-07-19 (evidence in the Rimrock workspace, `work/evidence/soak-test-2026-07-19/`). Mathew-authorized night run. |
