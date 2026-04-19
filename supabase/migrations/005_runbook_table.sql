-- ============================================================================
-- 005_runbook_table.sql — Editable runbook storage
-- ============================================================================
-- The runbook is version-tracked: every edit creates a new row. Latest row
-- wins. Historical rows serve as a simple version history that fits within
-- the audit_log paradigm (even without querying audit_log directly).
-- ============================================================================

create table runbook_content (
  id              uuid primary key default gen_random_uuid(),
  content         text not null,
  updated_by      uuid references app_users(id),
  updated_by_email text,
  updated_at      timestamptz default now()
);

create index idx_runbook_updated on runbook_content(updated_at desc);

alter table runbook_content enable row level security;

create policy runbook_auth_read on runbook_content
  for select using (auth.uid() is not null);

create policy runbook_owner_write on runbook_content
  for insert with check (current_user_role() = 'owner');

-- Seed with a pointer to the bundled RUNBOOK.md (content will be loaded from
-- the filesystem by /api/runbook if this table is empty)
insert into _migrations (filename) values ('005_runbook_table.sql')
  on conflict (filename) do nothing;
