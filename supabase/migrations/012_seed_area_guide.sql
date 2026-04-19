-- ==========================================================================
-- 012_seed_area_guide.sql — Initial data for destination-guide content
-- ==========================================================================
-- Seeds:
--   • trails           — the on-property canyon trail + well-known nearby trails
--   • things_to_do     — the full 60-item list grouped by persona category
--   • local_places     — a handful of restaurants/shops the owner called out
--                        (google_place_id values must be filled in by admin
--                        after the first "Refresh from Google" click)
--   • park_sites       — 109 placeholder rows (loops A-D). Admin fills in
--                        real dimensions/rates once collected.
--
-- All descriptions are intentionally short + generic. They're a scaffold,
-- NOT authoritative copy. The owner or a writer will refine them via the
-- admin UI. Trail difficulty + hazards especially warrant local review
-- before going live (liability).
-- ==========================================================================

-- Idempotency: each insert uses `on conflict do nothing` so re-running the
-- migration is safe.

-- ---- trails ---------------------------------------------------------------
-- Drive times + distances are approximations. Difficulty ratings are based
-- on publicly documented general consensus for these trails and MUST be
-- verified before relying on them for liability-sensitive guidance.

insert into trails (slug, name, summary, description, distance_miles, elevation_gain_feet, difficulty, pet_friendly, kid_friendly, hazards, trailhead_lat, trailhead_lng, parking_info, season, drive_time_from_park, is_on_property, display_order)
values
  (
    'crr-canyon-trail',
    'CRR Canyon Trail (on-property)',
    'Walk directly from your RV site down into the Crooked River canyon.',
    '<p>The trail begins right at the canyon-rim loops of Crooked River Ranch RV Park and descends into the gorge below. Steep in places with dramatic river views. No other RV park on the canyon rim has this.</p><p><strong>Please stay on trail</strong> — the canyon walls have loose basalt and drop-offs.</p>',
    null, null, 'moderate',
    true, true,
    array['steep_dropoffs', 'loose_rock', 'limited_shade'],
    44.3485, -121.2055,
    'Walk from your RV site — no separate parking needed.',
    'Year-round (avoid in snow/ice)',
    'On-property',
    true, 10
  ),
  (
    'misery-ridge-loop',
    'Misery Ridge Loop (Smith Rock)',
    'The iconic Smith Rock loop. Panoramic views of Monkey Face and the Crooked River.',
    '<p>A classic Central Oregon hike with some of the best canyon views in the state. The climb up Misery Ridge is steep but the summit views are world-class. The return via the River Trail passes directly below the famous Monkey Face climbing pillar.</p>',
    3.7, 1068, 'hard',
    true, false,
    array['steep_switchbacks', 'exposed_cliff_edges', 'heat_in_summer'],
    44.3683, -121.1387,
    'Smith Rock State Park day-use lot ($5/vehicle). Arrive before 9am on weekends.',
    'Year-round (hot in summer)',
    '15 min drive',
    false, 20
  ),
  (
    'smith-rock-river-trail',
    'Smith Rock River Trail',
    'The flat, family-friendly option at Smith Rock. Follows the Crooked River.',
    '<p>The River Trail hugs the Crooked River below the Smith Rock cliffs. Mostly flat, making it the best option for kids, older guests, or anyone wanting the Smith Rock views without the Misery Ridge climb. Great spot for watching climbers tackle Monkey Face from below.</p>',
    3.9, 270, 'easy',
    true, true,
    array['limited_shade', 'narrow_in_places'],
    44.3683, -121.1387,
    'Smith Rock State Park day-use lot ($5/vehicle).',
    'Year-round',
    '15 min drive',
    false, 30
  ),
  (
    'steelhead-falls',
    'Steelhead Falls',
    'A short hike to a cascading waterfall and natural swimming hole.',
    '<p>A rugged but relatively short trail that descends to Steelhead Falls. The natural swimming hole at the base is popular on summer afternoons. Footing is uneven in places — watch kids carefully near the water.</p>',
    1.5, 230, 'moderate',
    true, true,
    array['slippery_rocks_near_falls', 'unfenced_dropoffs'],
    44.4167, -121.3050,
    'Steelhead Falls trailhead lot, BLM (free).',
    'Year-round',
    '20 min drive',
    false, 40
  ),
  (
    'crooked-river-loop',
    'Crooked River Loop',
    'A 7-mile loop along the canyon rim. Challenging for trail runners.',
    '<p>A longer trail-run option with rolling canyon-rim terrain. Less developed than Smith Rock. Bring plenty of water — shade is minimal.</p>',
    7.0, 800, 'hard',
    true, false,
    array['limited_shade', 'navigation_required', 'rattlesnakes_in_summer'],
    44.3400, -121.2200,
    'Pull-off on BLM road.',
    'Year-round (shoulder seasons best)',
    '5 min drive',
    false, 50
  ),
  (
    'tam-a-lau-trail',
    'Tam-a-lau Trail (Cove Palisades)',
    'Climb to a high plateau for panoramic views of Lake Billy Chinook and the Cascades.',
    '<p>A steady uphill climb to a flat plateau with 360-degree views of three lakes, the Deschutes and Crooked River arms, and the Cascades on a clear day. One of the most rewarding viewpoints in Central Oregon.</p>',
    7.3, 1100, 'hard',
    true, false,
    array['exposed_summit', 'limited_shade', 'heat_in_summer'],
    44.5350, -121.3000,
    'Cove Palisades State Park (day-use fee).',
    'April–October',
    '35 min drive',
    false, 60
  )
