-- ============================================================================
-- 009_page_crud.sql — Page-level CRUD + drafts + nav management
-- ============================================================================
-- Adds:
--   is_protected     — system pages that cannot be deleted (index, book-now,
--                      etc.). Editors can edit content; only owners can ever
--                      remove a non-protected page.
--   is_draft         — new pages start as drafts (not visible publicly until
--                      explicitly published). Existing seeded pages = published.
--   show_in_main_nav — appears in the public navigation when published.
--   nav_order        — order within the main nav (lower = earlier).
--   schemas          — per-page JSON-LD schemas (JSONB array).
--
-- Backfills sensible values for existing seeded pages.
-- ============================================================================

alter table pages add column if not exists is_protected boolean not null default false;
alter table pages add column if not exists is_draft boolean not null default true;
alter table pages add column if not exists show_in_main_nav boolean not null default false;
alter table pages add column if not exists nav_order integer;
alter table pages add column if not exists schemas jsonb;

-- Backfill: existing seeded pages are NOT drafts (already live)
update pages set is_draft = false where slug in (
  'index','book-now','amenities','area-guide','extended-stays',
  'golf-course','golf-stays','group-sites','park-policies','events','privacy','terms'
);

-- Mark the load-bearing pages as protected (cannot be deleted via UI)
update pages set is_protected = true where slug in (
  'index','book-now','privacy','terms','park-policies'
);

-- Slug validation guard: enforce safe-character slugs at the DB level.
-- Reserved words also blocked (admin, api, etc.).
create or replace function validate_page_slug() returns trigger language plpgsql as $$
begin
  if new.slug is null or length(new.slug) = 0 then
    raise exception 'page slug cannot be empty';
  end if;
  if new.slug !~ '^[a-z0-9][a-z0-9-]*$' then
    raise exception 'page slug must be lowercase alphanumerics + hyphens, starting with letter/number (got %)', new.slug;
  end if;
  if length(new.slug) > 60 then
    raise exception 'page slug too long (max 60 chars)';
  end if;
  if new.slug = any(array[
    'admin','api','assets','images','styles','scripts','public','static',
    'login','logout','signin','signout','register','signup',
    'app','dist','build','node_modules','src',
    '.well-known','robots.txt','sitemap.xml','favicon.ico',
    'styles','scripts'
  ]) then
    raise exception 'slug "%" is reserved', new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_page_slug on pages;
create trigger trg_validate_page_slug
  before insert or update of slug on pages
  for each row execute function validate_page_slug();

-- Protect index from being marked as a draft (the home page must always be public)
create or replace function protect_index_published() returns trigger language plpgsql as $$
begin
  if new.slug = 'index' and new.is_draft = true then
    raise exception 'the home page (slug "index") cannot be a draft';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_index_published on pages;
create trigger trg_protect_index_published
  before insert or update of slug, is_draft on pages
  for each row execute function protect_index_published();

-- Protect deletion of protected pages
create or replace function protect_protected_pages() returns trigger language plpgsql as $$
begin
  if old.is_protected = true then
    raise exception 'page "%" is protected and cannot be deleted (set is_protected=false first if you really mean it)', old.slug;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_protected_pages on pages;
create trigger trg_protect_protected_pages
  before delete on pages
  for each row execute function protect_protected_pages();

create index if not exists idx_pages_draft on pages(is_draft);
create index if not exists idx_pages_nav on pages(show_in_main_nav, nav_order) where show_in_main_nav = true;

insert into _migrations (filename) values ('009_page_crud.sql')
  on conflict (filename) do nothing;
