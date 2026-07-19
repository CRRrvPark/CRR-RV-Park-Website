/**
 * Section Library — the catalog of pre-styled, brand-conformant section
 * templates editors can drop into any page.
 *
 * Each entry defines:
 *   - type: stable identifier stored in sections.type
 *   - name + description + icon: shown in the picker UI
 *   - blocks: the content_blocks created when an editor adds this section
 *
 * Adding a new section type:
 *   1. Add an entry here
 *   2. Create the matching Astro component in src/components/sections/
 *   3. Register it in PageRenderer.astro
 *
 * The catalog is the source of truth for *what's available*. The Astro
 * components are the source of truth for *how each one renders*.
 */

export interface BlockTemplate {
  key: string;
  block_type: 'plain_text' | 'rich_text' | 'image' | 'json' | 'number' | 'boolean' | 'url';
  display_name: string;
  notes?: string;
  default_text?: string;
  default_html?: string;
  default_json?: unknown;
  default_image_url?: string;
  default_image_alt?: string;
  default_image_width?: number;
  default_image_height?: number;
  default_number?: number;
  default_boolean?: boolean;
}

export interface SectionType {
  type: string;
  name: string;
  icon: string;
  description: string;
  category: 'hero' | 'content' | 'media' | 'list' | 'cta' | 'data' | 'special';
  blocks: BlockTemplate[];
}