on conflict (slug) do nothing;

-- ---- things_to_do ---------------------------------------------------------
-- Seeded directly from the owner's 60-item list. Items that have a dedicated
-- trail page link to it via external_link; most items are standalone.

insert into things_to_do (slug, title, summary, category, personas, location_name, distance_from_park, icon, display_order) values
  -- Families with Kids (1-10)
  ('swim-rv-pool',                  'Swim in the seasonal saltwater pool',            'Right at the RV park — families cool off all summer.',                   'families',       '{families,rvers}',         'Crooked River Ranch RV Park',  'On-property',       '🏊', 1),
  ('steelhead-swim',                'Jump into the Steelhead Falls swimming hole',    'The natural pool at the base of Steelhead Falls is a summer favorite.',  'families',       '{families,active}',        'Steelhead Falls',              '20 min drive',      '🏞', 2),
  ('cove-palisades-pontoon',        'Rent a pontoon boat at Cove Palisades',          'Family day on Lake Billy Chinook.',                                      'families',       '{families,active}',        'Cove Palisades State Park',    '35 min drive',      '⛵', 3),
  ('crescent-moon-alpacas',         'Feed alpacas at Crescent Moon Ranch',            'Friendly alpacas just down the road.',                                   'families',       '{families}',               'Crescent Moon Ranch',          '15 min drive',      '🦙', 4),
  ('lava-river-cave',               'Explore the Lava River Cave',                    'A mile-long lava tube in Deschutes National Forest.',                    'families',       '{families,active}',        'Deschutes National Forest',    '1 hr drive',        '🕳', 5),
  ('smith-rock-river-family',       'Hike the easy Smith Rock River Trail',           'Scenic and family-friendly — canyon views without the climb.',           'families',       '{families,active,dogs}',   'Smith Rock State Park',        '15 min drive',      '🥾', 6),
  ('pickleball-courts',             'Play tennis or pickleball at the park courts',   'On-site courts available to guests.',                                    'families',       '{families,rvers}',         'Crooked River Ranch RV Park',  'On-property',       '🎾', 7),
  ('richardsons-rock-ranch',        'Hunt geodes and thundereggs',                    'Rockhounding at Richardson''s Rock Ranch.',                               'families',       '{families,day_trippers}',  'Richardson''s Rock Ranch',      '45 min drive',      '💎', 8),
  ('high-desert-museum',            'Visit the High Desert Museum',                   'River otters, birds of prey, and Western history.',                      'families',       '{families,day_trippers}',  'High Desert Museum (Bend)',    '45 min drive',      '🦅', 9),
  ('stargazing-telescope',          'Stargaze from your RV site',                     'Light-pollution-free skies right at your site.',                         'families',       '{families,rvers,winter}',  'Crooked River Ranch RV Park',  'On-property',       '🔭', 10),

  -- Active & Outdoorsy (11-20)
  ('misery-ridge-hike',             'Hike Misery Ridge at Smith Rock',                'Steep climb, panoramic payoff.',                                         'active',         '{active}',                 'Smith Rock State Park',        '15 min drive',      '⛰', 11),
  ('watch-monkey-face-climbers',    'Watch climbers on Monkey Face',                  'World-class rock climbing, best viewed from the River Trail.',           'active',         '{active,families}',        'Smith Rock State Park',        '15 min drive',      '🧗', 12),
  ('climbing-lesson-smith-rock',    'Take a beginner climbing lesson',                'Guided lessons available at Smith Rock.',                                'active',         '{active}',                 'Smith Rock State Park',        '15 min drive',      '🧗‍♂️', 13),
  ('mountain-biking-terrebonne',    'Mountain bike the Terrebonne trail network',     'Extensive dirt trails nearby.',                                          'active',         '{active}',                 'Terrebonne / BLM lands',       '10 min drive',      '🚵', 14),
  ('steelhead-falls-hike',          'Hike down to Steelhead Falls',                   'Rugged trail to a cascading waterfall.',                                 'active',         '{active,families}',        'Steelhead Falls',              '20 min drive',      '💦', 15),
  ('crooked-river-fishing',         'Fish for trout in the Crooked River',            'Free fishing days are a great way to start.',                            'active',         '{active,rvers}',           'Crooked River',                'On-property / 5 min', '🎣', 16),
  ('lake-billy-chinook-paddle',     'Kayak or paddleboard Lake Billy Chinook',        'Steep canyon walls above deep blue water.',                              'active',         '{active}',                 'Lake Billy Chinook',           '35 min drive',      '🛶', 17),
  ('deschutes-flyfishing',          'Fly fish the Deschutes River',                   'Wild and scenic sections nearby.',                                       'active',         '{active}',                 'Lower Deschutes',              '30 min drive',      '🎣', 18),
  ('crooked-river-loop-run',        'Trail run the 7-mile Crooked River Loop',        'Rolling canyon-rim terrain.',                                            'active',         '{active}',                 'BLM near the ranch',           '5 min drive',       '🏃', 19),
  ('tam-a-lau-hike',                'Hike the Tam-a-lau Trail',                       'Climb to a high plateau with panoramic views.',                          'active',         '{active}',                 'Cove Palisades State Park',    '35 min drive',      '🗻', 20),

  -- RVers & Slow Travelers (21-30)
  ('crr-golf-course',               'Tee off 200 feet from your rig',                 'Crooked River Ranch Golf Course is literally next door.',                'rvers',          '{rvers,active}',           'Crooked River Ranch Golf',     'On-property',       '⛳', 21),
  ('golf-practice-green',           'Practice your short game',                       'Practice green adjacent to the course.',                                 'rvers',          '{rvers}',                  'Crooked River Ranch Golf',     'On-property',       '🏌', 22),
  ('golf-cart-scenic-drive',        'Drive a cart around the canyon-rim course',      '18 holes of Central Oregon scenery.',                                    'rvers',          '{rvers}',                  'Crooked River Ranch Golf',     'On-property',       '🛻', 23),
  ('reading-under-junipers',        'Read a book under the junipers',                 'Shade, quiet, and desert air.',                                          'rvers',          '{rvers}',                  'Your RV site',                 'On-property',       '📖', 24),
  ('outdoor-griddle-breakfast',     'Cook breakfast on your outdoor griddle',         'Big breakfasts with canyon views.',                                      'rvers',          '{rvers,food_community}',   'Your RV site',                 'On-property',       '🍳', 25),
  ('ev-charging',                   'Charge your EV at the site pedestal',            'Prep your vehicle for the next drive.',                                  'rvers',          '{rvers}',                  'Your RV site',                 'On-property',       '🔌', 26),
  ('park-wifi-stream',              'Stream from the park Wi-Fi',                     'Keep up with your shows in the desert.',                                 'rvers',          '{rvers}',                  'Your RV site',                 'On-property',       '📶', 27),
  ('sunset-rim-walk',               'Walk the canyon rim at sunset',                  'Loops A, B, C, and D all touch the rim.',                                'rvers',          '{rvers,families,dogs}',    'Crooked River Ranch RV Park',  'On-property',       '🌅', 28),
  ('park-bathhouse',                'Use the remodeled bathhouses',                   'Hot, free showers for guests.',                                          'rvers',          '{rvers}',                  'Crooked River Ranch RV Park',  'On-property',       '🚿', 29),
  ('do-nothing-campsite',           'Sit back and do absolutely nothing',             'The juniper air does the work for you.',                                 'rvers',          '{rvers}',                  'Your RV site',                 'On-property',       '🪑', 30),

  -- Dog Owners (31-35)
  ('park-dog-run',                  'Let dogs run at the on-site off-leash area',     'Dedicated dog run in the park.',                                         'dogs',           '{dogs,rvers}',             'Crooked River Ranch RV Park',  'On-property',       '🐕', 31),
  ('ranch-road-dog-walks',          'Walk dogs on quiet ranch roads',                 'Miles of expansive walking nearby.',                                     'dogs',           '{dogs,rvers}',             'Crooked River Ranch roads',    'On-property',       '🚶', 32),
  ('smith-rock-dog-trails',         'Smith Rock pet-friendly trails',                 'Many Smith Rock trails allow dogs on leash.',                            'dogs',           '{dogs,active}',            'Smith Rock State Park',        '15 min drive',      '🐾', 33),
  ('deschutes-dog-public-lands',    'Explore Deschutes National Forest with dogs',    'Vast public lands, pet-friendly.',                                       'dogs',           '{dogs,active}',            'Deschutes National Forest',    '30 min drive',      '🌲', 34),
  ('river-dog-splash',              'Let dogs splash in the river',                   'Shallow spots along the Crooked River in summer.',                       'dogs',           '{dogs,families}',          'Crooked River',                'On-property / 5 min', '💦', 35),

  -- Day Trippers & Sightseers (36-45)
  ('crater-lake-drive',             'Drive to Crater Lake National Park',             'Deep blue water in a volcanic caldera.',                                 'day_trippers',   '{day_trippers}',           'Crater Lake National Park',    '3 hr drive',        '🌋', 36),
  ('sisters-downtown',              'Stroll downtown Sisters',                        'Boutiques, bakeries, quilt shops.',                                      'day_trippers',   '{day_trippers,food_community}', 'Sisters, OR',           '35 min drive',      '🏘', 37),
  ('bend-brewery-tour',             'Brewery tour in Bend',                           'Crux, Deschutes, and many more.',                                        'day_trippers',   '{day_trippers,food_community}', 'Bend, OR',              '45 min drive',      '🍺', 38),
  ('peter-skene-ogden',             'Peter Skene Ogden State Scenic Viewpoint',       'Look straight down into the basalt gorge.',                              'day_trippers',   '{day_trippers,families}',  'Peter Skene Ogden SP',         '15 min drive',      '📸', 39),
  ('redmond-antiques',              'Shop antiques in downtown Redmond',              'Local boutiques and antiques.',                                          'day_trippers',   '{day_trippers}',           'Redmond, OR',                  '20 min drive',      '🛍', 40),
  ('cascade-lakes-scenic-byway',    'Drive the Cascade Lakes Scenic Byway',           'Mountain and alpine lake views.',                                        'day_trippers',   '{day_trippers}',           'Cascade Lakes (from Bend)',    '1 hr to start',     '🏔', 41),
  ('newberry-obsidian-flows',       'Explore Newberry Volcanic National Monument',    'Otherworldly obsidian flows and lava caves.',                            'day_trippers',   '{day_trippers,active}',    'Newberry National Monument',   '1.25 hr drive',     '🌋', 42),
  ('christmas-valley-drive',        'Drive to Christmas Valley',                      'Remote Oregon high-desert country.',                                     'day_trippers',   '{day_trippers}',           'Christmas Valley',             '2 hr drive',        '🌵', 43),
  ('crr-farmers-market',            'Visit the CRR farmers market + community events','Local goods and neighbors.',                                             'day_trippers',   '{day_trippers,food_community}', 'Crooked River Ranch Community','5 min drive',       '🧺', 44),
  ('terrebonne-depot',              'Shop the Terrebonne Depot',                      'Local goods, wine, and unique gifts.',                                   'day_trippers',   '{day_trippers,food_community}', 'Terrebonne, OR',        '10 min drive',      '🛒', 45),

  -- Winter & Off-Season (46-52)
  ('winter-camping',                'Winter RV camping with zero crowds',             'Quiet canyon rims in January and February.',                             'winter',         '{winter,rvers}',           'Crooked River Ranch RV Park',  'On-property',       '❄', 46),
  ('snowshoeing',                   'Snowshoe the nearby sno-parks',                  'Cascade sno-parks 45 min away.',                                         'winter',         '{winter,active}',          'Cascade sno-parks',            '45 min drive',      '🥾', 47),
  ('mt-bachelor-skiing',            'Ski or snowboard at Mt. Bachelor',               'World-class Cascade skiing.',                                            'winter',         '{winter,active}',          'Mt. Bachelor',                 '1.5 hr drive',      '⛷', 48),
  ('winter-astrophotography',       'Winter astrophotography from your site',         'Crisp, clear nights above the canyon.',                                  'winter',         '{winter,rvers}',           'Crooked River Ranch RV Park',  'On-property',       '📷', 49),
  ('canyon-to-yourself-winter',     'Have the canyon nearly to yourself',             'Winter solitude you won''t find in summer.',                             'winter',         '{winter,rvers}',           'Crooked River Ranch RV Park',  'On-property',       '🤫', 50),
  ('rig-gaming-session',            'Cozy in-rig gaming session',                     'Heater on, controllers out.',                                            'winter',         '{winter,rvers}',           'Your RV site',                 'On-property',       '🎮', 51),
  ('winter-guest-gatherings',       'Join winter community gatherings',               'Long-term guests host meetups when it''s quiet.',                        'winter',         '{winter,food_community}',  'Crooked River Ranch RV Park',  'On-property',       '🫶', 52),

  -- Food, Drink & Community (53-60)
  ('local-craft-beer',              'Grab local craft beer at ranch community bars',  'Oregon craft on tap.',                                                   'food_community', '{food_community}',         'Crooked River Ranch',          'On-property',       '🍺', 53),
  ('canyon-view-dining',            'Dinner at local canyon-view restaurants',        'Outdoor patios, local fare.',                                            'food_community', '{food_community,day_trippers}', 'Local dining',          '5-15 min drive',    '🍽', 54),
  ('campfire-stories',              'Host a Campfire Stories night',                  'Gas firepit + neighbors = instant community.',                           'food_community', '{food_community,rvers}',   'Your RV site',                 'On-property',       '🔥', 55),
  ('riverside-bbq',                 'Riverside BBQ at state park day-use areas',      'Grill with a river view.',                                               'food_community', '{food_community,families}', 'State park day-use',          '15-35 min drive',   '🍔', 56),
  ('smith-rock-picnic',             'Picnic at Smith Rock footbridge',                'Pack lunch and watch the river.',                                        'food_community', '{food_community,families}', 'Smith Rock State Park',        '15 min drive',      '🧺', 57),
  ('bend-coffee-roaster',           'Local coffee roaster in Bend',                   'Fresh beans for canyon mornings.',                                       'food_community', '{food_community,day_trippers}', 'Bend, OR',              '45 min drive',      '☕', 58),
  ('steaks-at-sunset',              'Grill steaks at your site as the light leaves',  'Evening glow on the gorge.',                                             'food_community', '{food_community,rvers}',   'Your RV site',                 'On-property',       '🥩', 59),
  ('group-site-potluck',            'Group-site potluck or team dinner',              'Reserve a group site, host a feast.',                                    'food_community', '{food_community,families}', 'Crooked River Ranch RV Park', 'On-property',       '🍽', 60)
