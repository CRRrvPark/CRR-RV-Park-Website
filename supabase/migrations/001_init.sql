-- ============================================================================
-- 001_init.sql — Initial schema for CRR RV Park platform
-- ============================================================================
-- Run order:
--   001_init.sql            (this file — tables + enums)
--   002_rls_policies.sql    (Row Level Security policies)
--   003_seed_content.sql    (initial content + admin user bootstrap)
--
-- To apply: paste each file into the Supabase SQL Editor in order.
-- (We will eventually wrap this in a CLI migration tool — for now manual.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

create type user_role as enum ('owner', 'editor', 'contributor', 'viewer');

create type content_block_type as enum (
  'plain_text',     -- short string, no formatting
  'rich_text',      -- HTML from Tiptap editor
  'image',          -- single image (URL + alt + dimensions)
  'image_pair',     -- WebP + JPEG fallback
  'json',           -- structured data (lists, cards, schema)
  'number',         -- pricing, capacities
  'boolean',        -- feature flags ("show this section")
  'url'             -- external link
);

create type publish_status as enum ('queued', 'building', 'success', 'failed', 'rolled_back');

create type audit_action as enum (
  'login',
  'logout',
  'content_edit',
  'content_publish_request',
  'publish_succeeded',
  'publish_failed',
  'snapshot_created',
  'snapshot_restored',
  'role_changed',
  'user_invited',
  'user_removed',
  'code_edit',
  'code_published',
  'zoho_sync_run',
  'zoho_sync_failed',
  'media_added',
  'media_removed'
);

create type sync_status as enum ('idle', 'running', 'success', 'failed');

-- ---------------------------------------------------------------------------
-- USERS + ROLES
-- ---------------------------------------------------------------------------
-- Supabase Auth manages auth.users automatically. We add an `app_users`
-- table for application-specific fields (display name, role, status).

create table app_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  display_name  text not null,
  role          user_role not null default 'viewer',
  is_active     boolean not null default true,
  invited_by    uuid references app_users(id),
  invited_at    timestamptz default now(),
  last_login_at timestamptz,
  created_at    timestamptz default now()
);

create index idx_app_users_role on app_users(role);
create index idx_app_users_active on app_users(is_active);

