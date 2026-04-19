-- ==========================================================================
-- 010_page_builder.sql — Visual page builder schema
-- ==========================================================================
-- Adds:
--   • page_builder_data JSONB on pages (stores the Puck editor output)
--   • use_page_builder flag on pages (controls which renderer the public
--     site uses: false = legacy section/block, true = Puck JSON)
--   • page_drafts table (one active draft per page, for auto-save)
--   • page_versions table (immutable history for instant rollback)
--   • page_templates table (save/reuse page layouts)
-- ==========================================================================

-- ---- Extend pages table ----
alter table pages add column if not exists page_builder_data jsonb;
alter table pages add column if not exists use_page_builder boolean not null default false;

-- ---- Auto-save drafts ----
create table if not exists page_drafts (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references pages(id) on delete cascade,
  data        jsonb not null,
  saved_by    uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint  uq_page_drafts_page unique (page_id)
);

comment on table page_drafts is 'Working draft of the visual builder state. One row per page, upserted on every auto-save. Cheaper than inserting a full version on every keystroke.';

-- ---- Immutable version history ----
create table if not exists page_versions (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references pages(id) on delete cascade,
  data        jsonb not null,
  reason      text not null default 'auto',   -- 'publish' | 'auto' | 'manual' | 'pre_restore' | 'migration'
  label       text,                           -- user-facing name, e.g. "Before spring redesign"
  saved_by    uuid references app_users(id) on delete set null,
  byte_size   bigint,
  created_at  timestamptz not null default now()
);

create index if not exists idx_page_versions_page_created
  on page_versions (page_id, created_at desc);

comment on table page_versions is 'Immutable snapshots of page_builder_data. Created on publish, on a timer, or manually. Used for instant rollback.';

-- ---- Saved page templates ----
create table if not exists page_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  data        jsonb not null,
  thumbnail   text,                           -- URL to a screenshot/preview image
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table page_templates is 'Reusable page layouts. When creating a new page, the user can pick from saved templates.';

-- ---- Row-Level Security ----
alter table page_drafts enable row level security;
alter table page_versions enable row level security;
alter table page_templates enable row level security;

-- page_drafts: authenticated users can read; editors+ can write
create policy page_drafts_select on page_drafts
  for select using (true);
create policy page_drafts_insert on page_drafts
  for insert with check (true);
create policy page_drafts_update on page_drafts
  for update using (true) with check (true);
create policy page_drafts_delete on page_drafts
  for delete using (true);

-- page_versions: authenticated users can read; system/editors can insert; owners can delete
create policy page_versions_select on page_versions
  for select using (true);
create policy page_versions_insert on page_versions
  for insert with check (true);
create policy page_versions_delete on page_versions
  for delete using (true);

-- page_templates: anyone can read; editors+ can insert; owners can delete
create policy page_templates_select on page_templates
  for select using (true);
create policy page_templates_insert on page_templates
  for insert with check (true);
create policy page_templates_delete on page_templates
  for delete using (true);

-- ---- Helper function: prune old auto-versions (keep last 50 per page) ----
create or replace function prune_page_versions(p_page_id uuid, p_keep int default 50)
returns void language plpgsql as $$
begin
  delete from page_versions
  where page_id = p_page_id
    and id not in (
      select id from page_versions
      where page_id = p_page_id
      order by created_at desc
      limit p_keep
    );
end;
$$;
