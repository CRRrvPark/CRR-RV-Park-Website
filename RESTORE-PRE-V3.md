# Restore the Pre-V3 Website

The complete recovery point was captured before production remodeling began.
This procedure deliberately avoids destructive Git commands.

## Recovery inventory

| Asset | Identifier |
|---|---|
| Pre-remodel source commit | `1496da8` |
| Protected Git tag | `pre-v3-remodel-2026-07-19` |
| Protected Git branch | `backup/pre-v3-remodel-2026-07-19` |
| Supabase snapshot | `d8aab870-70c3-4e5b-a54a-31f222df56f7` |
| Local export | `scripts/_backups/pre-v3-remodel-2026-07-19/site-state.json` |
| Export SHA-256 | `3CE8E55FA8A399A54F59782F0B7E437DC2EE9BAAC7FFC9268B7797221B2DF43B` |

The local export is gitignored because it can contain unpublished site
content. Copy it with the project secrets during any workstation migration.

## What is covered

- Full source, configuration, migrations, scripts, and historical editor code:
  Git tag and backup branch.
- Guest-facing/content-management database rows: local JSON export and
  Supabase snapshot.
- Supabase Storage: left intact. The remodel did not delete storage objects,
  and the export retains media metadata and URLs.
- Authentication, secrets, audit history, analytics, and reservations: not
  copied into the JSON and not changed by the remodel.

Captured row counts:

| Table | Rows |
|---|---:|
| pages | 16 |
| sections | 81 |
| content_blocks | 58 |
| content_block_drafts | 0 |
| page_drafts | 4 |
| page_versions | 14 |
| page_templates | 0 |
| media | 96 |
| events | 2 |
| trails | 11 |
| things_to_do | 76 |
| local_places | 14 |
| park_sites | 113 |
| park_maps | 1 |
| runbook_content | 0 |

## Restore source through review

Create a new recovery branch from the protected tag:

```bash
git fetch origin --tags
git switch -c restore/pre-v3-remodel pre-v3-remodel-2026-07-19
git push -u origin restore/pre-v3-remodel
```

Open a pull request to `main`, let Netlify build a Deploy Preview, and inspect
the old website. Merge only if the preview is the desired rollback.

Do not force-push `main` and do not use `git reset --hard`.

## Inspect the database backup

The default restore command is read-only:

```bash
npm run restore:site -- --input scripts/_backups/pre-v3-remodel-2026-07-19/site-state.json
```

Confirm that the printed SHA-256 matches the value above and that the source
Supabase hostname is correct.

## Apply the database replay

Only if the old editor/content rows were changed after the backup and need to
be restored:

```bash
npm run restore:site -- --input scripts/_backups/pre-v3-remodel-2026-07-19/site-state.json --apply --confirm pre-v3-remodel-2026-07-19
```

The script:

- requires the explicit confirmation label;
- rejects a different Supabase hostname;
- upserts captured rows by primary key in dependency order;
- never deletes rows;
- never touches users, secrets, audit logs, analytics, or reservation data.

Because the production V3 remodel does not create new legacy CMS rows, this
non-destructive replay is sufficient for its recovery point. If future work
adds legacy-table rows and an exact point-in-time database clone is required,
use the Supabase platform backup/PITR process with an administrator instead of
deleting records manually.

## Verify after recovery

- Home and all former public routes render.
- Admin editor, publish, version, and restore routes behave as expected for the
  old source.
- Firefly, Google, Zoho, Supabase, and Netlify environment variables remain
  present.
- Media objects load.
- A full booking handoff and administrator sign-in work.
