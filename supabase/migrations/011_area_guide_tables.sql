-- ==========================================================================
-- 011_area_guide_tables.sql — Destination-guide content model
-- ==========================================================================
-- Adds:
--   • trails           — hiking trails (on-property + nearby), with stats,
--                        hazards, and optional GPX data
--   • things_to_do     — activities + attractions categorized by persona
--                        (families, active, dogs, etc.). Backs /things-to-do.
--   • local_places     — restaurants/breweries/shops we surface via the
--                        Google Places API; cached_data holds the last
--                        API response so the public site doesn't depend on
--                        Google being up at render time.
--   • park_sites       — the 109 RV sites, used by the clickable park map
--                        on /site-types.
--
-- All tables have RLS enabled, public-read on published rows, editor+ write.
-- ==========================================================================

-- ---- Enums ----------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'trail_difficulty') then
    create type trail_difficulty as enum ('easy', 'moderate', 'hard', 'expert');
  end if;
  if not exists (select 1 from pg_type where typname = 'thing_category') then
    -- Mirrors the persona buckets in the owner's 60-item list so editors
    -- can filter on /things-to-do without free-text categories drifting.
    create type thing_category as enum (
      'families',
      'active',
      'rvers',
      'dogs',
      'day_trippers',
      'winter',
      'food_community'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'place_category') then
    create type place_category as enum (
      'restaurant',
      'brewery',
      'coffee',
      'shop',
      'attraction',
      'other'
    );
  end if;
end $$;

-- ---- trails ---------------------------------------------------------------

