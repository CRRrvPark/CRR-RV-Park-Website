-- ============================================================================
-- 000_bootstrap.sql — One-time setup (run FIRST, before any other migration)
-- ============================================================================
-- This migration creates the helpers that `scripts/supabase-migrate.mjs` needs
-- to auto-apply subsequent migrations.
--
-- Paste into the Supabase SQL Editor and run once. After that, you can use
-- `npm run db:migrate` for everything else.
-- ============================================================================

-- Track which migration files have been applied
create table if not exists _migrations (
  filename text primary key,
  applied_at timestamptz default now()
);

-- RPC that lets the migration runner execute arbitrary SQL.
-- security definer = runs with owner privileges (needed for DDL).
create or replace function exec_sql(sql text)
returns void
language plpgsql
security definer
as $$
begin
  execute sql;
end;
$$;

-- Only service_role can call exec_sql (belt-and-suspenders — the URL path
-- already requires the service key)
revoke all on function exec_sql(text) from public;
revoke all on function exec_sql(text) from anon;
revoke all on function exec_sql(text) from authenticated;
grant execute on function exec_sql(text) to service_role;

-- Mark this migration as applied
insert into _migrations (filename) values ('000_bootstrap.sql')
  on conflict (filename) do nothing;