on conflict (slug) do nothing;

-- ---- local_places ---------------------------------------------------------
-- Seeded as placeholders. Admin fills in google_place_id via the admin UI
-- after looking up each place in Google Maps. The cached_data stays null
-- until the first "Refresh from Google" click per place.

insert into local_places (slug, name_override, google_place_id, category, our_description, featured, display_order) values
  ('terrebonne-depot',        'Terrebonne Depot',              'TODO_PLACE_ID_terrebonne_depot',         'restaurant', 'Local goods, wine, and a place to grab a bite a few minutes from the park.', true, 10),
  ('crux-fermentation',       'Crux Fermentation Project',     'TODO_PLACE_ID_crux',                     'brewery',    'Bend destination brewery with a great outdoor lawn.',                         true, 20),
  ('deschutes-brewery',       'Deschutes Brewery',             'TODO_PLACE_ID_deschutes',                'brewery',    'Classic Bend brewery — wide beer selection.',                                 false, 30),
  ('crescent-moon-ranch',     'Crescent Moon Ranch',           'TODO_PLACE_ID_crescent_moon',            'attraction', 'Friendly alpacas just a few minutes from the park.',                          false, 40),
  ('smith-rock-state-park',   'Smith Rock State Park',         'TODO_PLACE_ID_smith_rock',               'attraction', 'World-class rock climbing + scenic trails, 15 minutes away.',                 true, 50)
