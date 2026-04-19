-- ==========================================================================
-- 014_sync_runs_error_class.sql — add error_class to sync_runs
-- ==========================================================================
-- The Zoho sync endpoints now classify failures into one of:
--   auth        — OAuth refresh / token exchange failed
--   timeout     — Zoho returned a 502/503/504 or network timed out
--   rate_limit  — HTTP 429
--   config      — required env var missing (folder ID, calendar UID, etc.)
--   validation  — remote returned malformed data / our downstream insert failed
--   other       — anything else (stack surfaced in error_message)
--
-- This column is nullable: successful runs still leave it NULL. Older rows
-- (pre-migration) also stay NULL since we don't know retroactively.
-- ==========================================================================

alter table sync_runs
  add column if not exists error_class text;

create index if not exists idx_sync_runs_error_class on sync_runs(error_class) where error_class is not null;