export const SECTION_TYPES: SectionType[] = [
  {
    type: 'hero',
    name: 'Hero',
    icon: '🏔️',
    category: 'hero',
    description: 'Full-bleed image background with eyebrow + headline + subtitle + two CTAs. Use once at the top of a page.',
    blocks: [
      { key: 'eyebrow', block_type: 'plain_text', display_name: 'Eyebrow label', default_text: 'Section · Eyebrow' },
      { key: 'headline_line1', block_type: 'plain_text', display_name: 'Headline (first line)', default_text: 'New page' },
      { key: 'headline_line2_italic', block_type: 'plain_text', display_name: 'Headline (italic gold line)', default_text: 'subtitle.' },
      { key: 'subtitle', block_type: 'rich_text', display_name: 'Subtitle paragraph', default_html: 'A short subtitle paragraph below the headline.' },
      { key: 'cta_primary_label', block_type: 'plain_text', display_name: 'Primary button label', default_text: 'Reserve Your Site' },
      { key: 'cta_primary_url', block_type: 'url', display_name: 'Primary button link', default_text: 'https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK' },
      { key: 'cta_secondary_label', block_type: 'plain_text', display_name: 'Secondary button label', default_text: 'Learn more' },
      { key: 'cta_secondary_url', block_type: 'url', display_name: 'Secondary button link', default_text: '#' },
      { key: 'background_image', block_type: 'image', display_name: 'Background image', default_image_url: '/images/hero.jpg', default_image_alt: 'Crooked River Ranch RV Park', default_image_width: 1400, default_image_height: 933 },
    ],
  },
  {
    type: 'trust_bar',
    name: 'Trust Bar',
    icon: '⭐',
    category: 'list',
    description: 'Horizontal strip of icon + short text items. Best with 5-7 items max.',
    blocks: [
      { key: 'items', block_type: 'json', display_name: 'Trust items', default_json: [
        { icon: '⛳', text: 'Item one' },
        { icon: '🏔️', text: 'Item two' },
        { icon: '🚐', text: 'Item three' },
      ] },
    ],
  },
  {
    type: 'two_col',
    name: 'Two-Column Section',
    icon: '📰',
    category: 'content',
    description: 'Heading + body text + optional feature list on one side, image on the other. Most common content section.',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'Section Label' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'New section.' },
      { key: 'headline_italic', block_type: 'plain_text', display_name: 'Headline (italic rust line)', default_text: 'continued.' },
      { key: 'body', block_type: 'rich_text', display_name: 'Body paragraph', default_html: 'Section body content goes here.' },
      { key: 'feature_list', block_type: 'json', display_name: 'Optional feature list (3 numbered items)', notes: 'Leave empty array [] to hide. Otherwise: [{"num":"01","title":"...","body":"..."}]', default_json: [] },
      { key: 'image', block_type: 'image', display_name: 'Section image', default_image_url: '/images/canyon_day.jpg', default_image_alt: 'Section image', default_image_width: 1400, default_image_height: 932 },
      { key: 'image_caption', block_type: 'plain_text', display_name: 'Image caption (overlay)', default_text: '' },
      { key: 'cta_label', block_type: 'plain_text', display_name: 'Optional CTA label', default_text: '' },
      { key: 'cta_url', block_type: 'url', display_name: 'Optional CTA link', default_text: '' },
      { key: 'image_left', block_type: 'boolean', display_name: 'Image on left side', notes: 'Default: text left, image right. Toggle to swap.', default_boolean: false },
    ],
  },
  {
    type: 'interlude',
    name: 'Interlude (full-bleed image with overlay text)',
    icon: '🌌',
    category: 'media',
    description: 'Dramatic full-width image with text overlay. Like the stargazing section.',
    blocks: [
      { key: 'eyebrow', block_type: 'plain_text', display_name: 'Eyebrow label', default_text: 'Eyebrow' },
      { key: 'headline', block_type: 'rich_text', display_name: 'Headline (multi-line, supports <br> + <em>)', default_html: 'A dramatic<br>multi-line<br><em>headline.</em>' },
      { key: 'body', block_type: 'rich_text', display_name: 'Body paragraph', default_html: 'A short body paragraph.' },
      { key: 'credit', block_type: 'plain_text', display_name: 'Optional credit line', default_text: '' },
      { key: 'background_image', block_type: 'image', display_name: 'Background image', default_image_url: '/images/stars.jpg', default_image_alt: 'Background', default_image_width: 1400, default_image_height: 933 },
      { key: 'cta_label', block_type: 'plain_text', display_name: 'Optional CTA label', default_text: '' },
      { key: 'cta_url', block_type: 'url', display_name: 'Optional CTA link', default_text: '' },
    ],
  },
  {
    type: 'card_grid',
    name: 'Card Grid (icon + name + description)',
    icon: '⊞',
    category: 'list',
    description: 'Responsive grid of cards. Each card has an icon, title, and short description. Good for amenities, features.',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'On Property' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Cards.' },
      { key: 'headline_italic', block_type: 'plain_text', display_name: 'Headline (italic rust line)', default_text: 'continued.' },
      { key: 'cards', block_type: 'json', display_name: 'Cards', notes: 'Format: [{"icon":"⛳","name":"Title","desc":"Description"}]', default_json: [
        { icon: '⛳', name: 'First card', desc: 'Card description.' },
        { icon: '🍺', name: 'Second card', desc: 'Card description.' },
        { icon: '🏊', name: 'Third card', desc: 'Card description.' },
      ] },
    ],
  },
  {
    type: 'site_cards',
    name: 'Site Type Cards (RV park-specific)',
    icon: '🏕️',
    category: 'data',
    description: 'Featured grid of site/rate cards. Each card has badge, title, description, tags, and pricing. Specifically for RV park rate offerings.',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'Site Types' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: '109 sites.' },
      { key: 'headline_italic', block_type: 'plain_text', display_name: 'Headline (italic rust line)', default_text: 'Find your fit.' },
      { key: 'intro', block_type: 'rich_text', display_name: 'Intro paragraph', default_html: 'Description of the site types available.' },
      { key: 'cards', block_type: 'json', display_name: 'Site cards', notes: 'Format: [{"featured":true,"badge":"Most Popular","title":"...","description":"...","tags":[{"text":"...","highlight":true}],"price_nightly":62,"price_weekly":372}]', default_json: [
        { featured: true, badge: 'Most Popular', title: 'Card title', description: 'Card description.', tags: [{ text: 'Tag', highlight: true }], price_nightly: 0, price_weekly: 0 },
      ] },
    ],
  },
  {
    type: 'explore_grid',
    name: 'Explore / Destination Cards',
    icon: '🗺️',
    category: 'list',
    description: 'Grid of destination cards with photo + distance badge + title + description. Linkable.',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'The Region' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Explore' },
      { key: 'headline_italic', block_type: 'plain_text', display_name: 'Headline (italic rust line)', default_text: 'Central Oregon.' },
      { key: 'intro', block_type: 'rich_text', display_name: 'Intro paragraph', default_html: 'Short intro about the region.' },
      { key: 'cards', block_type: 'json', display_name: 'Destination cards', notes: 'Format: [{"image":"/images/foo.jpg","alt":"...","distance":"15 min","title":"Smith Rock","desc":"...","href":"/area-guide.html#smith-rock"}]', default_json: [
        { image: '/images/smith_rock.jpg', alt: 'Smith Rock', distance: '15 min', title: 'Smith Rock', desc: 'Description.', href: '/area-guide.html#smith-rock' },
      ] },
    ],
  },
  {
    type: 'reviews',
    name: 'Customer Reviews',
    icon: '⭐',
    category: 'list',
    description: 'Section with overall rating + grid of review cards (stars + quote + author + meta).',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'Google Reviews' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Guests keep' },
      { key: 'headline_italic', block_type: 'plain_text', display_name: 'Headline (italic rust line)', default_text: 'coming back.' },
      { key: 'rating', block_type: 'plain_text', display_name: 'Average rating (e.g. "5.0")', default_text: '5.0' },
      { key: 'reviews_link', block_type: 'url', display_name: 'Link to all reviews (Google Maps URL)', default_text: 'https://www.google.com/maps/search/Crooked+River+Ranch+RV+Park' },
      { key: 'reviews', block_type: 'json', display_name: 'Review cards', notes: 'Format: [{"stars":5,"quote":"...","author":"Name","meta":"Vacation · Family"}]', default_json: [
        { stars: 5, quote: 'Review quote', author: 'Author Name', meta: 'Vacation · Family' },
      ] },
    ],
  },
  {
    type: 'cta_banner',
    name: 'CTA Banner',
    icon: '📣',
    category: 'cta',
    description: 'Single-line banner with heading + body + button. Use to direct visitors to a specific action.',
    blocks: [
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Ready to book?' },
      { key: 'body', block_type: 'rich_text', display_name: 'Body text', default_html: 'A short call-to-action body.' },
      { key: 'cta_label', block_type: 'plain_text', display_name: 'Button label', default_text: 'Book Now' },
      { key: 'cta_url', block_type: 'url', display_name: 'Button link', default_text: 'https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK' },
      { key: 'dark_background', block_type: 'boolean', display_name: 'Dark background', default_boolean: true },
    ],
  },
  {
    type: 'text_block',
    name: 'Text Block (long-form prose)',
    icon: '📄',
    category: 'content',
    description: 'Single column of rich text. For policies, terms, articles, long-form descriptions.',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label (optional)', default_text: '' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline (optional)', default_text: '' },
      { key: 'body', block_type: 'rich_text', display_name: 'Body content', default_html: 'Long-form text content goes here.' },
    ],
  },
  {
    type: 'events_widget',
    name: 'Upcoming Events Widget',
    icon: '📅',
    category: 'special',
    description: 'Auto-pulls upcoming events from Zoho Calendar. Shows next N events as cards.',
    blocks: [
      { key: 'heading', block_type: 'plain_text', display_name: 'Section heading', default_text: 'Upcoming events' },
      { key: 'limit', block_type: 'number', display_name: 'Number of events to show', default_number: 3 },
      { key: 'show_link_to_all', block_type: 'boolean', display_name: 'Show "All events →" link', default_boolean: true },
    ],
  },
  {
    type: 'reserve_form',
    name: 'Reserve / Contact Form',
    icon: '📨',
    category: 'special',
    description: 'Contact form with name, email, phone, dates, rig type, message. Submits to Netlify Forms.',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'Reservations' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Your site' },
      { key: 'headline_italic', block_type: 'plain_text', display_name: 'Headline (italic rust line)', default_text: 'is waiting.' },
      { key: 'body', block_type: 'rich_text', display_name: 'Body paragraph', default_html: 'Description above the form.' },
      { key: 'form_name', block_type: 'plain_text', display_name: 'Netlify Form name', notes: 'Used internally by Netlify Forms', default_text: 'contact' },
    ],
  },
  {
    type: 'rates_table',
    name: 'Rates Table',
    icon: '💵',
    category: 'data',
    description: 'Dark-theme table of rates by site type. Used on book-now page.',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'Rates' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Site rates.' },
      { key: 'rows', block_type: 'json', display_name: 'Rate rows', notes: 'Format: [{"name":"Full Hookup","nightly":62,"weekly":372,"monthly":850,"notes":""}]', default_json: [
        { name: 'Full Hookup', nightly: 62, weekly: 372, monthly: 850, notes: '' },
      ] },
    ],
  },
  {
    type: 'feature_list',
    name: 'Numbered Feature List',
    icon: '🔢',
    category: 'list',
    description: 'Three-item numbered feature list with bold title + supporting text. Standalone (not embedded in two-col).',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'Features' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Why us.' },
      { key: 'features', block_type: 'json', display_name: 'Features', notes: 'Format: [{"num":"01","title":"...","body":"..."}]', default_json: [
        { num: '01', title: 'First feature', body: 'Description.' },
        { num: '02', title: 'Second feature', body: 'Description.' },
        { num: '03', title: 'Third feature', body: 'Description.' },
      ] },
    ],
  },
  {
    type: 'amenity_grid',
    name: 'Amenity Grid (RV park-specific)',
    icon: '🏊',
    category: 'list',
    description: 'Same as Card Grid but specifically tuned for amenities (icon + name + description).',
    blocks: [
      { key: 'label', block_type: 'plain_text', display_name: 'Section label', default_text: 'On Property' },
      { key: 'headline', block_type: 'plain_text', display_name: 'Headline', default_text: 'Everything you need.' },
      { key: 'headline_italic', block_type: 'plain_text', display_name: 'Headline (italic rust line)', default_text: 'Then some.' },
      { key: 'cards', block_type: 'json', display_name: 'Amenity cards', notes: 'Format: [{"icon":"⛳","name":"Title","desc":"Description"}]', default_json: [
        { icon: '⛳', name: 'Amenity', desc: 'Description.' },
      ] },
    ],
  },
];

export function getSectionType(type: string): SectionType | undefined {
  return SECTION_TYPES.find((t) => t.type === type);
}

/** Group section types by category for the picker UI */
export function groupedSectionTypes(): Record<string, SectionType[]> {
  const out: Record<string, SectionType[]> = {};
  for (const t of SECTION_TYPES) {
    if (!out[t.category]) out[t.category] = [];
    out[t.category].push(t);
  }
  return out;
}

export const CATEGORY_LABELS: Record<string, string> = {
  hero: 'Hero / Top of Page',
  content: 'Content Sections',
  media: 'Media-Forward',
  list: 'Lists & Grids',
  cta: 'Calls to Action',
  data: 'Data Tables',
  special: 'Special / Auto-Updating',
};
