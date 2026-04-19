-- ============================================================================
-- 003_seed_pages.sql — Initial page + section structure
-- ============================================================================
-- Seeds the `pages` and `sections` tables with the 11 existing pages and
-- their logical section breakdown. Content blocks (the actual editable
-- text/images) are seeded in 004_seed_content_blocks.sql, which is generated
-- by `node scripts/extract-content.mjs` (TODO Phase 1 finish).
--
-- The point of this file: once applied, the admin UI can list pages and
-- their sections even before any content blocks have been wired up.
-- ============================================================================

insert into pages (slug, title, meta_description, canonical_url, og_image, hero_preload, display_order)
values
  ('index', 'Home', 'Full hookup RV sites on Oregon''s Crooked River canyon rim. 15 minutes from Smith Rock. Golf course adjacent, local dining nearby, open year-round. Big rig pull-throughs up to 65 feet. Book direct.', 'https://www.crookedriverranchrv.com/', 'https://www.crookedriverranchrv.com/images/hero.jpg', '/images/hero.webp', 0),
  ('book-now', 'Book Now / Reservations', NULL, 'https://www.crookedriverranchrv.com/book-now', NULL, '/images/aerial_wide.webp', 10),
  ('amenities', 'Amenities', NULL, 'https://www.crookedriverranchrv.com/amenities', NULL, '/images/pool_aerial.webp', 20),
  ('area-guide', 'Area Guide', NULL, 'https://www.crookedriverranchrv.com/area-guide', NULL, '/images/smith_rock.webp', 30),
  ('extended-stays', 'Extended / Monthly Stays', NULL, 'https://www.crookedriverranchrv.com/extended-stays', NULL, '/images/winter_sunset.webp', 40),
  ('golf-course', 'Golf Course', NULL, 'https://www.crookedriverranchrv.com/golf-course', NULL, '/images/golf_course.webp', 50),
  ('golf-stays', 'Golf Stays', NULL, 'https://www.crookedriverranchrv.com/golf-stays', NULL, '/images/golf_aerial_canyon.webp', 60),
  ('group-sites', 'Group Sites', NULL, 'https://www.crookedriverranchrv.com/group-sites', NULL, '/images/family_reunion.webp', 70),
  ('park-policies', 'Park Policies', NULL, 'https://www.crookedriverranchrv.com/park-policies', NULL, '/images/canyon_day.webp', 80),
  ('events', 'Events', 'Upcoming events at Crooked River Ranch RV Park.', 'https://www.crookedriverranchrv.com/events', NULL, NULL, 85),
  ('privacy', 'Privacy Policy', NULL, 'https://www.crookedriverranchrv.com/privacy', NULL, NULL, 90),
  ('terms', 'Terms of Use', NULL, 'https://www.crookedriverranchrv.com/terms', NULL, NULL, 100);

-- Section seed for the home page (most editable). Other pages get their
-- sections seeded by the extract-content.mjs script during Phase 1 finish.
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero (top of page)', 0 from pages where slug = 'index'
union all
select id, 'trust_bar', 'Trust bar (icon strip)', 10 from pages where slug = 'index'
union all
select id, 'setting', 'The Setting', 20 from pages where slug = 'index'
union all
select id, 'park', 'The Park', 30 from pages where slug = 'index'
union all
select id, 'stargazing', 'Stargazing interlude', 40 from pages where slug = 'index'
union all
select id, 'sites', 'Site Types (4 cards)', 50 from pages where slug = 'index'
union all
select id, 'amenities', 'Amenities (8 cards)', 60 from pages where slug = 'index'
union all
select id, 'explore', 'Explore the region', 70 from pages where slug = 'index'
union all
select id, 'community', 'The Community', 80 from pages where slug = 'index'
union all
select id, 'reviews', 'Reviews', 90 from pages where slug = 'index'
union all
select id, 'reserve', 'Reserve / contact form', 100 from pages where slug = 'index';
