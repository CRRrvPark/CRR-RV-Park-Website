-- ============================================================================
-- 006_seed_other_pages_sections.sql — Section structure for non-home pages
-- ============================================================================
-- Seeds `sections` rows for each of the 10 non-home pages. This makes pages
-- listable + selectable in the admin editor even before their content blocks
-- are fully mapped. Full block-level seeds come in a future migration.
--
-- Each page gets a small, hand-curated set of sections reflecting its actual
-- layout. Block seeds for these pages are left for a future migration (or for
-- editors to populate manually via the admin).
-- ============================================================================

-- book-now.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'book-now'
union all
select id, 'availability', 'Real-time availability', 10 from pages where slug = 'book-now'
union all
select id, 'park_map', 'Park map', 20 from pages where slug = 'book-now'
union all
select id, 'rates', 'Rate table', 30 from pages where slug = 'book-now'
union all
select id, 'discounts', 'Discounts', 40 from pages where slug = 'book-now'
union all
select id, 'know_before', 'Know before you arrive', 50 from pages where slug = 'book-now'
union all
select id, 'getting_here', 'Getting here', 60 from pages where slug = 'book-now'
union all
select id, 'manage_reservation', 'Manage your reservation', 70 from pages where slug = 'book-now'
union all
select id, 'inquiry', 'Inquiry form', 80 from pages where slug = 'book-now'
on conflict (page_id, key) do nothing;

-- amenities.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'amenities'
union all
select id, 'intro', 'Intro / overview', 10 from pages where slug = 'amenities'
union all
select id, 'cards', 'Amenity cards', 20 from pages where slug = 'amenities'
union all
select id, 'pool', 'Pool & recreation', 30 from pages where slug = 'amenities'
union all
select id, 'pets', 'Pet-friendly', 40 from pages where slug = 'amenities'
union all
select id, 'dining', 'Dining', 50 from pages where slug = 'amenities'
union all
select id, 'park_map', 'Park map', 60 from pages where slug = 'amenities'
on conflict (page_id, key) do nothing;

-- area-guide.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'area-guide'
union all
select id, 'intro', 'Intro', 10 from pages where slug = 'area-guide'
union all
select id, 'smith_rock', 'Smith Rock', 20 from pages where slug = 'area-guide'
union all
select id, 'steelhead_falls', 'Steelhead Falls', 30 from pages where slug = 'area-guide'
union all
select id, 'fishing', 'Fishing', 40 from pages where slug = 'area-guide'
union all
select id, 'golf', 'Golf', 50 from pages where slug = 'area-guide'
union all
select id, 'seasonal', 'Seasonal highlights', 60 from pages where slug = 'area-guide'
union all
select id, 'dining', 'Local dining', 70 from pages where slug = 'area-guide'
union all
select id, 'bend', 'Bend', 80 from pages where slug = 'area-guide'
union all
select id, 'sisters', 'Sisters', 90 from pages where slug = 'area-guide'
union all
select id, 'redmond', 'Redmond', 100 from pages where slug = 'area-guide'
union all
select id, 'mt_bachelor', 'Mt. Bachelor', 110 from pages where slug = 'area-guide'
union all
select id, 'high_desert', 'High Desert Museum', 120 from pages where slug = 'area-guide'
union all
select id, 'newberry', 'Newberry Volcanic', 130 from pages where slug = 'area-guide'
on conflict (page_id, key) do nothing;

-- extended-stays.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'extended-stays'
union all
select id, 'why_winter', 'Why winter here', 10 from pages where slug = 'extended-stays'
union all
select id, 'typical_day', 'A typical day', 20 from pages where slug = 'extended-stays'
union all
select id, 'rates', 'Monthly rates', 30 from pages where slug = 'extended-stays'
union all
select id, 'requirements', 'Requirements', 40 from pages where slug = 'extended-stays'
union all
select id, 'application_form', 'Monthly application form', 50 from pages where slug = 'extended-stays'
union all
select id, 'bottom_cta', 'Bottom CTA', 60 from pages where slug = 'extended-stays'
on conflict (page_id, key) do nothing;

-- golf-stays.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'golf-stays'
union all
select id, 'golf_notice', 'Golf independence notice', 10 from pages where slug = 'golf-stays'
union all
select id, 'package', 'Golf + RV package', 20 from pages where slug = 'golf-stays'
union all
select id, 'typical_day', 'A typical day', 30 from pages where slug = 'golf-stays'
union all
select id, 'rates', 'Golf stay rates', 40 from pages where slug = 'golf-stays'
union all
select id, 'reserve', 'Reserve CTA', 50 from pages where slug = 'golf-stays'
on conflict (page_id, key) do nothing;

-- golf-course.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'golf-course'
union all
select id, 'golf_notice', 'Golf independence notice', 10 from pages where slug = 'golf-course'
union all
select id, 'overview', 'Course overview', 20 from pages where slug = 'golf-course'
union all
select id, 'features', 'Course features', 30 from pages where slug = 'golf-course'
union all
select id, 'pricing', 'Green fees', 40 from pages where slug = 'golf-course'
union all
select id, 'guest_discount', 'Park guest discount', 50 from pages where slug = 'golf-course'
union all
select id, 'contact', 'Pro shop contact', 60 from pages where slug = 'golf-course'
on conflict (page_id, key) do nothing;

-- group-sites.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'group-sites'
union all
select id, 'intro', 'Intro', 10 from pages where slug = 'group-sites'
union all
select id, 'use_cases', 'Use cases', 20 from pages where slug = 'group-sites'
union all
select id, 'details', 'Group site details', 30 from pages where slug = 'group-sites'
union all
select id, 'amenities', 'Amenities included', 40 from pages where slug = 'group-sites'
union all
select id, 'inquire', 'Group inquiry CTA', 50 from pages where slug = 'group-sites'
on conflict (page_id, key) do nothing;

-- park-policies.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'park-policies'
union all
select id, 'check_in', 'Check-in / check-out', 10 from pages where slug = 'park-policies'
union all
select id, 'quiet_hours', 'Quiet hours', 20 from pages where slug = 'park-policies'
union all
select id, 'pets', 'Pet policy', 30 from pages where slug = 'park-policies'
union all
select id, 'vehicles', 'Vehicles', 40 from pages where slug = 'park-policies'
union all
select id, 'cancellation', 'Cancellation policy', 50 from pages where slug = 'park-policies'
union all
select id, 'general', 'General rules', 60 from pages where slug = 'park-policies'
union all
select id, 'faq', 'FAQ', 70 from pages where slug = 'park-policies'
on conflict (page_id, key) do nothing;

-- privacy.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'privacy'
union all
select id, 'body', 'Policy body', 10 from pages where slug = 'privacy'
union all
select id, 'contact', 'Contact info', 20 from pages where slug = 'privacy'
on conflict (page_id, key) do nothing;

-- terms.html
insert into sections (page_id, key, display_name, display_order)
select id, 'hero', 'Hero', 0 from pages where slug = 'terms'
union all
select id, 'body', 'Terms body', 10 from pages where slug = 'terms'
union all
select id, 'contact', 'Contact info', 20 from pages where slug = 'terms'
on conflict (page_id, key) do nothing;

insert into _migrations (filename) values ('006_seed_other_pages_sections.sql')
  on conflict (filename) do nothing;
