// Legacy Astro -> Puck page_builder_data migration source.
//
// Each entry corresponds to a hand-coded .astro file under src/pages/. The
// page_builder_data.content array is consumed by /admin/builder/<slug> (Puck
// Visual Editor). Frontmatter (title, meta_description, canonical_url,
// og_image, hero_preload, schemas) is copied verbatim from the .astro file.
//
// Breadcrumbs strips from the legacy markup are intentionally dropped (post-V3
// the site no longer renders them). Anything that didn't map cleanly to a
// first-class Puck component was wrapped in an HtmlEmbed so the original HTML
// keeps rendering.

const FIREFLY_URL =
  'https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK';

export default [
  // ---------------------------------------------------------------------
  // 1. index.astro
  // Note: the live index page is DB-driven via PageRenderer; the .astro file
  // only ships a fallback hero for when Supabase has no sections. We still
  // migrate that single hero so the Visual Editor has a starting point.
  // ---------------------------------------------------------------------
  {
    slug: 'index',
    title:
      'Campground Near Smith Rock Oregon | Crooked River Ranch RV Park',
    meta_description:
      "Full hookup RV sites on Oregon's Crooked River canyon rim. 15 minutes from Smith Rock. Golf course adjacent, local dining nearby, open year-round. Big rig pull-throughs up to 65 feet. Book direct.",
    canonical_url: 'https://www.crookedriverranchrv.com/',
    og_image: 'https://www.crookedriverranchrv.com/images/hero.jpg',
    hero_preload: '/images/hero.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Campground',
        name: 'Crooked River Ranch RV Park',
        description:
          '113-site RV park on the canyon rim of the Crooked River Gorge in Central Oregon. Full hookups, pull-throughs to 65 feet, adjacent golf course, local dining nearby. 15 minutes from Smith Rock State Park. Open year-round.',
        url: 'https://www.crookedriverranchrv.com',
        telephone: '+1-541-923-1441',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '14875 SW Hays Lane',
          addressLocality: 'Terrebonne',
          addressRegion: 'OR',
          postalCode: '97760',
          addressCountry: 'US',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 44.3485,
          longitude: -121.2055,
        },
        checkinTime: '14:00',
        checkoutTime: '12:00',
        amenityFeature: [
          { '@type': 'LocationFeatureSpecification', name: 'Full Hookups', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Pull-Through Sites', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Swimming Pool', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Golf Course Adjacent', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Pet Friendly', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Local Dining Nearby', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Free Wi-Fi', value: true },
        ],
        priceRange: '$36-$62/night',
        image: 'https://www.crookedriverranchrv.com/images/hero.jpg',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '5.0',
          reviewCount: '200',
          bestRating: '5',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Crooked River Ranch RV Park',
        url: 'https://www.crookedriverranchrv.com',
        logo: 'https://www.crookedriverranchrv.com/images/hero.jpg',
        telephone: '+1-541-923-1441',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '14875 SW Hays Lane',
          addressLocality: 'Terrebonne',
          addressRegion: 'OR',
          postalCode: '97760',
          addressCountry: 'US',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 44.3485,
          longitude: -121.2055,
        },
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'index-hero',
          props: {
            eyebrow: 'Central Oregon · Open 365 Days',
            headlineLine1: 'Park near',
            headlineLine2Italic: 'the canyon.',
            subtitle:
              'Full hookup RV sites among juniper trees on the rim of the Crooked River Gorge.',
            backgroundImageUrl: '/images/hero.jpg',
            ctaPrimaryLabel: 'Reserve Your Site',
            ctaPrimaryUrl: FIREFLY_URL,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },

  // ---------------------------------------------------------------------
  // 2. golf-stays.astro
  // ---------------------------------------------------------------------
  {
    slug: 'golf-stays',
    title: 'Golf & RV Park Oregon | Tee Times from Your Campsite | CRR',
    meta_description:
      'Park your rig 200 feet from an 18-hole canyon course. Full hookup RV sites with discounted green fees at Crooked River Ranch in Central Oregon. Book your golf getaway.',
    canonical_url: 'https://www.crookedriverranchrv.com/golf-stays',
    og_image:
      'https://www.crookedriverranchrv.com/images/golf_aerial_canyon.jpg',
    hero_preload: '/images/golf_aerial_canyon.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Golf & RV Stay Package',
        description:
          'Park your rig 200 feet from an 18-hole canyon course. Full hookup RV sites with discounted green fees at Crooked River Ranch in Central Oregon.',
        url: 'https://www.crookedriverranchrv.com/golf-stays',
        brand: { '@type': 'Organization', name: 'Crooked River Ranch RV Park' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: '62',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: FIREFLY_URL,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.crookedriverranchrv.com/' },
          { '@type': 'ListItem', position: 2, name: 'Golf Stays', item: 'https://www.crookedriverranchrv.com/golf-stays' },
        ],
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'golf-stays-hero',
          props: {
            eyebrow: 'Golf Stays',
            headlineLine1: '200 feet from your rig',
            headlineLine2Italic: 'to the first tee.',
            subtitle:
              "Park your rig, grab your clubs, and walk to an 18-hole canyon course. No shuttle. No drive. Just golf and the gorge.",
            backgroundImageUrl: '/images/golf_aerial_canyon.jpg',
            ctaPrimaryLabel: 'Book Now',
            ctaPrimaryUrl: FIREFLY_URL,
            ctaSecondaryLabel: 'View Golf Course',
            ctaSecondaryUrl: '/golf-course',
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'golf-stays-notice',
          props: {
            code: `<div class="golf-notice">
  <div class="gn-heading">The golf course is independently managed.</div>
  <div class="gn-body">All tee times, green fees, lessons, tournaments, pro shop services, course conditions, and golf-related questions are handled directly by the Crooked River Ranch Golf Course — not the RV park office.</div>
  <div class="gn-contact">
    <a href="https://www.crookedriverranchgc.com" target="_blank" rel="noopener noreferrer">crookedriverranchgc.com →</a>
    <a href="tel:5419236343">541-923-6343 (Pro Shop)</a>
  </div>
</div>`,
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'golf-stays-why',
          props: {
            label: 'Why Golfers Choose CRR',
            headline: 'Walking distance to',
            headlineItalic: '18 holes.',
            body:
              '<p>Your RV hookup and the first tee are separated by 200 feet with a canyon view. No transportation headaches. No resort fees. Just you, your clubs, and the course. Park guests get $10 off 18 holes and $5 off 9 holes on green fees — a discount that applies every round, every day.</p><p>The course sits on the canyon rim and wraps around the RV Park, routed through junipers and sage with unrivaled views. Eighteen holes of golf the way it should be.</p>',
            image: '/images/aerial_aloop.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 1050,
          },
        },
        {
          type: 'SiteCardsSection',
          id: 'golf-stays-what-you-get',
          props: {
            label: 'What You Get',
            cards: [
              {
                label: 'Full Hookup + Golf Perks',
                name: 'Your Home Base',
                desc: 'Everything connected, everything close. Golf before breakfast, pool after rounds, local dining for the evening.',
                specsText:
                  "50/30 amp power, Full hookup, Pull-throughs to 65', $10 off 18 / $5 off 9, 🔌 EV charging available, Practice green access, Pro shop on property",
                price: '62',
                pricePer: '/night',
                featured: true,
              },
            ],
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'golf-stays-typical-trip',
          props: {
            label: 'A Typical Golf Trip',
            body:
              '<h3 style="font-size:1.3rem;margin-bottom:1rem;">Morning</h3><p>Roll out of your rig, grab coffee, and walk to the first tee. 7:30 am tee time on an empty course. The sun is hitting the far rim of the gorge.</p><h3 style="font-size:1.3rem;margin-top:2rem;margin-bottom:1rem;">Afternoon</h3><p>Back at the park by noon. Grab lunch at a nearby restaurant, then cool off in the saltwater pool. Sit by the gazebo and plan tomorrow\'s round.</p><h3 style="font-size:1.3rem;margin-top:2rem;margin-bottom:1rem;">Evening</h3><p>Dinner at a local restaurant, Oregon beer, canyon sunset. Then back to your base camp for an evening of relaxation.</p>',
            image: '/images/golf_bridge.jpg',
            imagePosition: 'right',
            imageWidth: 984,
            imageHeight: 984,
          },
        },
        {
          type: 'RatesTableSection',
          id: 'golf-stays-rates',
          props: {
            rows: [
              {
                name: 'Full Hookup',
                nightly: '$62',
                weekly: '$372',
                monthly: 'Call for pricing',
                notes: '50/30 amp options',
              },
            ],
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'golf-stays-rate-note',
          props: {
            code: `<div class="rate-note-box" style="max-width:900px;margin:0 auto;">Park guests get $10 off 18 holes, $5 off 9 holes on green fees. For current rates and tee times, visit <a href="https://www.crookedriverranchgc.com" target="_blank" rel="noopener noreferrer">crookedriverranchgc.com</a> or call <a href="tel:5419231441">541-923-1441</a>.</div>`,
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'golf-stays-cta',
          props: {
            headline: 'Ready to play?',
            body: '<p>Book your site and reserve your tee times today.</p>',
            ctaLabel: 'Reserve Your Site →',
            ctaUrl: FIREFLY_URL,
            darkBackground: true,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },

  // ---------------------------------------------------------------------
  // 3. golf-course.astro
  // ---------------------------------------------------------------------
  {
    slug: 'golf-course',
    title:
      'Crooked River Ranch Golf Course | 18-Hole Canyon Course Oregon',
    meta_description:
      '18-hole par 71 golf course on the rim of the Crooked River Gorge. 5,661 yards through juniper and sage. RV park guests get $10 off 18 holes. Walking distance from your site.',
    canonical_url: 'https://www.crookedriverranchrv.com/golf-course',
    og_image:
      'https://www.crookedriverranchrv.com/images/golf_aerial_canyon.jpg',
    hero_preload: '/images/golf_course.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'GolfCourse',
        name: 'Crooked River Ranch Golf Course',
        description:
          '18-hole par 71 canyon rim golf course in Central Oregon. 5,661 yards through juniper and sage with views into the Crooked River Gorge.',
        url: 'https://www.crookedriverranchgc.com',
        telephone: '541-923-1441',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '5195 SW Clubhouse Rd',
          addressLocality: 'Crooked River Ranch',
          addressRegion: 'OR',
          postalCode: '97760',
          addressCountry: 'US',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 44.3286,
          longitude: -121.2137,
        },
        numberOfHoles: 18,
        courseLength: '5661 yards',
        openingHours: 'Mo-Su',
        isAccessibleForFree: false,
        priceRange: '$25-$80',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.crookedriverranchrv.com/' },
          { '@type': 'ListItem', position: 2, name: 'Golf Course', item: 'https://www.crookedriverranchrv.com/golf-course' },
        ],
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'golf-course-hero',
          props: {
            eyebrow: 'The Course',
            headlineLine1: '18 holes on the',
            headlineLine2Italic: 'canyon rim.',
            subtitle:
              'A nationally recognized course you can walk to from your RV site. Canyon views on every hole.',
            backgroundImageUrl: '/images/golf_course.jpg',
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'golf-course-notice',
          props: {
            code: `<div class="golf-notice">
  <div class="gn-heading">The golf course is independently managed.</div>
  <div class="gn-body">All tee times, green fees, lessons, tournaments, pro shop services, course conditions, and golf-related questions are handled directly by the Crooked River Ranch Golf Course — not the RV park office.</div>
  <div class="gn-contact">
    <a href="https://www.crookedriverranchgc.com" target="_blank" rel="noopener noreferrer">crookedriverranchgc.com →</a>
    <a href="tel:5419236343">541-923-6343 (Pro Shop)</a>
  </div>
</div>`,
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'golf-course-gorge',
          props: {
            label: 'The Course',
            headline: 'Golf on the',
            headlineItalic: 'gorge.',
            body:
              '<p>The Crooked River Ranch Golf Course is an 18-hole championship layout built into the landscape of the canyon rim. Par 71, 5,661 yards, the course was designed to work with the natural terrain—elevation changes, juniper stands, and desert rock formations—rather than against it.</p><p>Gorgeous views with some play directly over the canyon, with the river visible below. Others work through juniper groves and sage meadows, with the ridgelines and opposing canyon wall as the backdrop. This is not a course built in a flat field. It\'s built on a mesa, with the canyon as your boundary.</p><p>The greens are well-maintained and quick. The fairways vary in width and complexity. The course is accessible to mid-range players but demands respect from any level. Local knowledge helps—there are lines and breaks that reveal themselves over multiple plays.</p>',
            image: '/images/golf_aerial_canyon.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 1049,
          },
        },
        {
          type: 'TextBlock',
          id: 'golf-course-fees',
          props: {
            label: 'Green Fees & Guest Rates',
            headline: 'Park guests get <em>discounted green fees.</em>',
            body:
              '<p>Crooked River Ranch RV Park guests receive $10 off 18 holes and $5 off 9 holes from standard guest rates. This discount applies year-round and is a standing benefit of booking a site at the park.</p><p>For current green fees, cart rental rates, and tee time reservations, contact the pro shop directly: <strong><a href="tel:5419236343">541-923-6343</a></strong> or visit <strong><a href="https://www.crookedriverranchgc.com" target="_blank" rel="noopener noreferrer">crookedriverranchgc.com</a></strong>. The pro shop can schedule tee times, provide course conditions, and answer questions about walking vs. cart play, course layout, and seasonal conditions.</p>',
            alignment: 'left',
            maxWidth: 'medium',
          },
        },
        {
          type: 'TextBlock',
          id: 'golf-course-walking',
          props: {
            label: 'Walking Distance',
            headline:
              '200 feet from your RV site to the <em>first tee.</em>',
            body:
              '<p>Morning golf is walking distance from your front door, so you can walk to the course in two to three minutes. No shuttle. No car needed. Grab your bag and walk to golf.</p><p>So you can play 18 holes early in the morning, return to your site for lunch, and plan your afternoon around canyon activities. Or play in the late afternoon and catch the sunset from the 18th green.</p>',
            alignment: 'left',
            maxWidth: 'medium',
          },
        },
        {
          type: 'TextBlock',
          id: 'golf-course-amenities',
          props: {
            label: 'Amenities',
            headline: 'Everything you need at the <em>pro shop.</em>',
            body:
              "<p><strong>Equipment Rental:</strong> Clubs are available for rental if you don't want to travel with a full set. Standard equipment packages and individual club rental options are available.</p><p><strong>Cart & Pull Cart Rental:</strong> Golf carts and pull carts are available for those who prefer not to walk. Rates are reasonable, and carts can accommodate two players and gear.</p><p><strong>Practice Facilities:</strong> Driving range and chipping areas allow warm-up and practice before your round. Short-game practice is essential for scoring, and the facilities support it.</p><p><strong>Tee Time Scheduling:</strong> The pro shop handles reservations and can coordinate group play, leagues, and special events. They can also recommend courses and plan golf trips to nearby courses if you want to play multiple rounds during your stay.</p><p><strong>Course Conditions:</strong> The pro shop staff provides up-to-date information on course conditions, difficulty ratings, and course strategy. Ask about pin positions, recent weather impacts, and the best times to play.</p><p><strong>Pace of Play:</strong> Course management is attentive to pace. Groups move efficiently. Walking 18 holes takes about four to four-and-a-half hours. Cart play is quicker.</p><p><strong>Season:</strong> The course operates year-round. Winter play is possible on clear days, when the high desert dries out quickly after snow. Summer heat can be intense at midday; early morning or late afternoon tee times are popular.</p>",
            alignment: 'left',
            maxWidth: 'medium',
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'golf-course-getaway-cta',
          props: {
            headline: 'Make it a golf getaway.',
            body:
              '<p>A single round of golf is a half-day activity. Pair it with hiking, fly fishing, Dining, or visiting Smith Rock, or exploring the brewery scene in Bend, and you have a full-day itinerary. Stay multiple days and play multiple rounds—the course plays differently in different light and conditions.</p>',
            ctaLabel: 'Book Your Golf Stay →',
            ctaUrl: FIREFLY_URL,
            darkBackground: false,
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'golf-course-final-cta',
          props: {
            headline:
              'Book your canyon rim site, walk to the course.',
            body:
              '<p>RV park guests get $10 off 18 holes and $5 off 9 holes. Full hookups from $62/night. Open year-round.</p>',
            ctaLabel: 'Reserve Your Site →',
            ctaUrl: FIREFLY_URL,
            darkBackground: true,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },

  // ---------------------------------------------------------------------
  // 4. group-sites.astro
  // ---------------------------------------------------------------------
  {
    slug: 'group-sites',
    title:
      'Group Camping Central Oregon | Reunion & Group RV Sites | CRR',
    meta_description:
      'Book group RV sites at Crooked River Ranch. Reunions, guys trips, and club rallies on the canyon rim. Adjacent sites, full hookups, golf, dining, pool.',
    canonical_url: 'https://www.crookedriverranchrv.com/group-sites',
    og_image: 'https://www.crookedriverranchrv.com/images/family_reunion.jpg',
    hero_preload: '/images/family_reunion.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Group RV Sites',
        description:
          'Book group RV sites at Crooked River Ranch. Reunions, club rallies, and group camping on the canyon rim with adjacent full hookup sites, golf, pool, and dining.',
        url: 'https://www.crookedriverranchrv.com/group-sites',
        brand: { '@type': 'Organization', name: 'Crooked River Ranch RV Park' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: '62',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: FIREFLY_URL,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.crookedriverranchrv.com/' },
          { '@type': 'ListItem', position: 2, name: 'Group Sites', item: 'https://www.crookedriverranchrv.com/group-sites' },
        ],
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'group-sites-hero',
          props: {
            eyebrow: 'Group Sites',
            headlineLine1: 'Your whole crew.',
            headlineLine2Italic: 'One canyon.',
            subtitle:
              "Adjacent full hookup sites for reunions, rallies, and the trip you've been talking about for years.",
            backgroundImageUrl: '/images/family_reunion.jpg',
            ctaPrimaryLabel: 'Book Group Sites',
            ctaPrimaryUrl: FIREFLY_URL,
            ctaSecondaryLabel: 'Call to Coordinate',
            ctaSecondaryUrl: 'tel:5419231441',
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'group-sites-why',
          props: {
            label: 'Why Groups Love CRR',
            headline: 'Park together.',
            headlineItalic: 'Stay connected.',
            body:
              "<p>You can book adjacent sites so your group stays connected. Subject to availability so book early! (many guests book a year in advance). The saltwater pool, gazebo, courts, and nearby restaurants are all steps away. Whether it's a family reunion, annual guys trip, or RV club rally, you've got space to gather and amenities to enjoy together.</p><p>The canyon setting keeps the vibe calm and focused on what matters—time with people you picked to be here. No anonymous campground crowds. It's your group, your sites, your trip.</p>",
            image: '/images/gazebo_fall.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 1050,
          },
        },
        {
          type: 'SiteCardsSection',
          id: 'group-sites-types',
          props: {
            label: 'Group Types We Host',
            cards: [
              {
                label: 'Family Reunions',
                name: 'Multigenerational Gatherings',
                desc: 'Book 5 to 20 sites for the whole family. Pool for the kids, golf for the adults, local restaurants for shared meals. Gazebo gives you a covered gathering space right on property.',
                specsText:
                  'Pool for kids, Golf for adults, Gazebo gathering, Group rates',
                featured: true,
              },
              {
                label: 'Annual Guys Trips',
                name: 'Your Tradition Spot',
                desc: "Golf in the morning, local restaurants for lunch and dinner, and your RVs close by. Same group, same spots every year. We'll hold your sites once you've booked a few times.",
                specsText:
                  'Golf course access, Reserved same sites, Dining nearby, Adjacent layout',
                featured: true,
              },
              {
                label: 'RV Club Rallies',
                name: 'Organized Club Events',
                desc: 'We accommodate organized club events with group site rates and reserved amenity access. Call the office to discuss group dates and special arrangements.',
                specsText:
                  'Group rates, Reserved amenities, Adjacent sites, Flexible dates',
                featured: true,
              },
              {
                label: 'Corporate Retreats',
                name: 'Team Recharge',
                desc: 'Bring your team for a working retreat on the canyon rim. Full hookups, meeting space, and amenities that let people recharge between sessions.',
                specsText:
                  'Full hookups, Retreat setting, Amenity access, Group coordination',
                featured: true,
              },
            ],
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'group-sites-included',
          props: {
            label: "What's Included",
            body:
              '<h3 style="margin-bottom:1rem;">Full Hookup Sites</h3><p>50-amp and 30-amp power. Full water and sewer. Pull-throughs up to 65 feet. No separate fees for group sites—just book the nights you need.</p><h3 style="margin-top:2rem;margin-bottom:1rem;">Amenities for Groups</h3><ul style="margin-left:1.5rem;line-height:1.8;"><li>Saltwater pool (seasonal)</li><li>Gazebo and picnic areas</li><li>Tennis and pickleball courts</li><li>Playground for kids</li><li>Golf course (group rates available)</li><li>Local restaurants for food and drinks</li><li>Dog run for pets</li></ul><h3 style="margin-top:2rem;margin-bottom:1rem;">Group Perks</h3><p>Discounted group rates on nightly hookup fees. Guaranteed adjacent site layout. Golf course green fee discounts for groups. Reserved amenity access during peak times.</p>',
            image: '/images/pool_aerial.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 1050,
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'group-sites-how-to-book',
          props: {
            label: 'How to Book',
            body:
              '<h3 style="font-size:1.2rem;margin-bottom:1rem;">Call to Book Group Sites</h3><p>When you call <a href="tel:5419231441">541-923-1441</a>, we can:</p><ul style="margin-left:1.5rem;margin-top:1rem;line-height:1.8;"><li>Map out adjacent site options for your group size</li><li>Confirm dates and hold sites while you coordinate</li><li>Arrange gazebo or amenity reservations</li><li>Answer questions about group logistics</li></ul><p style="margin-top:1.5rem;"><a href="/book-now#park-map" style="color:var(--rust);font-weight:500;text-decoration:none;">View the Park Map →</a> to see how loops and sites connect for group planning.</p><h3 style="font-size:1.2rem;margin-top:2rem;margin-bottom:1rem;">Or Book Individual Sites Online</h3><p>You can also reserve sites directly through our booking system if you prefer to coordinate the group details on your end. Just note your group affiliation in the reservation notes.</p>',
            image: '/images/aerial_canyon_rim.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 1050,
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'group-sites-cta',
          props: {
            headline: 'Ready to rally your crew?',
            body: "<p>Let's get your group trip on the calendar.</p>",
            ctaLabel: 'Book Group Sites →',
            ctaUrl: FIREFLY_URL,
            darkBackground: true,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },

  // ---------------------------------------------------------------------
  // 5. extended-stays.astro
  // The long Netlify monthly-application form is kept verbatim inside an
  // HtmlEmbed since it's a bespoke, Netlify-wired form with ~50 fields that
  // no current Puck component models.
  // ---------------------------------------------------------------------
  {
    slug: 'extended-stays',
    title: 'Monthly RV Sites Oregon | Winter Extended Stays | CRR',
    meta_description:
      'Winter monthly RV sites from $850/month at Crooked River Ranch. Full hookups on the canyon rim, open October through April. The quiet season that keeps full-timers coming back.',
    canonical_url:
      'https://www.crookedriverranchrv.com/extended-stays',
    og_image: 'https://www.crookedriverranchrv.com/images/winter_sunset.jpg',
    hero_preload: '/images/winter_sunset.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Monthly RV Sites',
        description:
          'Winter monthly RV sites from $850/month at Crooked River Ranch. Full hookups on the canyon rim, open November through April.',
        url: 'https://www.crookedriverranchrv.com/extended-stays',
        brand: { '@type': 'Organization', name: 'Crooked River Ranch RV Park' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: '850',
          unitText: 'MONTH',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://www.crookedriverranchrv.com/extended-stays#monthly-form',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.crookedriverranchrv.com/' },
          { '@type': 'ListItem', position: 2, name: 'Extended Stays', item: 'https://www.crookedriverranchrv.com/extended-stays' },
        ],
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'extended-stays-hero',
          props: {
            eyebrow: 'Extended Stays',
            headlineLine1: 'Stay the',
            headlineLine2Italic: 'whole season.',
            subtitle:
              'Winter monthly sites $850/month, October through April. Full hookups, canyon quiet, and the kind of off-season that guests never want to leave.',
            backgroundImageUrl: '/images/winter_sunset.jpg',
            ctaPrimaryLabel: 'Apply for Monthly',
            ctaPrimaryUrl: '#monthly-form',
            ctaSecondaryLabel: 'Call the Office',
            ctaSecondaryUrl: 'tel:5419231441',
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'extended-stays-why',
          props: {
            label: 'Why Extended Stayers Choose CRR',
            headline: 'Calm winters.',
            headlineItalic: 'Open year-round.',
            body:
              "<p>October through April, when most parks close down, we stay open. You get a month or more of canyon quiet—no summer crowds, fewer day-use vehicles, the kind of peace that full-timers seek. Full hookups mean you don't trade comfort for off-season rates.</p>",
            image: '/images/canyon_day.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 1050,
          },
        },
        {
          type: 'RatesTableSection',
          id: 'extended-stays-rates',
          props: {
            label: 'Monthly Rates',
            headline: 'Winter pricing for extended stays.',
            rows: [
              { name: 'Full Hookup', nightly: '$62', weekly: '$372', monthly: '$850', notes: '' },
              { name: 'Water & Electric', nightly: '$57', weekly: '$342', monthly: '—', notes: '' },
              { name: 'Property Owner Monthly', nightly: '—', weekly: '—', monthly: '$800', notes: '' },
            ],
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'extended-stays-rate-note',
          props: {
            code: `<div class="rate-note-box" style="max-width:900px;margin:0 auto;">
  <p><strong>Monthly rates are October 1 – April 30 only.</strong> Rates exclude tax. $6 reservation fee per booking. Call <a href="tel:5419231441">541-923-1441</a> to discuss multi-month stays or returning-guest availability.</p>
</div>`,
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'extended-stays-winter',
          props: {
            label: 'What Winter Looks Like Here',
            headline: 'Canyon quiet, clear skies,',
            headlineItalic: 'and golf.',
            body:
              "<p>Summer brings hikers, day-use visitors, and occasional overflow from nearby attractions. Winter empties out. The canyon belongs to the people who live here—and you.</p><h3>Canyon Quiet</h3><p>Summer brings hikers, day-use visitors, and occasional overflow from nearby attractions. Winter empties out. The canyon belongs to the people who live here—and you.</p><h3>Clear Skies & Stargazing</h3><p>Central Oregon's elevation and low humidity make winter skies exceptional. Bring binoculars or just sit outside and watch. The Milky Way is visible on clear nights without needing a telescope.</p><h3>Golf Still Accessible</h3><p>The course doesn't close. Snow is rare, and when it comes, it melts fast. Winter golf here means rounds without the summer crowds, often on the same day you saw the morning frost.</p><h3>Dining & Community</h3><p>Local restaurants and bars in the community stay open year-round. You'll see the same faces week to week—other extended stayers, staff, locals who know the canyon well. It's how friendships form.</p>",
            image: '/images/winter_sunset.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 1050,
          },
        },
        {
          type: 'TextBlock',
          id: 'extended-stays-timeline',
          props: {
            label: 'Application & Timeline',
            headline:
              'How to apply for <em>your monthly site.</em>',
            body:
              "<p>Designed for the remote worker and the nomad alike. October and November monthly slots start booking by August. If you know you're coming, call ahead to pick your site.</p><p><strong>Step 1: Call the Office</strong> — Reach out to <a href=\"tel:5419231441\">541-923-1441</a> to discuss your dates and site preferences. Let us know if you're returning or new.</p><p><strong>Step 2: Reserve Your Site</strong> — We'll hold a site while you finalize dates. Deposit required to secure your booking.</p><p><strong>Step 3: Complete Application</strong> — Standard application process. We ask for driver info, emergency contact, and acknowledgment of park rules.</p><p><strong>Step 4: Move In</strong> — Check-in is 2 pm. Check-out is 12 pm. You're home for the season.</p>",
            alignment: 'left',
            maxWidth: 'medium',
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'extended-stays-form',
          props: {
            code: `<section>
  <div class="container">
    <span class="section-label">Apply Online</span>
    <h2 class="st">Monthly stay <em>application.</em></h2>
    <p class="section-body">Fill out this form to start your monthly application. We'll follow up within 1–2 business days to confirm availability and next steps.</p>

    <div class="form-notice">
      <strong>Before you apply, please note:</strong>
      <ul>
        <li>All RVs must be <strong>no more than 10 years old</strong>. Older RVs may be accepted on a case-by-case basis with an in-person inspection and must be in very good condition.</li>
        <li>All monthly applicants are required to provide <strong>proof of RV insurance</strong> before check-in.</li>
        <li>Monthly stays run <strong>November 1 through April 30</strong> each year. All monthly guests must vacate by April 30.</li>
        <li>A background check will be conducted as part of the application process.</li>
        <li>Maximum <strong>3 occupants</strong> per RV, <strong>2 pets</strong>, and <strong>2 vehicles</strong>.</li>
      </ul>
    </div>

    <form class="res-form" id="monthly-form" name="monthly-application" action="/extended-stays" method="POST" data-netlify="true" data-netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="monthly-application">
      <p style="display:none;"><label>Don't fill this out: <input name="bot-field"></label></p>

      <h3>Applicant Information</h3>
      <div class="fr">
        <div class="fg"><label for="monthly_first_name">First Name</label><input id="monthly_first_name" type="text" name="first_name" required></div>
        <div class="fg"><label for="monthly_last_name">Last Name</label><input id="monthly_last_name" type="text" name="last_name" required></div>
      </div>
      <div class="fg"><label for="monthly_email">Email</label><input id="monthly_email" type="email" name="email" required></div>
      <div class="fg"><label for="monthly_phone">Phone</label><input id="monthly_phone" type="tel" name="phone" required></div>
      <div class="fg"><label for="monthly_address">Mailing Address</label><input id="monthly_address" type="text" name="mailing_address" placeholder="Street, City, State, ZIP" required></div>
      <div class="fg"><label for="monthly_dob">Date of Birth</label><input id="monthly_dob" type="date" name="date_of_birth" required></div>
      <div class="fg">
        <label for="monthly_returning">Have you stayed at CRR before?</label>
        <select id="monthly_returning" name="returning_guest">
          <option value="No">No — first time</option>
          <option value="Yes">Yes — returning guest</option>
        </select>
      </div>

      <div class="form-section-label">Stay Details</div>
      <div class="fr">
        <div class="fg"><label for="monthly_movein">Requested Move-In Date</label><input id="monthly_movein" type="date" name="move_in_date" required></div>
        <div class="fg"><label for="monthly_moveout">Requested Move-Out Date</label><input id="monthly_moveout" type="date" name="move_out_date" required></div>
      </div>

      <div class="form-section-label">RV Information</div>
      <div class="form-row-3">
        <div class="fg"><label for="monthly_rv_year">Year</label><input id="monthly_rv_year" type="number" name="rv_year" min="1990" max="2027" placeholder="e.g. 2020" required></div>
        <div class="fg"><label for="monthly_rv_make">Make</label><input id="monthly_rv_make" type="text" name="rv_make" placeholder="e.g. Winnebago" required></div>
        <div class="fg"><label for="monthly_rv_model">Model</label><input id="monthly_rv_model" type="text" name="rv_model" placeholder="e.g. View 24D" required></div>
      </div>
      <div class="fr">
        <div class="fg"><label for="monthly_rv_length">RV Length (feet)</label><input id="monthly_rv_length" type="number" name="rv_length" min="10" max="65" placeholder="e.g. 35" required></div>
        <div class="fg"><label for="monthly_rv_age">Age of RV (years)</label><input id="monthly_rv_age" type="number" name="rv_age" min="0" max="50" placeholder="e.g. 4" required></div>
      </div>
      <div class="fg">
        <label for="monthly_rig_type">Rig Type</label>
        <select id="monthly_rig_type" name="rig_type" required>
          <option value="">Select your rig</option>
          <option>Class A Motorhome (up to 40')</option>
          <option>Class A Motorhome (40'–65')</option>
          <option>Class B Motorhome</option>
          <option>Class C Motorhome</option>
          <option>5th Wheel (back-in)</option>
          <option>5th Wheel (pull-through)</option>
          <option>Travel Trailer</option>
          <option>Van / Truck Camper</option>
        </select>
      </div>
      <div class="fg">
        <label for="monthly_rv_insurance">RV Insurance Provider</label>
        <input id="monthly_rv_insurance" type="text" name="rv_insurance" placeholder="Provider name — proof required before check-in" required>
      </div>

      <div class="form-section-label">Occupants (max 3)</div>
      <div class="fg"><label for="monthly_occupant1">Occupant 1 (Applicant)</label><input id="monthly_occupant1" type="text" name="occupant_1" placeholder="Full name, age, relationship" required></div>
      <div class="fg"><label for="monthly_occupant2">Occupant 2</label><input id="monthly_occupant2" type="text" name="occupant_2" placeholder="Full name, age, relationship (leave blank if N/A)"></div>
      <div class="fg"><label for="monthly_occupant3">Occupant 3</label><input id="monthly_occupant3" type="text" name="occupant_3" placeholder="Full name, age, relationship (leave blank if N/A)"></div>

      <div class="form-section-label">Pets (max 2)</div>
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:.85rem;">Leave this section blank if you have no pets.</p>

      <div class="pet-block">
        <h4>Pet 1</h4>
        <div class="fr">
          <div class="fg"><label for="monthly_pet1_name">Name</label><input id="monthly_pet1_name" type="text" name="pet_1_name" placeholder="Pet's name"></div>
          <div class="fg"><label for="monthly_pet1_breed">Breed</label><input id="monthly_pet1_breed" type="text" name="pet_1_breed" placeholder="e.g. Labrador Mix"></div>
        </div>
        <div class="form-row-3">
          <div class="fg"><label for="monthly_pet1_weight">Weight (lbs)</label><input id="monthly_pet1_weight" type="number" name="pet_1_weight" min="1" max="200" placeholder="e.g. 45"></div>
          <div class="fg"><label for="monthly_pet1_age">Age</label><input id="monthly_pet1_age" type="text" name="pet_1_age" placeholder="e.g. 3 years"></div>
          <div class="fg"><label for="monthly_pet1_sex">Sex</label>
            <select id="monthly_pet1_sex" name="pet_1_sex">
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
        </div>
        <div class="inline-checks">
          <label class="inline-check"><input type="checkbox" name="pet_1_fixed" value="Yes"> Spayed / Neutered</label>
          <label class="inline-check"><input type="checkbox" name="pet_1_vaccinated" value="Yes"> Vaccinations Up to Date</label>
        </div>
      </div>

      <div class="pet-block">
        <h4>Pet 2</h4>
        <div class="fr">
          <div class="fg"><label for="monthly_pet2_name">Name</label><input id="monthly_pet2_name" type="text" name="pet_2_name" placeholder="Pet's name"></div>
          <div class="fg"><label for="monthly_pet2_breed">Breed</label><input id="monthly_pet2_breed" type="text" name="pet_2_breed" placeholder="e.g. German Shepherd"></div>
        </div>
        <div class="form-row-3">
          <div class="fg"><label for="monthly_pet2_weight">Weight (lbs)</label><input id="monthly_pet2_weight" type="number" name="pet_2_weight" min="1" max="200" placeholder="e.g. 60"></div>
          <div class="fg"><label for="monthly_pet2_age">Age</label><input id="monthly_pet2_age" type="text" name="pet_2_age" placeholder="e.g. 5 years"></div>
          <div class="fg"><label for="monthly_pet2_sex">Sex</label>
            <select id="monthly_pet2_sex" name="pet_2_sex">
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
        </div>
        <div class="inline-checks">
          <label class="inline-check"><input type="checkbox" name="pet_2_fixed" value="Yes"> Spayed / Neutered</label>
          <label class="inline-check"><input type="checkbox" name="pet_2_vaccinated" value="Yes"> Vaccinations Up to Date</label>
        </div>
      </div>

      <div class="consent-box" style="margin-top:0;">
        <p><strong>Pet Owner Declaration</strong></p>
        <p style="margin-top:.4rem;">I declare that my pet(s) are not aggressive and do not have a history of biting, attacking, or threatening people or other animals. I understand and accept that:</p>
        <ul>
          <li>I am solely <strong>responsible for my pet(s)</strong> and any behavioral issues that may occur during my stay, including but not limited to attacks on other animals or people, running off-leash outside designated areas, excessive barking, or property damage.</li>
          <li>I will be <strong>liable for any damages, injuries, or costs</strong> caused by my pet(s) to other guests, their pets, park property, or staff.</li>
          <li>If my pet becomes a <strong>nuisance</strong> — including excessive barking, aggressive behavior, running loose, or any other disturbance — management reserves the right to <strong>require my immediate departure</strong> from the park.</li>
          <li>Pets must be <strong>leashed at all times</strong> outside the designated off-leash dog area.</li>
        </ul>
        <label class="consent-check">
          <input type="checkbox" name="pet_consent" value="Yes">
          <span>I acknowledge and agree to the pet policy above. (Required if bringing pets.)</span>
        </label>
      </div>

      <div class="form-section-label">Vehicles (max 2)</div>
      <div class="fg"><label for="monthly_vehicle1">Vehicle 1</label><input id="monthly_vehicle1" type="text" name="vehicle_1" placeholder="Year, make, model, license plate" required></div>
      <div class="fg"><label for="monthly_vehicle2">Vehicle 2</label><input id="monthly_vehicle2" type="text" name="vehicle_2" placeholder="Year, make, model, license plate (leave blank if N/A)"></div>

      <div class="form-section-label">Housing / Rental History (past 3 years)</div>
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:.85rem;">List your most recent housing — whether that was an RV park, rental home, apartment, or a home you owned.</p>

      <div class="history-block">
        <h4>Most Recent Residence (required)</h4>
        <div class="fg"><label for="monthly_hist1_addr">Address or Park Name</label><input id="monthly_hist1_addr" type="text" name="history_1_address" placeholder="e.g. Sunset RV Park, Bend, OR or 123 Main St, Portland, OR" required></div>
        <div class="fr">
          <div class="fg"><label for="monthly_hist1_dates">Dates (from – to)</label><input id="monthly_hist1_dates" type="text" name="history_1_dates" placeholder="e.g. Jan 2024 – Present" required></div>
          <div class="fg"><label for="monthly_hist1_type">Type</label>
            <select id="monthly_hist1_type" name="history_1_type" required>
              <option value="">Select</option>
              <option>RV Park / Campground</option>
              <option>Rental (house / apartment)</option>
              <option>Owned Home</option>
              <option>Staying with Family / Friends</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div class="fg"><label for="monthly_hist1_reason">Reason for Leaving</label><input id="monthly_hist1_reason" type="text" name="history_1_reason" placeholder="e.g. Seasonal closure, sold home, relocating for work, etc." required></div>
        <div class="fg"><label for="monthly_hist1_contact">Landlord / Manager Name</label><input id="monthly_hist1_contact" type="text" name="history_1_contact_name" placeholder="Name (enter N/A if you owned the property)"></div>
        <div class="fr">
          <div class="fg"><label for="monthly_hist1_phone">Landlord Phone</label><input id="monthly_hist1_phone" type="tel" name="history_1_contact_phone" placeholder="Phone number"></div>
          <div class="fg"><label for="monthly_hist1_email">Landlord Email</label><input id="monthly_hist1_email" type="email" name="history_1_contact_email" placeholder="Email (if known)"></div>
        </div>
      </div>

      <div class="history-block">
        <h4>Previous Residence</h4>
        <div class="fg"><label for="monthly_hist2_addr">Address or Park Name</label><input id="monthly_hist2_addr" type="text" name="history_2_address" placeholder="e.g. Mountain View Apartments, Redmond, OR"></div>
        <div class="fr">
          <div class="fg"><label for="monthly_hist2_dates">Dates (from – to)</label><input id="monthly_hist2_dates" type="text" name="history_2_dates" placeholder="e.g. Mar 2022 – Dec 2023"></div>
          <div class="fg"><label for="monthly_hist2_type">Type</label>
            <select id="monthly_hist2_type" name="history_2_type">
              <option value="">Select</option>
              <option>RV Park / Campground</option>
              <option>Rental (house / apartment)</option>
              <option>Owned Home</option>
              <option>Staying with Family / Friends</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div class="fg"><label for="monthly_hist2_reason">Reason for Leaving</label><input id="monthly_hist2_reason" type="text" name="history_2_reason" placeholder="e.g. End of lease, moved closer to family, etc."></div>
        <div class="fg"><label for="monthly_hist2_contact">Landlord / Manager Name</label><input id="monthly_hist2_contact" type="text" name="history_2_contact_name" placeholder="Name (enter N/A if you owned the property)"></div>
        <div class="fr">
          <div class="fg"><label for="monthly_hist2_phone">Landlord Phone</label><input id="monthly_hist2_phone" type="tel" name="history_2_contact_phone" placeholder="Phone number"></div>
          <div class="fg"><label for="monthly_hist2_email">Landlord Email</label><input id="monthly_hist2_email" type="email" name="history_2_contact_email" placeholder="Email (if known)"></div>
        </div>
      </div>

      <div class="history-block">
        <h4>Additional Residence</h4>
        <div class="fg"><label for="monthly_hist3_addr">Address or Park Name</label><input id="monthly_hist3_addr" type="text" name="history_3_address" placeholder="Park name or street address, city, state"></div>
        <div class="fr">
          <div class="fg"><label for="monthly_hist3_dates">Dates (from – to)</label><input id="monthly_hist3_dates" type="text" name="history_3_dates" placeholder="e.g. Jun 2020 – Feb 2022"></div>
          <div class="fg"><label for="monthly_hist3_type">Type</label>
            <select id="monthly_hist3_type" name="history_3_type">
              <option value="">Select</option>
              <option>RV Park / Campground</option>
              <option>Rental (house / apartment)</option>
              <option>Owned Home</option>
              <option>Staying with Family / Friends</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div class="fg"><label for="monthly_hist3_reason">Reason for Leaving</label><input id="monthly_hist3_reason" type="text" name="history_3_reason" placeholder="Reason for leaving"></div>
        <div class="fg"><label for="monthly_hist3_contact">Landlord / Manager Name</label><input id="monthly_hist3_contact" type="text" name="history_3_contact_name" placeholder="Name (enter N/A if you owned the property)"></div>
        <div class="fr">
          <div class="fg"><label for="monthly_hist3_phone">Landlord Phone</label><input id="monthly_hist3_phone" type="tel" name="history_3_contact_phone" placeholder="Phone number"></div>
          <div class="fg"><label for="monthly_hist3_email">Landlord Email</label><input id="monthly_hist3_email" type="email" name="history_3_contact_email" placeholder="Email (if known)"></div>
        </div>
      </div>

      <div class="fg"><label for="monthly_notes">Additional Notes</label><textarea id="monthly_notes" name="message" rows="4" placeholder="Site preferences, special needs, questions about monthly rates or availability..."></textarea></div>

      <div class="form-section-label">Acknowledgment &amp; Consent</div>
      <div class="consent-box">
        <p>By submitting this application, I acknowledge and agree to the following:</p>
        <ul>
          <li>I consent to a <strong>background check</strong> being conducted as part of this application.</li>
          <li>I understand that monthly stays run from <strong>November 1 through April 30</strong> each year, and I am required to <strong>vacate my site by April 30</strong>.</li>
          <li>I have read and accept the <a href="/park-policies" target="_blank"><strong>Park Rules &amp; Policies</strong></a> and agree to abide by them during my stay.</li>
          <li>I will provide <strong>proof of RV insurance</strong> before check-in.</li>
          <li>I understand that RVs must be <strong>no more than 10 years old</strong> unless approved by management after an in-person inspection.</li>
          <li>All information provided in this application is true and accurate to the best of my knowledge.</li>
        </ul>
        <label class="consent-check">
          <input type="checkbox" name="consent" required>
          <span>I have read and agree to all of the above terms and conditions.</span>
        </label>
      </div>

      <button class="btn-sub" type="submit">Submit Application</button>
      <p class="form-disc">We'll respond within 1–2 business days. For faster response, call <a href="tel:5419231441">541-923-1441</a> (M–F, 9 AM – 3 PM).</p>
    </form>
  </div>
</section>`,
            minHeight: 800,
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'extended-stays-cta',
          props: {
            headline:
              'Book your monthly site for the quiet season.',
            body:
              '<p>Full hookups from $800–$850/month. October through April. Call to discuss multi-month stays.</p>',
            ctaLabel: 'Apply Online →',
            ctaUrl: '#monthly-form',
            darkBackground: true,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },

  // ---------------------------------------------------------------------
  // 6. amenities.astro
  // ---------------------------------------------------------------------
  {
    slug: 'amenities',
    title: 'RV Park Amenities | Pool, Golf, Dining | Crooked River Ranch',
    meta_description:
      'RV park amenities at Crooked River Ranch: saltwater pool, 18-hole golf course, free Wi-Fi, tennis, pickleball, playground, dog run, and EV charging.',
    canonical_url: 'https://www.crookedriverranchrv.com/amenities',
    og_image: 'https://www.crookedriverranchrv.com/images/pool_aerial.jpg',
    hero_preload: '/images/pool_aerial.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Campground',
        name: 'Crooked River Ranch RV Park',
        description:
          'Full hookup RV sites with saltwater pool, adjacent 18-hole golf course, local dining, tennis and pickleball courts, playground, and dog run at Crooked River Ranch.',
        url: 'https://www.crookedriverranchrv.com/amenities',
        telephone: '+1-541-923-1441',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '14875 SW Hays Lane',
          addressLocality: 'Terrebonne',
          addressRegion: 'OR',
          postalCode: '97760',
          addressCountry: 'US',
        },
        amenityFeature: [
          { '@type': 'LocationFeatureSpecification', name: 'Saltwater Swimming Pool', value: true },
          { '@type': 'LocationFeatureSpecification', name: '18-Hole Golf Course Adjacent', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Full Hookups (30/50 Amp)', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Pull-Through Sites to 65 feet', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'EV Charging Stations', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Pet Friendly with Dog Run', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Tennis & Pickleball Courts', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Playground', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Local Dining Nearby', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Dump Station', value: true },
          { '@type': 'LocationFeatureSpecification', name: 'Free Wi-Fi', value: true },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.crookedriverranchrv.com/' },
          { '@type': 'ListItem', position: 2, name: 'Amenities', item: 'https://www.crookedriverranchrv.com/amenities' },
        ],
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'amenities-hero',
          props: {
            eyebrow: 'Amenities',
            headlineLine1: 'Everything you need.',
            headlineLine2Italic: 'Then some.',
            subtitle:
              'Golf, pool, dining, courts, playground, dog run — all on or near the property.',
            backgroundImageUrl: '/images/pool_aerial.jpg',
            ctaPrimaryLabel: 'Reserve Your Site',
            ctaPrimaryUrl: FIREFLY_URL,
            ctaSecondaryLabel: 'Explore the Area',
            ctaSecondaryUrl: '/area-guide',
          },
        },
        {
          type: 'AmenityGridSection',
          id: 'amenities-grid',
          props: {
            label: 'On-Property Amenities',
            headline: 'Everything on the',
            headlineItalic: 'canyon rim.',
            cards: [
              { icon: '⛳', name: 'Golf Course', desc: '18-hole course on the canyon rim, walking distance from your site. Discounted green fees for park guests. Practice green and pro shop on property.' },
              { icon: '🍺', name: 'Local Dining', desc: 'Restaurants and bars nearby within the community. Craft beer, food, and drinks. Open year-round for guests and the public.' },
              { icon: '🏊', name: 'Saltwater Pool', desc: 'Seasonal saltwater pool (May through September). Heated water, shallow area for kids, sun deck. Included with your site.' },
              { icon: '🎾', name: 'Tennis & Pickleball', desc: 'Court space for both sports. Equipment rental available. Leagues and casual play throughout the year.' },
              { icon: '🏀', name: 'Basketball & Volleyball', desc: 'Courts on property for pick-up games and organized play. Used year-round; most active in summer months.' },
              { icon: '🛝', name: 'Playground', desc: 'Equipment and open space for kids. Fenced area, shaded spots, within sight of most sites.' },
              { icon: '🚿', name: 'Renovated Bathhouse', desc: 'Modern facilities with hot showers, laundry, and restrooms. Accessible from all sites via paved paths.' },
              { icon: '🛒', name: 'Trading Post & Propane', desc: 'On-site shop for RV supplies and convenience items. Propane refill available. Hours posted at office.' },
              { icon: '🐾', name: 'Dog Run', desc: 'Dedicated space for dogs to run and play. Two pets per site allowed. Leash rules enforce courtesy and safety.' },
              { icon: '🔌', name: 'EV Charging', desc: 'Charge your electric vehicle right at your site. 30/50 amp pedestals available. $15/night — bring your own adapter.' },
              { icon: '📶', name: 'Free Wi-Fi', desc: 'Complimentary Wi-Fi available to all registered guests throughout the park. Great for staying connected, checking email, and light browsing.' },
            ],
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'amenities-golf',
          props: {
            label: 'Golf Course',
            headline: '18 holes on the',
            headlineItalic: 'canyon rim.',
            body:
              "<p>The course sits within walking distance of every site—about 200 feet from some. It's routed through junipers and sage with views down into the Crooked River Gorge. Eighteen holes designed for challenge and beauty, not to punish.</p><p>Park guests get $10 off 18 holes and $5 off 9 holes on green fees. The pro shop handles reservations and cart rentals, and the practice green is available for warming up before your round. Visit <a href=\"https://www.crookedriverranchgc.com\" target=\"_blank\" rel=\"noopener noreferrer\">crookedriverranchgc.com</a> for current rates and tee times.</p><p>In the off-season, you might have the course to yourself. Summer and weekends get busier, but nothing like a resort course. It's the kind of golf experience where you remember every hole.</p>",
            image: '/images/golf_course.jpg',
            imagePosition: 'right',
            imageWidth: 1400,
            imageHeight: 931,
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'amenities-pool',
          props: {
            label: 'Pool & Recreation',
            headline: 'Summer days and',
            headlineItalic: 'family fun.',
            body:
              "<p>The saltwater pool opens in May and stays warm through September. It's heated, which means comfortable swimming even on cool spring and fall days. The shallow end is perfect for kids; the deeper end is good for laps.</p><p>The sun deck and surrounding area give you space to relax between swims. Bring a book, watch the canyon, or talk with neighbors. It's the kind of amenity that brings people together—kids playing, adults catching up, everyone staying cool.</p><p>Beyond the pool, the courts are busy most evenings. Tennis, pickleball, basketball, volleyball—all available. The playground keeps kids occupied, and the dog run lets your pets burn off energy.</p>",
            image: '/images/pool.jpg',
            imagePosition: 'left',
            imageWidth: 1400,
            imageHeight: 646,
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'amenities-dining',
          props: {
            label: 'Local Dining',
            headline: 'Food, drinks, and',
            headlineItalic: 'community.',
            body:
              "<p>The Crooked River Ranch community has local restaurants and bars within a short walk or drive of the park. Craft beer, wine, and food are available year-round — no need to drive into town for a meal.</p><p>For extended-stay guests and winter visitors, nearby dining spots become gathering places. In summer, they're lively with visitors and locals. In winter, they're quieter and more social — regulars building friendships over meals.</p><p>Canyon views come standard with the area. Sunsets hit different when you're 200 feet above the gorge.</p>",
            image: '/images/canyon_sunset.jpg',
            imagePosition: 'right',
            imageWidth: 1049,
            imageHeight: 1400,
          },
        },
        {
          type: 'TwoColumnSection',
          id: 'amenities-pets',
          props: {
            label: 'Pet-Friendly at CRR',
            headline: "Bring your dog. It's",
            headlineItalic: 'welcome here.',
            body:
              '<p><strong>Two pets per site.</strong> Dogs, cats, and small animals are welcome as long as you keep them under control and clean up after them.</p><p><strong>Dog run on property.</strong> A dedicated off-leash area where your dog can play and socialize with other dogs in the park. Typical hours are dawn to dusk.</p><p><strong>Leash policy.</strong> Outside the dog run, pets must be on a leash. We enforce this to keep everyone (people and dogs) safe and comfortable.</p><p><strong>Walking paths.</strong> The park has paved paths throughout the property—perfect for morning and evening walks with your dog.</p>',
            image: '/images/dog_welcome.jpg',
            imagePosition: 'left',
            imageWidth: 1385,
            imageHeight: 1400,
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'amenities-park-map',
          props: {
            code: `<section id="park-map">
  <div class="container">
    <span class="section-label">Park Layout</span>
    <h2 class="st">Everything on the <em>map.</em></h2>
    <p class="section-body">Office, bathhouse, dog area, gazebo, dump station, and all four loops. Tap the map to view full size.</p>
    <div class="map-wrap" style="text-align:center;">
      <a href="/images/rv_park_map.jpg" target="_blank">
        <picture><source srcset="/images/rv_park_map.webp" type="image/webp"><img src="/images/rv_park_map.jpg" alt="Crooked River Ranch RV Park site map showing loops A B C and D, office, bathhouse, dog area, and amenities" loading="lazy" style="width:100%;max-width:900px;border-radius:4px;cursor:zoom-in;"></picture>
      </a>
    </div>
  </div>
</section>`,
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'amenities-cta',
          props: {
            headline: 'More than a place to park.',
            body:
              '<p>Book your site and discover why guests stay longer at Crooked River Ranch.</p>',
            ctaLabel: 'Reserve Your Site →',
            ctaUrl: FIREFLY_URL,
            darkBackground: true,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },

  // ---------------------------------------------------------------------
  // 7. book-now.astro
  // ---------------------------------------------------------------------
  {
    slug: 'book-now',
    title: 'Book Your Site | Crooked River Ranch RV Park Reservations',
    meta_description:
      'Reserve your RV site at Crooked River Ranch. Real-time availability and instant confirmation. Full hookups from $62/night, tent sites from $36/night. Open year-round.',
    canonical_url: 'https://www.crookedriverranchrv.com/book-now',
    og_image: 'https://www.crookedriverranchrv.com/images/hero.jpg',
    hero_preload: '/images/aerial_wide.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Campground',
        name: 'Crooked River Ranch RV Park',
        url: 'https://www.crookedriverranchrv.com/book-now',
        telephone: '541-923-1441',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '14875 SW Hays Lane',
          addressLocality: 'Terrebonne',
          addressRegion: 'OR',
          postalCode: '97760',
          addressCountry: 'US',
        },
        priceRange: '$36-$62/night',
        checkinTime: '14:00',
        checkoutTime: '12:00',
        numberOfRooms: 113,
        potentialAction: {
          '@type': 'ReserveAction',
          target: FIREFLY_URL,
          name: 'Reserve a Site',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.crookedriverranchrv.com/' },
          { '@type': 'ListItem', position: 2, name: 'Reservations', item: 'https://www.crookedriverranchrv.com/book-now' },
        ],
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'book-now-hero',
          props: {
            eyebrow: 'Reservations',
            headlineLine1: 'Your canyon rim site',
            headlineLine2Italic: 'is waiting.',
            subtitle:
              'Book online in real time, or call the office for site selection help, group coordination, or winter monthly applications.',
            backgroundImageUrl: '/images/aerial_wide.jpg',
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'book-now-reserve-online',
          props: {
            headline:
              'Real-time availability and instant confirmation.',
            body:
              '<p>Our reservation system shows live availability and allows you to book your preferred dates and site type immediately.</p>',
            ctaLabel: 'Book on Firefly Reservations',
            ctaUrl: FIREFLY_URL,
            darkBackground: false,
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'book-now-manage',
          props: {
            headline: 'Manage your reservation.',
            body:
              '<p>Need to review your dates, reschedule, pay your balance, or cancel? Use the guest portal to look up your reservation with the confirmation code from your booking email.</p><p style="margin-top:1.25rem;font-size:.88rem;">Can\'t find your confirmation email or lookup code? Call the office and we\'ll help you locate your reservation: <a href="tel:5419231441" style="color:var(--rust);font-weight:500;text-decoration:none;">541-923-1441</a> <span style="color:var(--muted);">(Mon–Fri, 9 AM – 3 PM)</span></p>',
            ctaLabel: 'Guest Portal →',
            ctaUrl:
              'https://app.fireflyreservations.com/GuestPortal/Property/CROOKEDRIVERRANCHRVPARK',
            darkBackground: false,
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'book-now-park-map',
          props: {
            code: `<section id="park-map">
  <div class="container">
    <span class="section-label">Park Layout</span>
    <h2 class="st">Find your <em>site.</em></h2>
    <p class="section-body">Four loops — A, B, C, and D — each following the canyon rim. Tap the map to view full size. Office, bathhouse, dog area, gazebo, and dump station are all marked.</p>
    <div class="map-wrap" style="text-align:center;">
      <a href="/images/rv_park_map.jpg" target="_blank">
        <picture><source srcset="/images/rv_park_map.webp" type="image/webp"><img src="/images/rv_park_map.jpg" alt="Crooked River Ranch RV Park site map showing loops A B C and D, office, bathhouse, dog area, and amenities" loading="lazy" style="width:100%;max-width:900px;border-radius:4px;cursor:zoom-in;"></picture>
      </a>
    </div>
    <div class="section-cta-center" style="margin-top:1.5rem;">
      <a href="${FIREFLY_URL}" class="btn-p">Pick Your Site →</a>
    </div>
  </div>
</section>`,
          },
        },
        {
          type: 'RatesTableSection',
          id: 'book-now-rates',
          props: {
            label: 'Rates at a Glance',
            headline: 'Site types and pricing.',
            rows: [
              { name: 'Full Hookup (FHU)', nightly: '$62', weekly: '$372', monthly: '$850', notes: '' },
              { name: 'Water & Electric (W&E)', nightly: '$57', weekly: '$342', monthly: '—', notes: '' },
              { name: 'Tent / Dry Camp', nightly: '$36', weekly: '—', monthly: '—', notes: '' },
              { name: '🔌 EV Charging Add-On', nightly: '+$15', weekly: '+$15/night', monthly: 'Call', notes: '' },
            ],
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'book-now-rates-note',
          props: {
            code: `<div class="rate-note-box" style="max-width:900px;margin:0 auto;">
  <p><strong>Monthly rates available October 1 – April 30.</strong> All rates exclude tax. $6 reservation fee per booking. Good Sam, military/first responder, and Harvest Hosts members each receive 10% off nightly rates. Contact the office at <a href="tel:5419231441">541-923-1441</a> to discuss extended stays and property owner rates.</p>
  <p style="margin-top:1rem;text-align:center;"><a href="${FIREFLY_URL}" class="btn-p">Check Availability →</a></p>
</div>`,
          },
        },
        {
          type: 'CardGridSection',
          id: 'book-now-how-to-book',
          props: {
            label: 'How to Book',
            headline: 'Three ways to',
            headlineItalic: 'reserve.',
            cards: [
              {
                icon: '💻',
                name: 'Online',
                desc: 'Book instantly through Firefly Reservations. See real-time availability, select your preferred dates and site type, and receive immediate confirmation.',
                href: FIREFLY_URL,
              },
              {
                icon: '📞',
                name: 'Call the Office',
                desc: 'Speak with the office team for help selecting a specific site, coordinating group reservations, or discussing extended winter stays. 541-923-1441',
                href: 'tel:5419231441',
              },
              {
                icon: '📋',
                name: 'Monthly Application',
                desc: 'Planning a winter month or extended stay? Apply online or call to discuss rates, site selection, and availability.',
                href: '/extended-stays#monthly-form',
              },
            ],
          },
        },
        {
          type: 'SiteCardsSection',
          id: 'book-now-site-types',
          props: {
            label: 'Site Types',
            headline: 'Choose your',
            headlineItalic: 'site.',
            intro:
              '<p>Each site type offers different amenities and price points to match your needs.</p>',
            cards: [
              {
                label: 'Most Popular',
                name: 'Full Hookup (FHU)',
                desc: 'Water, electric, sewer. Pull-throughs to 65 feet. Canyon rim views from most sites. The standard at Crooked River Ranch.',
                specsText:
                  'Water, Electric, Sewer, Canyon Views, Pull-Through, 🔌 EV Charging',
                price: '62',
                pricePer: '/night',
              },
              {
                name: 'Water & Electric (W&E)',
                desc: 'Water and electric hookups, no sewer. A more economical option for travelers with dump facilities elsewhere.',
                specsText:
                  'Water, Electric, Nightly Only, 🔌 EV Charging',
                price: '57',
                pricePer: '/night',
              },
              {
                name: 'Tent & Dry Camp',
                desc: 'No hookups. Ideal for tent camping, dry RV camping, or extended day use. Access to park facilities and amenities.',
                specsText: 'No Hookups, Tent-Friendly, Budget Option',
                price: '36',
                pricePer: '/night',
              },
            ],
          },
        },
        {
          type: 'TextBlock',
          id: 'book-now-discounts',
          props: {
            label: 'Discounts & Programs',
            headline: 'Save with member <em>rates.</em>',
            body:
              '<p><strong>Good Sam Club — 10% off:</strong> Good Sam members receive a 10% discount on nightly rates. Present your membership card at check-in.</p><p><strong>Military &amp; First Responders — 10% off:</strong> Active military, veterans, and first responders receive a 10% discount on nightly rates. Call the office to verify and book: <a href="tel:5419231441">541-923-1441</a></p><p><strong>Harvest Hosts — 10% off:</strong> Harvest Hosts members receive a 10% discount on nightly rates. Mention your membership when booking or present your Harvest Hosts credentials at check-in.</p><p><strong>Property Owner Rates:</strong> Crooked River Ranch property owners and residents receive owner rates on RV park stays. Contact the office for details.</p>',
            alignment: 'left',
            maxWidth: 'medium',
          },
        },
        {
          type: 'TextBlock',
          id: 'book-now-important',
          props: {
            label: 'Important Information',
            headline: 'Know before you <em>arrive.</em>',
            body:
              '<p><strong>Check-In:</strong> 2:00 pm | <strong>Check-Out:</strong> 12:00 pm</p><p>Early arrival or late checkout may be available. Call the office to arrange: <a href="tel:5419231441">541-923-1441</a></p><p><strong>Pets:</strong> Pets are welcome. Maximum of two pets per site. Leash laws apply. Please clean up after your pets.</p><p><strong>Year-Round Operations:</strong> The park is open 365 days a year. Winter visits are popular for clear skies, solitude, and hiking. Snow is rare but possible; the canyon rim drains and dries quickly.</p><p><strong>Site Assignment:</strong> Firefly Reservations assigns sites based on availability. If you have a specific preference (corner lot, closer to amenities, higher elevation), call the office to discuss: <a href="tel:5419231441">541-923-1441</a></p><p><strong>Cancellation Policy:</strong> Review the cancellation policy when booking. Policies vary by season. Firefly Reservations provides clear terms at time of booking.</p><p><strong>Office Hours:</strong> Monday – Friday, 9:00 AM – 3:00 PM. The office is closed on weekends and holidays, but the park is staffed and accessible 365 days a year.</p><p><strong>🔌 EV Charging:</strong> Electric vehicle owners can charge at their site using our 30/50 amp pedestals. $15/night add-on — bring your own EV adapter. Let us know when booking so we can assign an appropriate site.</p><p><strong>📶 Free Wi-Fi:</strong> Complimentary Wi-Fi is available to all registered guests throughout the park. Great for staying connected, checking email, and light browsing.</p><p><strong>Group Reservations:</strong> Groups of 10 or more should contact the office directly to coordinate multiple adjacent sites and special arrangements: <a href="tel:5419231441">541-923-1441</a></p>',
            alignment: 'left',
            maxWidth: 'medium',
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'book-now-directions',
          props: {
            code: `<section>
  <div class="container">
    <span class="section-label">Getting Here</span>
    <h2 class="st">Directions from <em>Highway 97.</em></h2>
    <p class="section-body">From Highway 97, turn west onto SW Lower Bridge Way (between Redmond and Terrebonne). Follow Lower Bridge Way approximately 5 miles. Turn left onto SW Clubhouse Road, then right onto SW Hays Lane. The RV park entrance is on your left at <strong>14875 SW Hays Lane, Terrebonne, OR 97760</strong>.</p>
    <p class="section-body">From Bend, head north on Highway 97 for about 20 minutes. From Redmond, head north on Highway 97 for about 10 minutes. The Lower Bridge Way turnoff is well-signed from either direction.</p>

    <div class="alert-box">
      <strong>Construction Notice:</strong> There is active construction on Lower Bridge Way, the main access road into Crooked River Ranch. Follow the posted detour signs. Allow a few extra minutes for your arrival. The detour is clearly marked and all destinations within the ranch remain accessible.
    </div>

    <div class="map-wrap">
      <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2845.5!2d-121.2055!3d44.3485!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x54b8c0a3f1a2d7e7%3A0x0!2s14875+SW+Hays+Lane%2C+Terrebonne%2C+OR+97760!5e0!3m2!1sen!2sus!4v1700000000000" title="Map showing Crooked River Ranch RV Park at 14875 SW Hays Lane, Terrebonne, OR 97760" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" style="width:100%;min-height:400px;border:0;"></iframe>
    </div>
  </div>
</section>`,
            minHeight: 600,
          },
        },
        {
          type: 'ReserveFormSection',
          id: 'book-now-inquiry-form',
          props: {
            label: 'Contact the Office',
            headline: "Questions? We're here to",
            headlineItalic: 'help.',
            body:
              "<p>Fill out this form and we'll get back to you within 24 hours. For faster response, call 541-923-1441.</p>",
            formName: 'inquiry',
            formTitle: 'Inquiry Form',
            submitLabel: 'Send Inquiry',
            disclaimer:
              "We'll get back to you within 24 hours. For faster response, call 541-923-1441.",
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'book-now-final-cta',
          props: {
            headline: 'Book your canyon rim site now.',
            body:
              '<p>Open year-round. Check-in 2 pm. Check-out 12 pm.</p>',
            ctaLabel: 'Book on Firefly →',
            ctaUrl: FIREFLY_URL,
            darkBackground: true,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },

  // ---------------------------------------------------------------------
  // 8. area-guide.astro
  // The GoogleMap.astro region map cannot render from inside an HtmlEmbed
  // (it's a server-side Astro component with DB-pulled pins). Left as a
  // placeholder note so the Visual Editor doesn't silently drop it. The long
  // "prose" narrative with collapsible ag-sections is preserved in an
  // HtmlEmbed; the bottom ExploreGrid is a first-class section.
  // ---------------------------------------------------------------------
  {
    slug: 'area-guide',
    title:
      'Things to Do Near Smith Rock Oregon | Central Oregon Area Guide',
    meta_description:
      'Complete guide to Central Oregon from Crooked River Ranch RV Park. Smith Rock climbing, Bend breweries, Sisters, fly fishing, hiking, golf, and skiing from your canyon rim basecamp.',
    canonical_url: 'https://www.crookedriverranchrv.com/area-guide',
    og_image: 'https://www.crookedriverranchrv.com/images/smith_rock.jpg',
    hero_preload: '/images/smith_rock.webp',
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline:
          'Things to Do Near Smith Rock Oregon — Central Oregon Area Guide',
        description:
          'Complete guide to Central Oregon activities from Crooked River Ranch RV Park. Smith Rock climbing, Bend breweries, Sisters, fly fishing, hiking, golf, and skiing.',
        author: {
          '@type': 'Organization',
          name: 'Crooked River Ranch RV Park',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Crooked River Ranch RV Park',
          url: 'https://www.crookedriverranchrv.com',
        },
        mainEntityOfPage:
          'https://www.crookedriverranchrv.com/area-guide',
        about: [
          { '@type': 'Place', name: 'Smith Rock State Park' },
          { '@type': 'Place', name: 'Bend, Oregon' },
          { '@type': 'Place', name: 'Sisters, Oregon' },
          { '@type': 'Place', name: 'Mt. Bachelor' },
          { '@type': 'Place', name: 'Crooked River Ranch Golf Course' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.crookedriverranchrv.com/' },
          { '@type': 'ListItem', position: 2, name: 'Area Guide', item: 'https://www.crookedriverranchrv.com/area-guide' },
        ],
      },
    ],
    page_builder_data: {
      content: [
        {
          type: 'HeroSection',
          id: 'area-guide-hero',
          props: {
            eyebrow: 'Area Guide',
            headlineLine1:
              'Your canyon rim basecamp for',
            headlineLine2Italic: 'Central Oregon.',
            subtitle:
              'Smith Rock, Bend, Sisters, and the Deschutes—all from a single home base on the gorge.',
            backgroundImageUrl: '/images/smith_rock.jpg',
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'area-guide-map-placeholder',
          props: {
            code: `<section style="padding:3rem 3rem 1rem;">
  <div class="container">
    <span class="section-label">Region map</span>
    <h2 class="st" style="margin-top:.4rem;">See everything <em>on one map.</em></h2>
    <p class="section-body" style="max-width:680px;margin:1rem 0 1.8rem;">
      Every trail and every activity with a location, pinned. Click a pin for details
      and a link to the full page. Use the browser zoom to explore up close.
    </p>
    <div style="padding:2rem;background:var(--sand);border:1px dashed var(--rust);border-radius:4px;text-align:center;color:var(--muted);">
      Map rendered via GoogleMap.astro — edit in code only. The live region map pulls pins from trails and things-to-do in Supabase.
    </div>
    <div style="margin-top:2rem;display:flex;gap:1rem;flex-wrap:wrap;">
      <a href="/trails" class="btn-p" style="text-decoration:none;">🥾 All trails</a>
      <a href="/things-to-do" class="btn-g" style="text-decoration:none;">✨ 60 things to do</a>
    </div>
  </div>
</section>`,
          },
        },
        {
          type: 'HtmlEmbed',
          id: 'area-guide-prose',
          props: {
            code: `<section>
  <div class="container">
    <div class="prose">

<p>Crooked River Ranch RV Park sits at the crossroads of Central Oregon's top destinations. Within 15 to 35 minutes of your site, you can access internationally recognized climbing, fly fishing, craft breweries, mountain biking, skiing, desert hiking, and historic small towns. Everything radiates from the canyon rim.</p>

<div class="ag-section" id="smith-rock">
<h2>Smith Rock State Park <span style="font-weight:300;font-size:.7em;color:var(--muted);">— 15 minutes</span></h2>
<p class="ag-summary">One of the top three sport climbing destinations in North America and the birthplace of American sport climbing. Over 2,000 routes from 5.6 to 5.13+. Canyon hiking, Misery Ridge, and Monkey Face — all a quarter hour from your site. CRR is the closest full-hookup RV park to Smith Rock.</p>
<button class="ag-toggle">Read more</button>
<div class="ag-detail">
<p>The park sits on a bend in the Crooked River, with crags rising directly above the water. The rock is welcoming — large holds, positive placements, crimpy sections to sloppy depending on the formation. If you're a climber, Smith Rock is the main reason to be here.</p>
<p>The Crooked River Loop Trail (7.7 miles) circles the park and offers non-climbers excellent canyon hiking. Misery Ridge climbs 500 feet in roughly a mile and delivers views across the entire bend (3.7 miles round trip). The River Trail provides a gentler, beginner-friendly option that hugs the water. Monkey Face, the iconic 350-foot formation, can be viewed from multiple angles without climbing. The Burma Road traverses the opposite side with spectacular formation views.</p>
<p><strong>Important for RV travelers:</strong> Smith Rock does not permit RV camping. The park has tent camping at the Bivy — a walk-in campground with limited sites — but no hookups, no RV parking for overnight stays, and no dump facilities. CRR is the closest full-hookup option, 15 minutes away with comfortable sites and full services.</p>
</div>
</div>

<div class="ag-section">
<h2>Steelhead Falls & Canyon Trails</h2>
<p class="ag-summary">A canyon waterfall on BLM land under a mile round trip, plus multiple trails that start near your site and descend to the river through juniper, cottonwood, and Douglas fir.</p>
<button class="ag-toggle">Read more</button>
<div class="ag-detail">
<p>Steelhead Falls drops into a small pool surrounded by juniper. It's a canyon experience that locals use regularly and visitors often miss. The Otter Bench trail, Scout Camp trail, and Lone Pine trail all originate from or connect to Crooked River Ranch property. Lone Pine trail starts near your site and descends to the river, dropping into riparian habitat that contrasts sharply with the high desert sagebrush above. These are half-day or morning hikes that feel more like exploration than destination trekking.</p>
</div>
</div>

<div class="ag-section">
<h2>Crooked River Fishing</h2>
<p class="ag-summary">The river runs at the bottom of the gorge with healthy trout populations. Fly fishing access via wading and shoreline casts from public land. Cold, clear water year-round. The river is your backyard.</p>
</div>

<div class="ag-section">
<h2>Crooked River Ranch Golf Course</h2>
<p class="ag-summary">An 18-hole par 71 championship course adjacent to the RV park. Walk to the first tee from most sites. Park guests get $10 off 18 holes and $5 off 9 holes. <a href="/golf-course">Full course details here.</a></p>
</div>

<div class="ag-section">
<h2>Seasonal Highlights</h2>
<p class="ag-summary">Every season brings something different to Central Oregon — wildflower blooms in spring, peak climbing and brewery weather in summer, quiet trails and fall color in autumn, and skiing, stargazing, and solitude in winter.</p>
<button class="ag-toggle">Read more</button>
<div class="ag-detail">
<p><strong>Spring (April–May)</strong> brings wildflower blooms across the high desert — lupine, Indian paintbrush, and desert marigolds. The weather is mild, trails are dry, and the river levels make for excellent whitewater rafting.</p>
<p><strong>Summer (June–August)</strong> is peak season. Climbing conditions at Smith Rock are excellent (mornings are best). Mountain biking trails are rideable. Bend's brewery patios overflow. Fly fishing is productive with multiple hatches. Evenings stay light past 9 PM.</p>
<p><strong>Fall (September–November)</strong> offers quieter trails, smaller crowds at Smith Rock, and vivid aspen and cottonwood color changes along the rivers. Cool and clear weather, perfect for canyon hiking.</p>
<p><strong>Winter (December–February)</strong> transforms the region. Mt. Bachelor and Hoodoo receive reliable snow. Stargazing is exceptional on clear, cold nights. Winter fly fishing is productive for steelhead and trout. The canyon provides shelter from wind.</p>
</div>
</div>

<div class="ag-section">
<h2>Local Dining & Drinks</h2>
<p class="ag-summary">A local restaurant and bar operates within the Crooked River Ranch community, serving craft beer and a rotating food menu. Open to park guests. A short walk or drive from your site — no highway travel required.</p>
</div>

<div class="ag-section" id="bend">
<h2>Bend <span style="font-weight:300;font-size:.7em;color:var(--muted);">— 25 minutes</span></h2>
<p class="ag-summary">One of the West's most popular outdoor towns. Breweries, Deschutes River dining, mountain biking, fly fishing, and the Old Mill District. The brewery capital of the Pacific Northwest is a half-hour drive.</p>
<button class="ag-toggle">Read more</button>
<div class="ag-detail">
<p>Downtown Bend sits along the Deschutes River with breweries, restaurants, and shops. The Old Mill District houses retail, dining, and entertainment. Drake Park overlooks Mirror Pond with waterfront trails. The entire downtown core is walkable.</p>
<p>Mountain biking dominates recreation — Phil's trail, a flow trail with banked turns and berms, sits within minutes of downtown. Fly fishing on the Deschutes is excellent in summer and fall.</p>
<p>The brewery scene is the city's primary draw. Deschutes Brewery, 10 Barrel Brewing, and Crux Fermentation lead the pack, with dozens of smaller producers rounding out the scene. Follow the Ale Trail to visit multiple taprooms. Food quality is consistently high across the downtown and mill district.</p>
</div>
</div>

<div class="ag-section">
<h2>Sisters <span style="font-weight:300;font-size:.7em;color:var(--muted);">— 30 minutes</span></h2>
<p class="ag-summary">Western-themed downtown with wooden storefronts and a working rodeo. Home to the Sisters Rodeo (June) and Sisters Outdoor Quilt Show (July). Gateway to the Metolius River, Proxy Falls, and Hoodoo Ski Area.</p>
<button class="ag-toggle">Read more</button>
<div class="ag-detail">
<p>Three Creeks Brewing Company serves as Sisters' local brewery hub. The landscape transitions from high desert to ponderosa pine forest as you climb toward the Cascades.</p>
<p>Camp Sherman and the Metolius River lie 30 minutes north, offering exceptional fly fishing on crystal-clear spring-fed water and rustic lodges. The Metolius flows cold and clear year-round, making it one of Oregon's best trout streams.</p>
<p>Hoodoo Ski Area operates 45 minutes from Sisters in winter with reliable snow and groomed runs. Summer access provides mountain biking and hiking at elevation.</p>
</div>
</div>

<div class="ag-section">
<h2>Redmond <span style="font-weight:300;font-size:.7em;color:var(--muted);">— 15 minutes</span></h2>
<p class="ag-summary">The region's airport hub — Roberts Field is the closest commercial airport. A growing downtown restaurant and brewery scene, plus Cline Buttes hiking nearby.</p>
</div>

<div class="ag-section">
<h2>Mt. Bachelor & Skiing <span style="font-weight:300;font-size:.7em;color:var(--muted);">— 1 hour</span></h2>
<p class="ag-summary">Central Oregon's primary ski resort with reliable snowfall. Summer mountain biking and scenic chairlift rides. The 9,068-foot summit delivers views across the entire Cascade range.</p>
</div>

<div class="ag-section">
<h2>High Desert Museum <span style="font-weight:300;font-size:.7em;color:var(--muted);">— 35 minutes</span></h2>
<p class="ag-summary">Indoor exhibits, outdoor bird rehabilitation, and historical demonstrations in Bend. Oregon history, Native American culture, high desert ecology, and birds of prey demonstration flights. A genuine museum with substantial educational content.</p>
</div>

<div class="ag-section">
<h2>Newberry Volcanic Monument</h2>
<p class="ag-summary">A geologically active area south of the park with obsidian flows, hot springs, crater lakes, and Paulina Falls (roughly 80 feet). The Deschutes River originates at Little Lava Lake nearby. Lava tubes and pumice fields create otherworldly hiking.</p>
</div>

<p style="margin-top:2rem;"><strong>The larger picture:</strong> Central Oregon's appeal is the density of different environments within short distances. Climb Smith Rock in the morning, fish the Deschutes in the afternoon, ski Mt. Bachelor the next day — all without moving your rig. CRR is the basecamp.</p>

    </div>
  </div>
</section>`,
            minHeight: 800,
          },
        },
        {
          type: 'ExploreGridSection',
          id: 'area-guide-explore',
          props: {
            label: 'Explore These Destinations',
            headline: 'From your canyon rim',
            headlineItalic: 'basecamp.',
            cards: [
              {
                image: '/images/smith_rock.jpg',
                alt: 'Smith Rock climbing formations',
                distance: '15 min',
                title: 'Smith Rock State Park',
                desc: 'Internationally recognized sport climbing and canyon hiking. The closest full-hookup RV park to Smith Rock.',
                imageWidth: 1400,
                imageHeight: 931,
              },
              {
                image: '/images/central_oregon.jpg',
                alt: 'Central Oregon landscape',
                distance: '25 min',
                title: 'Bend',
                desc: 'Brewery capital of the Pacific Northwest. Deschutes River, mountain biking, and dining.',
                imageWidth: 1400,
                imageHeight: 932,
              },
              {
                image: '/images/canyon_day.jpg',
                alt: 'Crooked River Canyon in daylight',
                distance: '30 min',
                title: 'Sisters',
                desc: 'Western-themed downtown, Sisters Rodeo, Proxy Falls, and Cascade foothills.',
                imageWidth: 1400,
                imageHeight: 1050,
              },
              {
                image: '/images/golf_course.jpg',
                alt: 'Golf course canyon views',
                distance: '15-45 min',
                title: 'Fly Fishing & Hiking',
                desc: 'Crooked River, Deschutes River, Steelhead Falls, and dozens of canyon and forest trails.',
                imageWidth: 1400,
                imageHeight: 931,
              },
            ],
          },
        },
        {
          type: 'CtaBannerSection',
          id: 'area-guide-cta',
          props: {
            headline:
              'CRR is the basecamp. Book your canyon rim site.',
            body:
              '<p>Full hookups from $62/night. Open year-round. Close to Smith Rock, Bend breweries, Metolius fishing, and ski areas.</p>',
            ctaLabel: 'Secure Your Dates on Firefly →',
            ctaUrl: FIREFLY_URL,
            darkBackground: true,
          },
        },
      ],
      root: { props: {} },
      zones: {},
    },
  },
];
