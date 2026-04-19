-- ============================================================================
-- 007_section_types.sql — Path B: Section Library
-- ============================================================================
-- Adds a `type` column to sections so every section instance is associated
-- with a section template (hero, two_col, testimonial, etc.). The catalog of
-- types lives in code (src/lib/section-types.ts) — that's where defaults +
-- block schema + render logic are defined. The DB only stores which type
-- each section uses.
--
-- Backfills existing seeded sections with sensible types so nothing breaks.
-- ============================================================================

alter table sections
  add column if not exists type text;

create index if not exists idx_sections_type on sections(type);

-- Backfill: map existing section keys to their template types.
-- Most are page-specific (only on the home page). We map by (page slug, key)
-- so the backfill is precise.
do $$
declare
  v_idx uuid;
begin
  select id into v_idx from pages where slug = 'index';

  update sections set type = 'hero'         where page_id = v_idx and key = 'hero';
  update sections set type = 'trust_bar'    where page_id = v_idx and key = 'trust_bar';
  update sections set type = 'two_col'      where page_id = v_idx and key = 'setting';
  update sections set type = 'two_col'      where page_id = v_idx and key = 'park';
  update sections set type = 'interlude'    where page_id = v_idx and key = 'stargazing';
  update sections set type = 'site_cards'   where page_id = v_idx and key = 'sites';
  update sections set type = 'amenity_grid' where page_id = v_idx and key = 'amenities';
  update sections set type = 'explore_grid' where page_id = v_idx and key = 'explore';
  update sections set type = 'two_col'      where page_id = v_idx and key = 'community';
  update sections set type = 'reviews'      where page_id = v_idx and key = 'reviews';
  update sections set type = 'reserve_form' where page_id = v_idx and key = 'reserve';
end $$;

-- Default the rest of the seeded sections to 'two_col' (a safe, generic
-- template). Editors can change them later.
update sections set type = 'two_col' where type is null;

-- Going forward, sections without a type aren't valid. Enforce that.
alter table sections alter column type set not null;

insert into _migrations (filename) values ('007_section_types.sql')
  on conflict (filename) do nothing;
