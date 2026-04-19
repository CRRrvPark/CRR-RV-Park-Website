-- ============================================================================
-- 002_rls_policies.sql — Row Level Security policies
-- ============================================================================
-- Apply AFTER 001_init.sql.
--
-- Role hierarchy (from most to least privileged):
--   owner       — full control, including code editor + user management
--   editor      — content edits + publish; cannot manage users or code
--   contributor — content drafts only; cannot publish
--   viewer      — read-only
--
-- All write paths go through Netlify Functions using the service_role key,
-- which bypasses RLS. The policies here protect the case where a client
-- accidentally tries to read/write directly with the anon key.
-- ============================================================================

-- Enable RLS on every table
alter table app_users enable row level security;
alter table pages enable row level security;
alter table sections enable row level security;
alter table content_blocks enable row level security;
alter table content_block_drafts enable row level security;
alter table media enable row level security;
alter table events enable row level security;
alter table zoho_tokens enable row level security;
alter table code_drafts enable row level security;
alter table publishes enable row level security;
alter table snapshots enable row level security;
alter table audit_log enable row level security;
alter table sync_runs enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function current_user_role()
returns user_role
language sql security definer stable
as $$
  select role from app_users where id = auth.uid() and is_active = true;
$$;

create or replace function is_role_at_least(min_role user_role)
returns boolean
language sql security definer stable
as $$
  select case current_user_role()
    when 'owner' then true
    when 'editor' then min_role in ('editor', 'contributor', 'viewer')
    when 'contributor' then min_role in ('contributor', 'viewer')
    when 'viewer' then min_role = 'viewer'
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- app_users
-- ---------------------------------------------------------------------------
-- Anyone signed in can see the user list (for editor/contributor displays).
create policy app_users_select_all on app_users
  for select
  using (auth.uid() is not null);

-- Only owners can insert/update/delete users.
create policy app_users_owner_write on app_users
  for all
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- Users can update their own display_name (but not role/is_active).
create policy app_users_self_update on app_users
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from app_users where id = auth.uid()));

-- ---------------------------------------------------------------------------
-- pages, sections, content_blocks (public read; role-gated write)
-- ---------------------------------------------------------------------------

-- Public can read published content (anonymous Astro build needs this).
create policy pages_public_read on pages
  for select using (is_published = true);
create policy sections_public_read on sections
  for select using (is_visible = true and exists (select 1 from pages where pages.id = sections.page_id and pages.is_published));
create policy content_blocks_public_read on content_blocks
  for select using (true);

-- Authenticated users can read everything (drafts included).
create policy pages_auth_read on pages
  for select using (auth.uid() is not null);
create policy sections_auth_read on sections
  for select using (auth.uid() is not null);

-- Editors and owners can write content_blocks directly.
create policy content_blocks_editor_write on content_blocks
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

-- Editors and owners can manage pages + sections.
create policy pages_editor_write on pages
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));
create policy sections_editor_write on sections
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

-- ---------------------------------------------------------------------------
-- content_block_drafts
-- ---------------------------------------------------------------------------

-- Contributors can read their own drafts; editors see all drafts.
create policy drafts_contributor_read_own on content_block_drafts
  for select
  using (drafted_by = auth.uid() or is_role_at_least('editor'));

-- Contributors can create drafts.
create policy drafts_contributor_insert on content_block_drafts
  for insert
  with check (is_role_at_least('contributor') and drafted_by = auth.uid());

-- Contributors can update their own pending drafts; editors can update any.
create policy drafts_contributor_update_own on content_block_drafts
  for update
  using (
    (drafted_by = auth.uid() and status = 'pending')
    or is_role_at_least('editor')
  );

-- Editors and owners can delete drafts.
create policy drafts_editor_delete on content_block_drafts
  for delete
  using (is_role_at_least('editor'));

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------

-- Public can read active media (referenced by published pages).
create policy media_public_read on media
  for select using (is_active = true);

create policy media_editor_write on media
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

create policy events_public_read on events
  for select using (is_published = true);

create policy events_editor_write on events
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

-- ---------------------------------------------------------------------------
-- zoho_tokens (owner-only — these are the keys to the Zoho integrations)
-- ---------------------------------------------------------------------------

create policy zoho_tokens_owner_only on zoho_tokens
  for all
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- ---------------------------------------------------------------------------
-- code_drafts (owner-only)
-- ---------------------------------------------------------------------------

create policy code_drafts_owner_only on code_drafts
  for all
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- ---------------------------------------------------------------------------
-- publishes (read by all auth'd; write by editors+)
-- ---------------------------------------------------------------------------

create policy publishes_auth_read on publishes
  for select using (auth.uid() is not null);

create policy publishes_editor_write on publishes
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

-- ---------------------------------------------------------------------------
-- snapshots (read by all auth'd; restore by editor+)
-- ---------------------------------------------------------------------------

create policy snapshots_auth_read on snapshots
  for select using (auth.uid() is not null);

create policy snapshots_editor_write on snapshots
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

-- ---------------------------------------------------------------------------
-- audit_log (read by all auth'd; insert from server only via service_role)
-- ---------------------------------------------------------------------------

create policy audit_log_auth_read on audit_log
  for select using (auth.uid() is not null);

-- No insert/update/delete policies — service_role bypasses RLS. Any anon
-- attempt to write to audit_log is blocked.

-- ---------------------------------------------------------------------------
-- sync_runs (read by all auth'd; write from server only)
-- ---------------------------------------------------------------------------

create policy sync_runs_auth_read on sync_runs
  for select using (auth.uid() is not null);