on conflict (google_place_id) do nothing;

-- ---- park_sites -----------------------------------------------------------
-- 109 placeholder sites across 4 loops (A-D). Real dimensions/rates/photos
-- get filled in via the admin UI once the owner shares the site list.
-- Percentages below are evenly distributed placeholders so the map component
-- has *something* to render; the owner will drag sites to real positions.

do $$
declare
  loop_letter text;
  loop_count int;
  loop_max int;
  site_n int;
  site_total int := 0;
  -- 27 sites in A, 28 in B, 27 in C, 27 in D = 109 total
  site_counts int[] := array[27, 28, 27, 27];
  loops text[] := array['A', 'B', 'C', 'D'];
begin
  for i in 1..4 loop
    loop_letter := loops[i];
    loop_max := site_counts[i];
    for site_n in 1..loop_max loop
      site_total := site_total + 1;
      insert into park_sites (
        site_number, loop, pull_through, amp_service, site_type,
        nightly_rate, map_position_x, map_position_y, is_published
      ) values (
        loop_letter || '-' || lpad(site_n::text, 2, '0'),
        loop_letter,
        (site_n % 3 = 0),                              -- ~1/3 pull-through
        case when site_n % 5 = 0 then 50 else 30 end,  -- every 5th is 50-amp
        'standard',
        42.00,
        -- Rough even-spread placeholders: loop across x, row per loop
        ((site_n::numeric / loop_max) * 90 + 5)::numeric(5,2),
        (15 + (i - 1) * 22)::numeric(5,2),
        true
      )
      on conflict (site_number) do nothing;
    end loop;
  end loop;
end $$;
