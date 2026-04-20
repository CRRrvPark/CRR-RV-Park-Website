#!/usr/bin/env node
/**
 * migrate-area-guide.mjs — rebuild the /area-guide page's page_builder_data.
 *
 * The legacy seed stashed the entire area-guide body into two sandboxed
 * HtmlEmbed iframes (see scripts/legacy-pages-data.mjs ~line 1454), which
 * meant the site's typography and container CSS never reached the prose
 * and a "region map" heading sat above a nothing box because Astro
 * components can't render inside an HtmlEmbed iframe.
 *
 * This script replaces those two HtmlEmbeds with:
 *   1. A RegionMapSection — the new atom-ized map widget with category
 *      filters wired to the Things-to-Do / Trails / Local Places data.
 *   2. An intro TextBlock.
 *   3. One TwoColumnSection per destination (12 destinations: Smith Rock,
 *      Steelhead Falls, Crooked River Fishing, CRR Golf, Seasonal
 *      Highlights, Local Dining & Drinks, Bend, Sisters, Redmond,
 *      Mt Bachelor, High Desert Museum, Newberry Volcanic Monument).
 *   4. A closing TextBlock.
 *
 * Every other section on the page (HeroSection, ExploreGridSection,
 * CtaBannerSection) is preserved verbatim, as are its zones.
 *
 * Idempotent: if the first HtmlEmbed is already gone (indicating a prior
 * run migrated the page), the script skips. Otherwise it rewrites the
 * content array. Zones from the old heroes/sections are preserved.
 *
 * Usage:
 *   node scripts/migrate-area-guide.mjs            # dry-run
 *   node scripts/migrate-area-guide.mjs --apply    # write to DB
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Destination TwoColumnSection blocks ──
// The structure of each block mirrors the prose that was in the HtmlEmbed,
// but split into one section per destination so each one is individually
// editable and gets the site's CSS.
//
// Images: Smith Rock and Golf Course have dedicated images; other
// destinations use /images/central_oregon.jpg or canyon variants as
// reasonable placeholders. The owner can swap these via the visual editor
// once they have curated images for Bend, Sisters, etc.
const DESTINATIONS = [
  {
    id: 'area-guide-smith-rock',
    sectionId: 'smith-rock',
    label: 'Destination',
    headline: 'Smith Rock State Park',
    headlineItalic: '15 minutes',
    image: '/images/smith_rock.jpg',
    imageCaption: 'Smith Rock State Park',
    imagePosition: 'right',
    body: `
<p>One of the top three sport climbing destinations in North America and the birthplace of American sport climbing. Over 2,000 routes from 5.6 to 5.13+. Canyon hiking, Misery Ridge, and Monkey Face — all a quarter hour from your site. CRR is the closest full-hookup RV park to Smith Rock.</p>
<p>The park sits on a bend in the Crooked River, with crags rising directly above the water. The rock is welcoming — large holds, positive placements, crimpy sections to sloppy depending on the formation. If you're a climber, Smith Rock is the main reason to be here.</p>
<p>The Crooked River Loop Trail (7.7 miles) circles the park and offers non-climbers excellent canyon hiking. Misery Ridge climbs 500 feet in roughly a mile and delivers views across the entire bend (3.7 miles round trip). The River Trail provides a gentler, beginner-friendly option that hugs the water. Monkey Face, the iconic 350-foot formation, can be viewed from multiple angles without climbing. The Burma Road traverses the opposite side with spectacular formation views.</p>
<p><strong>Important for RV travelers:</strong> Smith Rock does not permit RV camping. The park has tent camping at the Bivy — a walk-in campground with limited sites — but no hookups, no RV parking for overnight stays, and no dump facilities. CRR is the closest full-hookup option, 15 minutes away with comfortable sites and full services.</p>
`.trim(),
    ctaLabel: 'Trails near Smith Rock',
    ctaUrl: '/trails',
  },
  {
    id: 'area-guide-steelhead-falls',
    label: 'Destination',
    headline: 'Steelhead Falls &amp; Canyon Trails',
    headlineItalic: '',
    image: '/images/canyon_day.jpg',
    imageCaption: 'Crooked River canyon',
    imagePosition: 'left',
    body: `
<p>A canyon waterfall on BLM land under a mile round trip, plus multiple trails that start near your site and descend to the river through juniper, cottonwood, and Douglas fir.</p>
<p>Steelhead Falls drops into a small pool surrounded by juniper. It's a canyon experience that locals use regularly and visitors often miss. The Otter Bench trail, Scout Camp trail, and Lone Pine trail all originate from or connect to Crooked River Ranch property. Lone Pine trail starts near your site and descends to the river, dropping into riparian habitat that contrasts sharply with the high desert sagebrush above. These are half-day or morning hikes that feel more like exploration than destination trekking.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-crooked-river-fishing',
    label: 'Fly fishing',
    headline: 'Crooked River Fishing',
    headlineItalic: '',
    image: '/images/canyon_sunset.jpg',
    imageCaption: 'Crooked River at sunset',
    imagePosition: 'right',
    body: `
<p>The river runs at the bottom of the gorge with healthy trout populations. Fly fishing access via wading and shoreline casts from public land. Cold, clear water year-round. The river is your backyard.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-golf',
    label: 'Golf',
    headline: 'Crooked River Ranch Golf Course',
    headlineItalic: '',
    image: '/images/golf_course.jpg',
    imageCaption: '18-hole course on the rim',
    imagePosition: 'left',
    body: `
<p>An 18-hole par 71 championship course adjacent to the RV park. Walk to the first tee from most sites. Park guests get $10 off 18 holes and $5 off 9 holes.</p>
`.trim(),
    ctaLabel: 'Full course details',
    ctaUrl: '/golf-course',
  },
  {
    id: 'area-guide-seasons',
    label: 'Every season',
    headline: 'Seasonal Highlights',
    headlineItalic: '',
    image: '/images/gazebo_fall.jpg',
    imageCaption: 'Fall at the ranch',
    imagePosition: 'right',
    body: `
<p>Every season brings something different to Central Oregon — wildflower blooms in spring, peak climbing and brewery weather in summer, quiet trails and fall color in autumn, and skiing, stargazing, and solitude in winter.</p>
<p><strong>Spring (April–May)</strong> brings wildflower blooms across the high desert — lupine, Indian paintbrush, and desert marigolds. The weather is mild, trails are dry, and the river levels make for excellent whitewater rafting.</p>
<p><strong>Summer (June–August)</strong> is peak season. Climbing conditions at Smith Rock are excellent (mornings are best). Mountain biking trails are rideable. Bend's brewery patios overflow. Fly fishing is productive with multiple hatches. Evenings stay light past 9 PM.</p>
<p><strong>Fall (September–November)</strong> offers quieter trails, smaller crowds at Smith Rock, and vivid aspen and cottonwood color changes along the rivers. Cool and clear weather, perfect for canyon hiking.</p>
<p><strong>Winter (December–February)</strong> transforms the region. Mt. Bachelor and Hoodoo receive reliable snow. Stargazing is exceptional on clear, cold nights. Winter fly fishing is productive for steelhead and trout. The canyon provides shelter from wind.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-local-dining',
    label: 'Food &amp; drink',
    headline: 'Local Dining &amp; Drinks',
    headlineItalic: '',
    image: '/images/firepit_evening.jpg',
    imageCaption: 'Evening at the firepit',
    imagePosition: 'left',
    body: `
<p>A local restaurant and bar operates within the Crooked River Ranch community, serving craft beer and a rotating food menu. Open to park guests. A short walk or drive from your site — no highway travel required.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-bend',
    sectionId: 'bend',
    label: 'Destination',
    headline: 'Bend',
    headlineItalic: '25 minutes',
    image: '/images/central_oregon.jpg',
    imageCaption: 'Central Oregon',
    imagePosition: 'right',
    body: `
<p>One of the West's most popular outdoor towns. Breweries, Deschutes River dining, mountain biking, fly fishing, and the Old Mill District. The brewery capital of the Pacific Northwest is a half-hour drive.</p>
<p>Downtown Bend sits along the Deschutes River with breweries, restaurants, and shops. The Old Mill District houses retail, dining, and entertainment. Drake Park overlooks Mirror Pond with waterfront trails. The entire downtown core is walkable.</p>
<p>Mountain biking dominates recreation — Phil's trail, a flow trail with banked turns and berms, sits within minutes of downtown. Fly fishing on the Deschutes is excellent in summer and fall.</p>
<p>The brewery scene is the city's primary draw. Deschutes Brewery, 10 Barrel Brewing, and Crux Fermentation lead the pack, with dozens of smaller producers rounding out the scene. Follow the Ale Trail to visit multiple taprooms. Food quality is consistently high across the downtown and mill district.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-sisters',
    label: 'Destination',
    headline: 'Sisters',
    headlineItalic: '30 minutes',
    image: '/images/central_oregon.jpg',
    imageCaption: 'Western Cascades',
    imagePosition: 'left',
    body: `
<p>Western-themed downtown with wooden storefronts and a working rodeo. Home to the Sisters Rodeo (June) and Sisters Outdoor Quilt Show (July). Gateway to the Metolius River, Proxy Falls, and Hoodoo Ski Area.</p>
<p>Three Creeks Brewing Company serves as Sisters' local brewery hub. The landscape transitions from high desert to ponderosa pine forest as you climb toward the Cascades.</p>
<p>Camp Sherman and the Metolius River lie 30 minutes north, offering exceptional fly fishing on crystal-clear spring-fed water and rustic lodges. The Metolius flows cold and clear year-round, making it one of Oregon's best trout streams.</p>
<p>Hoodoo Ski Area operates 45 minutes from Sisters in winter with reliable snow and groomed runs. Summer access provides mountain biking and hiking at elevation.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-redmond',
    label: 'Destination',
    headline: 'Redmond',
    headlineItalic: '15 minutes',
    image: '/images/central_oregon.jpg',
    imageCaption: 'Central Oregon',
    imagePosition: 'right',
    body: `
<p>The region's airport hub — Roberts Field is the closest commercial airport. A growing downtown restaurant and brewery scene, plus Cline Buttes hiking nearby.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-bachelor',
    label: 'Skiing',
    headline: 'Mt. Bachelor &amp; Skiing',
    headlineItalic: '1 hour',
    image: '/images/central_oregon.jpg',
    imageCaption: 'Cascade range',
    imagePosition: 'left',
    body: `
<p>Central Oregon's primary ski resort with reliable snowfall. Summer mountain biking and scenic chairlift rides. The 9,068-foot summit delivers views across the entire Cascade range.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-high-desert-museum',
    label: 'Museum',
    headline: 'High Desert Museum',
    headlineItalic: '35 minutes',
    image: '/images/central_oregon.jpg',
    imageCaption: 'Central Oregon',
    imagePosition: 'right',
    body: `
<p>Indoor exhibits, outdoor bird rehabilitation, and historical demonstrations in Bend. Oregon history, Native American culture, high desert ecology, and birds of prey demonstration flights. A genuine museum with substantial educational content.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
  {
    id: 'area-guide-newberry',
    label: 'Volcanic monument',
    headline: 'Newberry Volcanic Monument',
    headlineItalic: '',
    image: '/images/aerial_canyon_rim.jpg',
    imageCaption: 'Canyon rim',
    imagePosition: 'left',
    body: `
<p>A geologically active area south of the park with obsidian flows, hot springs, crater lakes, and Paulina Falls (roughly 80 feet). The Deschutes River originates at Little Lava Lake nearby. Lava tubes and pumice fields create otherworldly hiking.</p>
`.trim(),
    ctaLabel: '',
    ctaUrl: '',
  },
];

function buildRegionMapSection() {
  return {
    type: 'RegionMapSection',
    props: {
      id: 'area-guide-map',
      sectionId: '',
      bgColor: '', textColor: '',
      marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, paddingX: 0,
      borderWidth: 0, borderColor: '#d8ccb7', borderRadius: 0, shadow: 'none',
      label: 'Region map',
      headline: 'See everything',
      headlineItalic: 'on one map.',
      intro:
        '<p>Every trail and every activity with a location, pinned. Click a pin for details and a link to the full page. Pick a category to filter — or use the Highlights view to see our favorites near the park.</p>',
      mapHeight: 560,
      centerLat: 44.3485,
      centerLng: -121.2055,
      zoom: 10,
    },
  };
}

function buildIntroTextBlock() {
  return {
    type: 'TextBlock',
    props: {
      id: 'area-guide-intro',
      sectionId: '',
      bgColor: '', textColor: '',
      marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, paddingX: 0,
      borderWidth: 0, borderColor: '#d8ccb7', borderRadius: 0, shadow: 'none',
      label: '',
      headline: '',
      body: `<p>Crooked River Ranch RV Park sits at the crossroads of Central Oregon's top destinations. Within 15 to 35 minutes of your site, you can access internationally recognized climbing, fly fishing, craft breweries, mountain biking, skiing, desert hiking, and historic small towns. Everything radiates from the canyon rim.</p>`,
      alignment: 'left',
      maxWidth: 'medium',
    },
  };
}

function buildClosingTextBlock() {
  return {
    type: 'TextBlock',
    props: {
      id: 'area-guide-closing',
      sectionId: '',
      bgColor: '', textColor: '',
      marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, paddingX: 0,
      borderWidth: 0, borderColor: '#d8ccb7', borderRadius: 0, shadow: 'none',
      label: '',
      headline: 'The larger picture',
      body: `<p>Central Oregon's appeal is the density of different environments within short distances. Climb Smith Rock in the morning, fish the Deschutes in the afternoon, ski Mt. Bachelor the next day — all without moving your rig. CRR is the basecamp.</p>`,
      alignment: 'left',
      maxWidth: 'medium',
    },
  };
}

function buildTwoCol(dest) {
  return {
    type: 'TwoColumnSection',
    props: {
      id: dest.id,
      sectionId: dest.sectionId || '',
      bgColor: '', textColor: '',
      marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, paddingX: 0,
      borderWidth: 0, borderColor: '#d8ccb7', borderRadius: 0, shadow: 'none',
      label: dest.label || '',
      headline: dest.headline,
      headlineItalic: dest.headlineItalic || '',
      body: dest.body,
      featureList: [],
      image: dest.image,
      imageCaption: dest.imageCaption || '',
      imagePosition: dest.imagePosition || 'right',
      mobileImagePosition: 'inherit',
      imageWidth: 0,
      imageHeight: 0,
      imageObjectFit: 'cover',
      imageBorderRadius: 4,
      ctaLabel: dest.ctaLabel || '',
      ctaUrl: dest.ctaUrl || '',
      imageLinkUrl: '',
    },
  };
}

async function main() {
  const { data: pages, error } = await sb
    .from('pages')
    .select('id, slug, page_builder_data')
    .eq('slug', 'area-guide')
    .maybeSingle();
  if (error || !pages) {
    console.error('! could not load area-guide page:', error?.message || 'not found');
    process.exit(1);
  }

  const data = pages.page_builder_data;
  if (!data || !Array.isArray(data.content)) {
    console.error('! area-guide has no page_builder_data.content');
    process.exit(1);
  }

  const hasMapPlaceholder = data.content.some((c) => c?.type === 'HtmlEmbed' && c.props?.id === 'area-guide-map-placeholder');
  const hasProseEmbed = data.content.some((c) => c?.type === 'HtmlEmbed' && c.props?.id === 'area-guide-prose');

  if (!hasMapPlaceholder && !hasProseEmbed) {
    console.log('. area-guide already migrated (neither HtmlEmbed remains) — nothing to do.');
    return;
  }

  // Find the hero and the sections after prose (explore + cta) so we preserve them.
  const hero = data.content.find((c) => c?.type === 'HeroSection');
  const afterProse = data.content.filter(
    (c) =>
      c && c.type !== 'HeroSection' &&
      !(c.type === 'HtmlEmbed' && (c.props?.id === 'area-guide-map-placeholder' || c.props?.id === 'area-guide-prose'))
  );

  const newContent = [
    ...(hero ? [hero] : []),
    buildRegionMapSection(),
    buildIntroTextBlock(),
    ...DESTINATIONS.map(buildTwoCol),
    buildClosingTextBlock(),
    ...afterProse,
  ];

  const newData = { ...data, content: newContent };

  console.log('Before:');
  console.log('  items:', data.content.length);
  for (const c of data.content) console.log('  -', c?.type, '(', c?.props?.id, ')');
  console.log('');
  console.log('After:');
  console.log('  items:', newContent.length);
  for (const c of newContent) console.log('  -', c?.type, '(', c?.props?.id, ')');

  if (!apply) {
    console.log('');
    console.log('(Dry-run. Pass --apply to write this to the database.)');
    return;
  }

  const { error: upErr } = await sb
    .from('pages')
    .update({ page_builder_data: newData, updated_at: new Date().toISOString() })
    .eq('id', pages.id);
  if (upErr) {
    console.error('! write failed:', upErr.message);
    process.exit(1);
  }
  console.log('');
  console.log('+ wrote area-guide successfully.');
}

main().catch((err) => { console.error(err); process.exit(1); });
