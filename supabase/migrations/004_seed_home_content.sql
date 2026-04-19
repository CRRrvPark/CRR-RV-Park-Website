-- ============================================================================
-- 004_seed_home_content.sql — Editable content blocks for the home page
-- ============================================================================
-- This populates every editable region on the home page (index.astro) into
-- the content_blocks table. Once applied, the admin editor can edit these
-- and the home page will render whatever is in the DB.
--
-- The other 10 pages get similar seed files in follow-up migrations
-- (005_seed_book_now_content.sql, 006_seed_amenities_content.sql, etc.).
-- Home page is seeded first because it's the most visible + most-edited.
--
-- Schema recap:
--   pages → sections → content_blocks
-- ============================================================================

-- Helper: fetch a section's UUID by page slug + section key
do $$
declare
  v_page_id uuid;
  v_sec_hero uuid;
  v_sec_trust uuid;
  v_sec_setting uuid;
  v_sec_park uuid;
  v_sec_stars uuid;
  v_sec_sites uuid;
  v_sec_amen uuid;
  v_sec_explore uuid;
  v_sec_community uuid;
  v_sec_reviews uuid;
  v_sec_reserve uuid;
begin
  select id into v_page_id from pages where slug = 'index';

  select id into v_sec_hero    from sections where page_id = v_page_id and key = 'hero';
  select id into v_sec_trust   from sections where page_id = v_page_id and key = 'trust_bar';
  select id into v_sec_setting from sections where page_id = v_page_id and key = 'setting';
  select id into v_sec_park    from sections where page_id = v_page_id and key = 'park';
  select id into v_sec_stars   from sections where page_id = v_page_id and key = 'stargazing';
  select id into v_sec_sites   from sections where page_id = v_page_id and key = 'sites';
  select id into v_sec_amen    from sections where page_id = v_page_id and key = 'amenities';
  select id into v_sec_explore from sections where page_id = v_page_id and key = 'explore';
  select id into v_sec_community from sections where page_id = v_page_id and key = 'community';
  select id into v_sec_reviews from sections where page_id = v_page_id and key = 'reviews';
  select id into v_sec_reserve from sections where page_id = v_page_id and key = 'reserve';

  -- ----- HERO -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, notes) values
    (v_sec_hero, 'eyebrow', 'Eyebrow label', 'plain_text', 0, 'Central Oregon · Open 365 Days', 'Small uppercase text above the main headline'),
    (v_sec_hero, 'headline_line1', 'Headline (first line)', 'plain_text', 10, 'Park near', 'First line of the main H1. Keep short — 2–3 words.'),
    (v_sec_hero, 'headline_line2_italic', 'Headline (italic gold line)', 'plain_text', 20, 'the canyon.', 'Second line, shown in gold italic. Keep short.'),
    (v_sec_hero, 'subtitle', 'Subtitle paragraph', 'rich_text', 30, null, 'One paragraph below the headline.')
    on conflict (section_id, key) do nothing;
  update content_blocks set value_html = 'Full hookup RV sites among juniper trees on the rim of the Crooked River Gorge — 15 minutes from Smith Rock, steps from a golf course, with local dining nearby and views that make guests stay.'
    where section_id = v_sec_hero and key = 'subtitle' and value_html is null;

  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, notes, value_image_url) values
    (v_sec_hero, 'cta_primary_label', 'Primary button label', 'plain_text', 40, 'Reserve Your Site', null, null),
    (v_sec_hero, 'cta_primary_url', 'Primary button link', 'url', 50, 'https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK', null, null),
    (v_sec_hero, 'cta_secondary_label', 'Secondary button label', 'plain_text', 60, 'Explore the Park', null, null),
    (v_sec_hero, 'cta_secondary_url', 'Secondary button link', 'url', 70, '#setting', null, null)
    on conflict (section_id, key) do nothing;

  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_image_url, value_image_alt, value_image_width, value_image_height, notes) values
    (v_sec_hero, 'background_image', 'Hero background image', 'image', 80, '/images/hero.jpg', 'Crooked River Ranch RV Park', 1400, 933, 'The big background image. Replace by choosing from the Media Library.')
    on conflict (section_id, key) do nothing;

  -- ----- TRUST BAR (list of icon+text items) -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_json, notes) values
    (v_sec_trust, 'items', 'Trust bar items', 'json', 0, $json$
      [
        {"icon":"⛳","text":"Golf Course Adjacent"},
        {"icon":"🏔️","text":"15 Min to Smith Rock"},
        {"icon":"🚐","text":"Big Rigs to 65'"},
        {"icon":"🍺","text":"Local Dining Nearby"},
        {"icon":"📅","text":"Open Year-Round"},
        {"icon":"🐾","text":"Pet Friendly"},
        {"icon":"🔌","text":"EV Charging"}
      ]
    $json$::jsonb, 'The row of icons + short text at the top. 7 items is about the max that fits.')
    on conflict (section_id, key) do nothing;

  -- ----- THE SETTING -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_html, notes) values
    (v_sec_setting, 'label', 'Section label', 'plain_text', 0, 'The Setting', null, null),
    (v_sec_setting, 'headline', 'Section headline', 'plain_text', 10, 'Not just a place to park.', null, 'First line of H2'),
    (v_sec_setting, 'headline_italic', 'Headline (italic rust line)', 'plain_text', 20, 'A reason to stay.', null, 'Second line of H2, rust italic'),
    (v_sec_setting, 'body', 'Body paragraph', 'rich_text', 30, null,
     'Crooked River Ranch RV Park is set near the rim of the Crooked River Gorge in Central Oregon''s high desert, one of the most dramatic corridors in the Pacific Northwest, and a wildlife sanctuary area. It''s more than a site number, it''s an experience that our guests come back for year after year.',
     null)
    on conflict (section_id, key) do nothing;

  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_json, notes) values
    (v_sec_setting, 'feature_list', 'Three feature bullets', 'json', 40, $json$
      [
        {"num":"01","title":"Canyon rim views and juniper groves","body":"The Crooked River 500 feet below. Juniper air. The kind of morning that makes you stop checking the map."},
        {"num":"02","title":"Golf course next door — 200 feet from your rig","body":"Walk from your site to the first tee of a nationally recognized 18-hole course. No shuttle. No drive."},
        {"num":"03","title":"Open every single day of the year","body":"While other parks in Central Oregon parks close in October, we don''t. Book a winter month and have the canyon nearly to yourself."}
      ]
    $json$::jsonb, 'The 3 numbered bullet items')
    on conflict (section_id, key) do nothing;

  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_image_url, value_image_alt, value_text, notes) values
    (v_sec_setting, 'image', 'Section image', 'image', 50, '/images/canyon_sunset.jpg', 'Crooked River canyon at sunset from RV park Terrebonne Oregon', null, null),
    (v_sec_setting, 'image_caption', 'Image caption', 'plain_text', 60, null, null, 'The canyon at dusk', 'Shown as overlay text on the image'),
    (v_sec_setting, 'cta_label', 'CTA label', 'plain_text', 70, null, null, 'Pick Your Site →', null),
    (v_sec_setting, 'cta_url', 'CTA link', 'url', 80, null, null, 'https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK', null)
    on conflict (section_id, key) do nothing;

  -- ----- THE PARK -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_html, notes) values
    (v_sec_park, 'label', 'Section label', 'plain_text', 0, 'The Park', null, null),
    (v_sec_park, 'headline', 'Section headline', 'plain_text', 10, '109 sites on four loops,', null, null),
    (v_sec_park, 'headline_italic', 'Headline (italic)', 'plain_text', 20, 'built for the experience.', null, null),
    (v_sec_park, 'body_1', 'First paragraph', 'rich_text', 30, null,
     'The park divides into A, B, C, and D loops, with Full-hookup sites that run up to 65 feet, and pull-throughs positioned so you can set and forget. Dry camping sites are available for those who want minimal infrastructure.',
     null),
    (v_sec_park, 'body_2', 'Second paragraph', 'rich_text', 40, null,
     'CRR RV Park has been around long enough that multiple generations have come to experience what we offer. From many sites, you can see the gorge. From all of them, you''re near the rim — not in a valley, not in a field.',
     null)
    on conflict (section_id, key) do nothing;

  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_image_url, value_image_alt, value_text) values
    (v_sec_park, 'image', 'Section image', 'image', 50, '/images/aerial_aloop.jpg', 'Aerial view of Crooked River Ranch RV Park loops along the canyon rim', null),
    (v_sec_park, 'image_caption', 'Image caption', 'plain_text', 60, null, null, 'Four loops, one rim')
    on conflict (section_id, key) do nothing;

  -- ----- STARGAZING INTERLUDE -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_html) values
    (v_sec_stars, 'eyebrow', 'Eyebrow label', 'plain_text', 0, 'Dark Skies', null),
    (v_sec_stars, 'headline', 'Headline (multi-line)', 'rich_text', 10, null,
     'The canyon by day<br>is dramatic. At night,<br>it''s <em>something else.</em>'),
    (v_sec_stars, 'body', 'Body paragraph', 'rich_text', 20, null,
     'One of our guests brought a telescope. This is what they captured from their site — a nebula photographed from the Crooked River canyon rim. No light pollution. No competition. Just sky.'),
    (v_sec_stars, 'credit', 'Image credit line', 'plain_text', 30, 'Astrophotography captured by a CRR guest', null)
    on conflict (section_id, key) do nothing;

  -- ----- SITE TYPES (4 cards) -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_html, value_json, notes) values
    (v_sec_sites, 'label', 'Section label', 'plain_text', 0, 'Site Types', null, null, null),
    (v_sec_sites, 'headline', 'Section headline', 'plain_text', 10, '109 sites.', null, null, null),
    (v_sec_sites, 'headline_italic', 'Headline (italic)', 'plain_text', 20, 'Find your fit.', null, null, null),
    (v_sec_sites, 'intro', 'Intro paragraph', 'rich_text', 30, null,
     'Back-in and pull-through options for every rig size. Full hookup to dry camp to tent camping — browse what fits your setup, then pick your site in real time. EV Friendly Sites available — bring your own adapter for 30/50 amp hookups ($15/night).',
     null, null),
    (v_sec_sites, 'cards', 'Site type cards', 'json', 40, null, null, $json$
      [
        {
          "featured": true,
          "badge": "Most Popular",
          "title": "Full Hookup RV Site",
          "description": "Water, electric (30/50 amp), and sewer at every site. Back-in and pull-through options. Most sites accommodate slide-outs on both sides.",
          "tags": [
            {"text":"Up to 65' pull-through","highlight":true},
            {"text":"30 & 50 amp","highlight":true},
            {"text":"Water, Electric, Sewer","highlight":false},
            {"text":"Both slide-outs","highlight":false},
            {"text":"Pets welcome (2 max)","highlight":false},
            {"text":"🔌 EV Charging","highlight":true}
          ],
          "price_nightly": 62, "price_weekly": 372
        },
        {
          "badge": "Water & Electric",
          "title": "W&E Sites",
          "description": "30/50 amp electric and water — no sewer hookup. Good for shorter stays. Back-in configuration, sites up to 50'.",
          "tags": [
            {"text":"Up to 50' back-in","highlight":false},
            {"text":"30 & 50 amp","highlight":false},
            {"text":"Dump station available","highlight":false},
            {"text":"🔌 EV Charging","highlight":true}
          ],
          "price_nightly": 57, "price_weekly": 342
        },
        {
          "badge": "Tent & Rooftop Tents",
          "title": "Tent Sites",
          "description": "19 standard tent sites plus the legendary <strong>Magic Tent</strong> — a site beneath the trees named by our own campers.",
          "tags": [
            {"text":"Magic Tent available","highlight":true},
            {"text":"Rooftop tent compatible","highlight":false},
            {"text":"No hookups","highlight":false}
          ],
          "price_nightly": 36, "price_weekly": 216
        },
        {
          "badge": "Van Life / Small Rigs",
          "title": "Dry Camp",
          "description": "No hookups. Single vehicles up to 25'. Vans, truck campers, and small rigs only. No trailers or 5th wheels.",
          "tags": [
            {"text":"25' max length","highlight":false},
            {"text":"Vans & truck campers","highlight":false},
            {"text":"Dump station available","highlight":false}
          ],
          "price_nightly": 36, "price_weekly": 216
        }
      ]
    $json$::jsonb, 'The 4 site type cards. Each has badge, title, description, tags (with highlight flag), nightly + weekly prices.')
    on conflict (section_id, key) do nothing;

  -- ----- AMENITIES (grid of cards) -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_json) values
    (v_sec_amen, 'label', 'Section label', 'plain_text', 0, 'On Property', null),
    (v_sec_amen, 'headline', 'Section headline', 'plain_text', 10, 'Everything you need.', null),
    (v_sec_amen, 'headline_italic', 'Headline (italic)', 'plain_text', 20, 'Then some.', null),
    (v_sec_amen, 'cards', 'Amenity cards', 'json', 30, null, $json$
      [
        {"icon":"⛳","name":"Golf Course Adjacent","desc":"Walk from your site to the first tee of a nationally recognized 18-hole course. Canyon views on every hole."},
        {"icon":"🍺","name":"Local Dining & Drinks","desc":"Restaurants and bars nearby within the community. Oregon beer, good food, canyon views."},
        {"icon":"🏊","name":"Saltwater Pool","desc":"Seasonal saltwater pool open for guests. Cool off after a day on the trail or the golf course."},
        {"icon":"🎾","name":"Tennis & Pickleball","desc":"On-property courts available for guests. Great way to meet your neighbors."},
        {"icon":"🚿","name":"Renovated Bathhouse","desc":"Newly (partially) renovated facilities with free showers. Clean, coded entry for registered guests."},
        {"icon":"🐾","name":"Dog Run & Pet Friendly","desc":"On-site dog area and pet-friendly sites throughout. Up to two pets per site."},
        {"icon":"🔌","name":"EV Charging","desc":"Charge your EV at your site. 30/50 amp pedestals, $15/night. Bring your own adapter."},
        {"icon":"📶","name":"Free Wi-Fi","desc":"Complimentary Wi-Fi for all registered guests. Stay connected, check email, and browse from your site."}
      ]
    $json$::jsonb)
    on conflict (section_id, key) do nothing;

  -- ----- COMMUNITY -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_html, value_image_url) values
    (v_sec_community, 'label', 'Section label', 'plain_text', 0, 'The Community', null, null),
    (v_sec_community, 'headline', 'Section headline', 'plain_text', 10, 'Guests who', null, null),
    (v_sec_community, 'headline_italic', 'Headline (italic)', 'plain_text', 20, 'extend their stay.', null, null),
    (v_sec_community, 'body_1', 'First paragraph', 'rich_text', 30, null,
     'Some guests book a week and stay twelve days. Some book a winter month and stay three. Some have been coming back every summer for generations.', null),
    (v_sec_community, 'body_2', 'Second paragraph', 'rich_text', 40, null,
     'This is a place that people extend. They come back. They invite friends. They sit out in the evening and watch the light leave the gorge, and they decide to stay.', null),
    (v_sec_community, 'image', 'Section image', 'image', 50, null, null, '/images/firepit_evening.jpg'),
    (v_sec_community, 'image_caption', 'Image caption', 'plain_text', 60, 'Evening at the rim', null, null)
    on conflict (section_id, key) do nothing;

  -- ----- REVIEWS -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_json) values
    (v_sec_reviews, 'label', 'Section label', 'plain_text', 0, 'Google Reviews', null),
    (v_sec_reviews, 'rating', 'Average rating', 'plain_text', 10, '5.0', null),
    (v_sec_reviews, 'reviews', 'Review cards', 'json', 20, null, $json$
      [
        {"stars":5,"quote":"I hesitate to give a positive review because I want to keep this place to myself! Since I can''t stay there every night, I suppose I''ll let other folks know! Great place, great amenities, highly recommend!","author":"Matt Bashaw","meta":"Vacation · Friends"},
        {"stars":5,"quote":"What a find! We loved it so much we stayed 11 extra nights! The campground is so pretty and peaceful. The sites are spacious and set among lovely juniper trees. Smells so good! Amazing views too! A great basecamp for Bend, Sisters, and Smith Rock +++.","author":"Karen McCarthy","meta":"Vacation · Family · Rooms 5/5 · Service 5/5 · Location 5/5"},
        {"stars":5,"quote":"Always a great stay at Crooked River Ranch! Caught a sunny weekend in March to get away, enjoy the hiking in the area. Love the ease of being able to book online now — we were able to drive in, pick our spot, and then book the one we wanted!","author":"Janell Wittrig","meta":"Vacation · Family · Service 5/5 · Location 5/5"}
      ]
    $json$::jsonb)
    on conflict (section_id, key) do nothing;

  -- ----- RESERVE -----
  insert into content_blocks (section_id, key, display_name, block_type, display_order, value_text, value_html) values
    (v_sec_reserve, 'label', 'Section label', 'plain_text', 0, 'Reservations', null),
    (v_sec_reserve, 'headline', 'Section headline', 'plain_text', 10, 'Your site', null),
    (v_sec_reserve, 'headline_italic', 'Headline (italic)', 'plain_text', 20, 'is waiting.', null),
    (v_sec_reserve, 'body', 'Body paragraph', 'rich_text', 30, null,
     'Book online in real time through our reservation system, or call the office if you have questions about site selection, rig fit, or winter monthly rates.')
    on conflict (section_id, key) do nothing;

end $$;

-- Mark migration applied (the migration runner does this automatically,
-- but we include it so manual SQL-Editor runs also track)
insert into _migrations (filename) values ('004_seed_home_content.sql')
  on conflict (filename) do nothing;