-- Constraint: at least 2 owners must exist (enforced via trigger,
-- because partial constraints with subqueries aren't allowed).
create or replace function enforce_min_two_owners()
returns trigger language plpgsql as $$
declare
  remaining_owners integer;
begin
  -- Count owners that would remain AFTER the proposed change.
  select count(*) into remaining_owners
  from app_users
  where role = 'owner'
    and is_active = true
    and id != coalesce(old.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- If new state has at least one active owner, we're fine.
  if tg_op = 'UPDATE' and new.role = 'owner' and new.is_active = true then
    return new;
  end if;
  if tg_op = 'INSERT' and new.role = 'owner' and new.is_active = true then
    return new;
  end if;

  if remaining_owners < 1 then
    raise exception 'Cannot remove the last active owner — promote another user to owner first';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_enforce_min_two_owners
  before update or delete on app_users
  for each row
  execute function enforce_min_two_owners();

-- ---------------------------------------------------------------------------
-- CONTENT MODEL
-- ---------------------------------------------------------------------------
-- Three-level hierarchy:
--   pages → sections → content_blocks
--
-- Each Astro page maps 1:1 to a row in `pages`. Sections are logical
-- groupings (hero, setting, sites, etc.). Content blocks are the leaf
-- editable units (a paragraph, an image, a price).

create table pages (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  meta_description text,
  canonical_url text,
  og_image      text,
  hero_preload  text,
  is_published  boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index idx_pages_slug on pages(slug);
create index idx_pages_published on pages(is_published);

create table sections (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references pages(id) on delete cascade,
  key           text not null,           -- stable identifier within page (e.g. 'hero', 'setting')
  display_name  text not null,           -- human label for the editor UI
  display_order integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (page_id, key)
);

create index idx_sections_page on sections(page_id);

create table content_blocks (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references sections(id) on delete cascade,
  key           text not null,           -- stable identifier within section (e.g. 'headline', 'body_1')
  display_name  text not null,           -- human label for the editor UI
  block_type    content_block_type not null,
  display_order integer not null default 0,
  -- Polymorphic value columns — exactly one is populated based on block_type
  value_text    text,
  value_html    text,
  value_json    jsonb,
  value_number  numeric,
  value_boolean boolean,
  value_image_url text,
  value_image_alt text,
  value_image_width integer,
  value_image_height integer,
  -- Editing constraints
  max_length    integer,                  -- soft limit shown to editors
  is_required   boolean not null default false,
  notes         text,                     -- editor-facing help text
  -- Banned word check happens at API layer (see lib/content.ts)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (section_id, key)
);

create index idx_content_blocks_section on content_blocks(section_id);

-- Drafts: contributors edit here; editors/owners promote to content_blocks.
create table content_block_drafts (
  id                uuid primary key default gen_random_uuid(),
  content_block_id  uuid not null references content_blocks(id) on delete cascade,
  drafted_by        uuid not null references app_users(id),
  -- Same polymorphic shape as content_blocks
  value_text        text,
  value_html        text,
  value_json        jsonb,
  value_number      numeric,
  value_boolean     boolean,
  value_image_url   text,
  value_image_alt   text,
  value_image_width integer,
  value_image_height integer,
  status            text not null default 'pending', -- pending | approved | rejected | superseded
  reviewed_by       uuid references app_users(id),
  reviewed_at       timestamptz,
  review_notes      text,
  created_at        timestamptz default now()
);

create index idx_drafts_block on content_block_drafts(content_block_id);
create index idx_drafts_status on content_block_drafts(status);

-- ---------------------------------------------------------------------------
-- MEDIA LIBRARY (mirrored from Zoho WorkDrive)
-- ---------------------------------------------------------------------------

create table media (
  id              uuid primary key default gen_random_uuid(),
  zoho_resource_id text unique,            -- null if uploaded directly through admin
  filename        text not null,
  display_name    text,
  alt_text        text,
  caption         text,
  mime_type       text not null,
  byte_size       bigint,
  width           integer,
  height          integer,
  -- Variants generated by Sharp on sync
  storage_path_jpg  text,                  -- in Supabase Storage
  storage_path_webp text,
  storage_path_mobile_webp text,
  public_url_jpg    text,
  public_url_webp   text,
  public_url_mobile_webp text,
  -- Sync state
  zoho_modified_at  timestamptz,
  last_synced_at    timestamptz,
  is_active         boolean not null default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index idx_media_zoho on media(zoho_resource_id);
create index idx_media_active on media(is_active);

-- ---------------------------------------------------------------------------
-- EVENTS (synced from Zoho Calendar)
-- ---------------------------------------------------------------------------

create table events (
  id            uuid primary key default gen_random_uuid(),
  zoho_event_uid text not null unique,
  title         text not null,
  description   text,
  location      text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  is_all_day    boolean not null default false,
  recurrence_rule text,
  is_published  boolean not null default true,  -- editors can hide a synced event
  zoho_etag     text,
  last_synced_at timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index idx_events_starts_at on events(starts_at);
create index idx_events_published on events(is_published);

-- ---------------------------------------------------------------------------
-- ZOHO TOKENS (encrypted at rest by Supabase Vault, see notes)
-- ---------------------------------------------------------------------------

create table zoho_tokens (
  id              uuid primary key default gen_random_uuid(),
  service         text not null unique,    -- 'workdrive' | 'calendar'
  access_token    text not null,
  refresh_token   text not null,
  expires_at      timestamptz not null,
  scope           text,
  obtained_by     uuid references app_users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
-- NOTE: enable Supabase Vault and migrate access_token + refresh_token into
-- vault.secrets in a follow-up migration. For now, RLS keeps these table-private.

-- ---------------------------------------------------------------------------
-- CODE DRAFTS (Monaco editor — owner-only feature)
-- ---------------------------------------------------------------------------

create table code_drafts (
  id            uuid primary key default gen_random_uuid(),
  file_path     text not null,            -- e.g. 'src/components/Hero.astro'
  original_content text,                  -- snapshot at draft creation
  draft_content text not null,
  drafted_by    uuid not null references app_users(id),
  status        text not null default 'open',  -- open | preview_built | published | discarded
  preview_deploy_id text,                  -- Netlify preview deploy ID
  preview_url   text,
  published_at  timestamptz,
  discarded_at  timestamptz,
  created_at    timestamptz default now()
);

create index idx_code_drafts_status on code_drafts(status);

-- ---------------------------------------------------------------------------
-- PUBLISHES (history of publish events to live site)
-- ---------------------------------------------------------------------------

create table publishes (
  id              uuid primary key default gen_random_uuid(),
  triggered_by    uuid references app_users(id),
  status          publish_status not null default 'queued',
  netlify_deploy_id text,
  netlify_deploy_url text,
  snapshot_id     uuid,                    -- snapshot taken at publish time
  -- What was included
  content_block_count integer,
  code_drafts_applied integer not null default 0,
  -- Build info
  started_at      timestamptz default now(),
  completed_at    timestamptz,
  duration_ms     integer,
  error_message   text,
  log_url         text
);

create index idx_publishes_status on publishes(status);
create index idx_publishes_started on publishes(started_at desc);

-- ---------------------------------------------------------------------------
-- SNAPSHOTS (full content state at a point in time, for restore)
-- ---------------------------------------------------------------------------

create table snapshots (
  id            uuid primary key default gen_random_uuid(),
  triggered_by  uuid references app_users(id),
  reason        text not null,            -- 'pre_publish' | 'manual' | 'pre_restore' | 'pre_code_publish'
  -- Stored as a JSONB blob: full state of pages + sections + content_blocks + media + events
  state         jsonb not null,
  byte_size     bigint,
  created_at    timestamptz default now()
);

create index idx_snapshots_created on snapshots(created_at desc);
create index idx_snapshots_reason on snapshots(reason);

-- Older snapshots auto-pruned by a scheduled function; keep ~90 days by default.

-- Add the FK from publishes to snapshots now that both tables exist
alter table publishes
  add constraint fk_publishes_snapshot
  foreign key (snapshot_id) references snapshots(id) on delete set null;

-- ---------------------------------------------------------------------------
-- AUDIT LOG (the change log + service history)
-- ---------------------------------------------------------------------------

create table audit_log (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      uuid references app_users(id),
  actor_email   text,                      -- denormalized, in case user is deleted later
  action        audit_action not null,
  -- What was affected
  target_table  text,                      -- e.g. 'content_blocks'
  target_id     uuid,                      -- the affected row's UUID
  target_label  text,                      -- human-readable label ('Hero Headline on Home page')
  -- Diff
  before_value  jsonb,
  after_value   jsonb,
  -- Context
  ip_address    inet,
  user_agent    text,
  request_id    text,
  notes         text
);

create index idx_audit_occurred on audit_log(occurred_at desc);
create index idx_audit_actor on audit_log(actor_id);
create index idx_audit_action on audit_log(action);
create index idx_audit_target on audit_log(target_table, target_id);

-- ---------------------------------------------------------------------------
-- SYNC STATE (Zoho sync run history)
-- ---------------------------------------------------------------------------

create table sync_runs (
  id            uuid primary key default gen_random_uuid(),
  service       text not null,             -- 'zoho_drive' | 'zoho_calendar'
  status        sync_status not null default 'running',
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  items_added   integer default 0,
  items_updated integer default 0,
  items_removed integer default 0,
  error_message text
);

create index idx_sync_runs_service on sync_runs(service, started_at desc);

-- ---------------------------------------------------------------------------
-- UPDATED_AT auto-touch trigger (DRY)
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_pages_updated before update on pages
  for each row execute function touch_updated_at();
create trigger trg_sections_updated before update on sections
  for each row execute function touch_updated_at();
create trigger trg_content_blocks_updated before update on content_blocks
  for each row execute function touch_updated_at();
create trigger trg_media_updated before update on media
  for each row execute function touch_updated_at();
create trigger trg_events_updated before update on events
  for each row execute function touch_updated_at();
create trigger trg_zoho_tokens_updated before update on zoho_tokens
  for each row execute function touch_updated_at();
