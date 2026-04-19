-- ==========================================================================
-- 013_media_storage_bucket.sql — ensure the `media` Storage bucket exists
-- ==========================================================================
-- The Zoho WorkDrive sync (src/pages/api/zoho/drive-sync.ts) and the new
-- manual upload endpoint (src/pages/api/media/upload.ts) both write image
-- variants to a Supabase Storage bucket named `media`. Historically this
-- bucket was created by hand in the Supabase dashboard, which means fresh
-- environments had to repeat that click-op. This migration codifies it.
--
-- Writes from both endpoints go through the service-role client (bypasses
-- RLS), so no per-object RLS policies are required on `storage.objects`.
-- Reads are public because rendered pages embed the raw Storage URLs.
--
-- Idempotent: safe to re-run.
-- ==========================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;
