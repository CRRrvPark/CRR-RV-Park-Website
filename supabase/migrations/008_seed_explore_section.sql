-- ============================================================================
-- 008_seed_explore_section.sql — fill in the explore_grid section content
-- ============================================================================
-- The explore section was created in 003_seed_pages.sql but its content
-- blocks were never seeded. PageRenderer would render it as empty.
-- This adds the original 3 destination cards.
-- ============================================================================

do $$
declare
  v_sec uuid;
begin
  select s.id into v_sec
  from sections s
  join pages p on p.id = s.page_id
  where p.slug = 'index' and s.key = 'explore';

  if v_sec is null then return; end if;

  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_html, value_json) values
    (v_sec, 'label',           'Section label',           'plain_text', 0,  'The Region',                       null, null),
    (v_sec, 'headline',        'Section headline',        'plain_text', 10, 'The best base camp',               null, null),
    (v_sec, 'headline_italic', 'Headline (italic rust)',  'plain_text', 20, 'in Central Oregon.',               null, null),
    (v_sec, 'intro',           'Intro paragraph',         'rich_text', 30, null,
      'From the canyon rim, the best of Central Oregon is within reach.', null),
    (v_sec, 'cards',           'Destination cards',       'json', 40, null, null, $json$
      [
        {"image":"/images/smith_rock.jpg","alt":"Smith Rock State Park 15 minutes from CRR RV Park","distance":"15 min","title":"Smith Rock State Park","desc":"Internationally recognized climbing, the Crooked River loop trail. Smith Rock does not permit RV camping — CRR is the closest full-hookup option.","href":"/area-guide.html#smith-rock"},
        {"image":"/images/golf_course.jpg","alt":"Crooked River Ranch Golf Course Terrebonne Oregon","distance":"Next door","title":"CRR Golf Course","desc":"Nationally recognized 18-hole canyon course right on the property. Walk from your site. Park guests get discounted green fees.","href":"/golf-course.html"},
        {"image":"/images/central_oregon.jpg","alt":"Downtown Bend Oregon 25 minutes from Crooked River Ranch","distance":"25 min","title":"Redmond, Bend & Sisters","desc":"Three of Central Oregon''s best towns within 30 minutes. Breweries, shops, restaurants.","href":"/area-guide.html#bend"}
      ]
    $json$::jsonb)
    on conflict (section_id, key) do nothing;
end $$;

insert into _migrations (filename) values ('008_seed_explore_section.sql')
  on conflict (filename) do nothing;