create table if not exists trails (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null,
  summary               text,                      -- one-line for cards
  description           text,                      -- HTML (sanitized on write)
  distance_miles        numeric(5,2),
  elevation_gain_feet   integer,
  difficulty            trail_difficulty,
  pet_friendly          boolean not null default false,
  kid_friendly          boolean not null default false,
  hazards               text[] not null default '{}',
  hero_image_url        text,
  gallery_image_urls    text[] not null default '{}',
  trailhead_lat         numeric(10,7),
  trailhead_lng         numeric(10,7),
  parking_info          text,
  season                text,                      -- e.g. "Year-round" or "April–October"
  drive_time_from_park  text,                      -- e.g. "On-property" or "15 min"
  external_link         text,                      -- e.g. AllTrails reference link
  gpx_data              jsonb,                     -- optional GPS track (our own recordings only)
  is_on_property        boolean not null default false,  -- CRR's own trail vs nearby
  is_published          boolean not null default true,
  display_order         integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_trails_published_order
  on trails (is_published, display_order);
create index if not exists idx_trails_on_property
  on trails (is_on_property) where is_on_property = true;

comment on table trails is 'Hiking/walking trails surfaced on /trails. On-property trail is the content moat; nearby trails use OSM-backed map data. Never populate gpx_data from third-party sources (ToS); only from our own recordings.';
comment on column trails.hazards is 'Short labels shown as warning chips on the detail page, e.g. {"steep_dropoff","rattlesnakes","limited_shade"}.';

-- ---- things_to_do ---------------------------------------------------------

create table if not exists things_to_do (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  title                 text not null,
  summary               text,
  description           text,                      -- HTML
  category              thing_category not null,
  personas              thing_category[] not null default '{}',  -- can apply to multiple personas
  location_name         text,
  lat                   numeric(10,7),
  lng                   numeric(10,7),
  distance_from_park    text,                      -- "On-property" | "15 min drive" | "45 min scenic drive"
  hero_image_url        text,
  gallery_image_urls    text[] not null default '{}',
  icon                  text,                      -- emoji or lucide icon name
  external_link         text,
  details_html          text,                      -- optional longer content for detail page
  is_published          boolean not null default true,
  display_order         integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_things_published_category
  on things_to_do (is_published, category, display_order);
create index if not exists idx_things_personas
  on things_to_do using gin (personas);

comment on table things_to_do is 'Activities and attractions shown on /things-to-do. Each item has a primary category AND an array of personas so a "family hike" can appear in BOTH families and active filters.';

-- ---- local_places ---------------------------------------------------------

create table if not exists local_places (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique,               -- optional; null if we just use google_place_id
  name_override         text,                      -- optional; otherwise we show Google's name
  google_place_id       text not null unique,      -- Google Places API identifier
  category              place_category not null default 'restaurant',
  our_description       text,                      -- optional staff-written blurb
  featured              boolean not null default false,
  is_published          boolean not null default true,
  display_order         integer not null default 0,
  cached_data           jsonb,                     -- last Places API response (name, photos, rating, hours, ...)
  cached_at             timestamptz,               -- when cached_data was refreshed
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_places_published_order
  on local_places (is_published, display_order);
create index if not exists idx_places_featured
  on local_places (featured) where featured = true;

comment on table local_places is 'Restaurants / shops / attractions pulled from Google Places API. cached_data is refreshed on a schedule so the public page never blocks on Google. name_override and our_description let us humanize Google''s data without forking the source of truth.';

-- ---- park_sites -----------------------------------------------------------

create table if not exists park_sites (
  id                    uuid primary key default gen_random_uuid(),
  site_number           text not null unique,      -- e.g. "A-12"
  loop                  text not null,             -- "A" | "B" | "C" | "D"
  length_feet           integer,
  width_feet            integer,
  pull_through          boolean not null default false,
  amp_service           integer,                   -- 30 or 50
  site_type             text,                      -- e.g. "standard", "premium", "full-hookup"
  nightly_rate          numeric(7,2),
  weekly_rate           numeric(7,2),
  monthly_rate          numeric(7,2),
  hero_image_url        text,
  gallery_image_urls    text[] not null default '{}',
  description           text,                      -- short optional blurb
  features              text[] not null default '{}',  -- "50-amp", "full-hookup", "patio", "shade"
  map_position_x        numeric(5,2),              -- 0–100 percentage from left edge of park map image
  map_position_y        numeric(5,2),              -- 0–100 percentage from top
  map_polygon           jsonb,                     -- optional array of [x,y] pct points for hit region
  firefly_deep_link     text,                      -- per-site booking URL if Firefly supports it; else null
  is_available          boolean not null default true,  -- soft "currently rentable" flag
  is_published          boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_park_sites_loop
  on park_sites (loop, site_number);
create index if not exists idx_park_sites_published
  on park_sites (is_published);

comment on table park_sites is 'The 109 RV sites. Powers the clickable park-map UI. map_position_x/y are percentage offsets so the same data works across image sizes. firefly_deep_link is null until we confirm Firefly supports per-site URLs.';

-- ---- updated_at auto-refresh triggers ------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trigger_trails_updated_at') then
    create trigger trigger_trails_updated_at before update on trails
      for each row execute function touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trigger_things_updated_at') then
    create trigger trigger_things_updated_at before update on things_to_do
      for each row execute function touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trigger_places_updated_at') then
    create trigger trigger_places_updated_at before update on local_places
      for each row execute function touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trigger_park_sites_updated_at') then
    create trigger trigger_park_sites_updated_at before update on park_sites
      for each row execute function touch_updated_at();
  end if;
end $$;

-- ---- Row Level Security --------------------------------------------------

alter table trails        enable row level security;
alter table things_to_do  enable row level security;
alter table local_places  enable row level security;
alter table park_sites    enable row level security;

-- Anonymous visitors can read published rows (the public site renders
-- prerendered pages using the service-role key, but future dynamic paths
-- may read via anon key).
create policy trails_public_read on trails
  for select using (is_published = true);

create policy things_public_read on things_to_do
  for select using (is_published = true);

create policy places_public_read on local_places
  for select using (is_published = true);

create policy park_sites_public_read on park_sites
  for select using (is_published = true);

-- Authenticated users see everything (drafts included)
create policy trails_auth_read on trails
  for select using (auth.uid() is not null);

create policy things_auth_read on things_to_do
  for select using (auth.uid() is not null);

create policy places_auth_read on local_places
  for select using (auth.uid() is not null);

create policy park_sites_auth_read on park_sites
  for select using (auth.uid() is not null);

-- Editors and owners can write
create policy trails_editor_write on trails
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

create policy things_editor_write on things_to_do
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

create policy places_editor_write on local_places
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));

create policy park_sites_editor_write on park_sites
  for all
  using (is_role_at_least('editor'))
  with check (is_role_at_least('editor'));
