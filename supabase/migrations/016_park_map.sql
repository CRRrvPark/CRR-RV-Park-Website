-- ============================================================================
-- Migration 016 — Park map infrastructure
--
-- Adds the tables + columns required for the upcoming polygon-based
-- interactive park map. Purely ADDITIVE: no existing rows are mutated, no
-- columns are dropped, no behavior changes on any current page until
-- follow-up code commits wire the new data into renderers.
--
-- What ships here:
--   1. `park_maps` — one row per base-map image. is_active=true marks the
--      one currently rendered. Multiple rows can coexist for history; the
--      public renderer just reads the active one.
--   2. `park_sites.status` — enum-like text column with a CHECK constraint.
--      Drives polygon color and popup messaging in the upcoming renderer.
--      Defaults to 'available' so existing rows are unchanged in behavior.
--   3. `park_sites.status_note` — optional free-text shown in the popup +
--      detail page for sites in a non-available state (e.g., "Under repair
--      through May 15").
--
-- Intentionally NOT shipped here (separate, reviewable steps):
--   • Seeding the 6 new physical pads (1A, 1C, A01 status flip, etc.)
--   • Back-filling map_polygon from existing map_position_x/y pin coords.
--   • Any public-site renderer changes.
-- ============================================================================

-- ---- park_maps -------------------------------------------------------------

create table if not exists park_maps (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  title               text not null,
  image_url           text not null,
  natural_width       integer not null check (natural_width > 0),
  natural_height      integer not null check (natural_height > 0),
  is_active           boolean not null default false,
  priority            integer not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Only one park_map can be marked active at a time. Enforced by a partial
-- unique index on the `is_active=true` subset rather than a trigger so
-- admin-side toggling is a simple two-statement transaction.
create unique index if not exists uniq_park_maps_active
  on park_maps (is_active) where is_active = true;

create index if not exists idx_park_maps_priority
  on park_maps (priority desc, created_at desc);

-- Standard updated_at trigger (mirrors park_sites pattern).
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trigger_park_maps_updated_at') then
    create trigger trigger_park_maps_updated_at before update on park_maps
      for each row execute function touch_updated_at();
  end if;
end $$;

comment on table park_maps is
  'Base-map images for the interactive /park-map overlay. One row is is_active=true; public site reads that one. Polygon regions for each site are stored inline on park_sites.map_polygon as 0-1 normalised coordinates, so swapping the base image to a same-aspect replacement preserves placements.';

-- ---- park_sites.status + status_note ---------------------------------------
-- Six statuses shipping in Phase 1. New values can be added by extending
-- the CHECK constraint in a future migration.
--
--   available       — default; bookable via Firefly
--   camp_host       — 1C and any other permanent-occupant pad
--   staff_only      — blocked from guest self-book (shows phone CTA)
--   maintenance     — temporary; shows status_note in popup
--   reserved        — pre-committed (annual contract, group hold, etc.)
--   seasonal_closed — tent sites in deep winter and similar

alter table park_sites
  add column if not exists status text not null default 'available';

alter table park_sites
  add column if not exists status_note text;

-- Drop-and-recreate the check constraint so re-running the migration in a
-- partially-applied state is idempotent. (If it was added with a different
-- vocabulary earlier, this brings it in line.)
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'park_sites_status_check') then
    alter table park_sites drop constraint park_sites_status_check;
  end if;
  alter table park_sites
    add constraint park_sites_status_check
    check (status in ('available','camp_host','staff_only','maintenance','reserved','seasonal_closed'));
end $$;

create index if not exists idx_park_sites_status
  on park_sites (status);

comment on column park_sites.status is
  'Display + booking-eligibility status. Drives polygon color and popup behavior on /park-map. Manually set by admins via the Park Sites tab; no automated state flipping ships in Phase 1.';
comment on column park_sites.status_note is
  'Optional short text shown beneath the status badge in the popup and detail page. Typical use: "Under repair through May 15" or "Reserved — annual guest".';

-- ---- RLS policies on park_maps ---------------------------------------------
-- Mirrors park_sites policy shape exactly: public reads active rows only,
-- editors with manage_area_guide can write.

alter table park_maps enable row level security;

drop policy if exists park_maps_public_read on park_maps;
create policy park_maps_public_read on park_maps
  for select using (is_active = true);

drop policy if exists park_maps_auth_read on park_maps;
create policy park_maps_auth_read on park_maps
  for select to authenticated using (true);

drop policy if exists park_maps_editor_write on park_maps;
create policy park_maps_editor_write on park_maps
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

-- Service role bypasses RLS — no explicit policy needed, but document:
comment on policy park_maps_public_read on park_maps is
  'Anonymous visitors can read the active park map (is_active=true) only.';
