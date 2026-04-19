/**
 * POST /api/builder/repair-home
 *
 * One-click content repair for the home page. Looks at the current Puck
 * `page_builder_data` for slug=index and:
 *
 *   - Fills empty SiteCardsSection cards with the canonical 4-card content
 *     from the reference multipage site (Full Hookup / W&E / Tent / Dry Camp).
 *   - Sets any InterludeSection that's missing a `backgroundImageUrl` to
 *     `/images/stars.jpg` (the Dark Skies nebula image that ships with the
 *     public/images/ folder).
 *
 * Always creates a pre-repair version snapshot first so the operator can
 * roll back from the Versions tab. Idempotent — safe to run twice.
 *
 * This exists because the Puck data that migrated into the new admin ended
 * up with empty card objects and an empty Interlude background, which
 * caused empty boxes + invisible text on the live site.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireRole, handleError, json } from '@lib/api';
import { logAudit, requestContext } from '@lib/audit';

export const prerender = false;

const REFERENCE_SITE_CARDS = [
  {
    label: 'Most Popular',
    name: 'Full Hookup RV Site',
    desc: 'Water, electric (30/50 amp), and sewer at every site. Back-in and pull-through options. Most sites accommodate slide-outs on both sides.',
    specs: [
      "Up to 65' pull-through",
      '30 & 50 amp',
      'Water, Electric, Sewer',
      'Both slide-outs',
      'Pets welcome (2 max)',
      '🔌 EV Charging',
    ],
    price: 'From $62',
    pricePer: '/night',
    featured: true,
  },
  {
    label: 'Water & Electric',
    name: 'W&E Sites',
    desc: '30/50 amp electric and water — no sewer hookup. Good for shorter stays. Back-in configuration, sites up to 50\u2019.',
    specs: [
      "Up to 50' back-in",
      '30 & 50 amp',
      'Dump station available',
      '🔌 EV Charging',
    ],
    price: 'From $57',
    pricePer: '/night',
    featured: false,
  },
  {
    label: 'Tent & Rooftop Tents',
    name: 'Tent Sites',
    desc: '19 standard tent sites plus the legendary Magic Tent — a site beneath the trees named by our own campers.',
    specs: [
      'Magic Tent available',
      'Rooftop tent compatible',
      'No hookups',
    ],
    price: 'From $36',
    pricePer: '/night',
    featured: false,
  },
  {
    label: 'Van Life / Small Rigs',
    name: 'Dry Camp',
    desc: "No hookups. Single vehicles up to 25'. Vans, truck campers, and small rigs only. No trailers or 5th wheels.",
    specs: [
      "25' max length",
      'Vans & truck campers',
      'Dump station available',
    ],
    price: 'From $36',
    pricePer: '/night',
    featured: false,
  },
];

const DEFAULT_INTERLUDE_BG = '/images/stars.jpg';

interface PuckItem {
  type: string;
  props: Record<string, any>;
  [k: string]: any;
}

function cardIsEmpty(c: any): boolean {
  if (!c || typeof c !== 'object') return true;
  return !c.name && !c.label && !c.desc && !c.price;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'publish_content');
    const sb = serverClient();

    // Load home page
    const { data: page, error: pageErr } = await sb
      .from('pages')
      .select('id, page_builder_data, use_page_builder')
      .eq('slug', 'index')
      .single();
    if (pageErr || !page) return json({ error: 'Home page not found' }, 404);

    const data = (page.page_builder_data ?? { content: [], root: { props: {} }, zones: {} }) as { content: PuckItem[]; root: any; zones: any };
    if (!Array.isArray(data.content)) data.content = [];

    // Create a safety snapshot first
    await sb.from('page_versions').insert({
      page_id: page.id,
      data: page.page_builder_data ?? {},
      reason: 'manual',
      label: 'Pre-repair snapshot (auto)',
      saved_by: user.id,
    });

    const changes: string[] = [];

    for (const item of data.content) {
      if (!item || typeof item !== 'object' || !item.props) continue;

      // --- SiteCardsSection: fill empty cards ---
      if (item.type === 'SiteCardsSection') {
        let current: any[] = [];
        try {
          current = typeof item.props.cards === 'string'
            ? JSON.parse(item.props.cards)
            : Array.isArray(item.props.cards) ? item.props.cards : [];
        } catch { current = []; }

        const allEmpty = current.length === 0 || current.every(cardIsEmpty);
        if (allEmpty) {
          item.props.cards = JSON.stringify(REFERENCE_SITE_CARDS);
          changes.push(`SiteCardsSection: seeded ${REFERENCE_SITE_CARDS.length} cards`);
        } else {
          // Partial fill — only replace explicitly empty entries, preserve the rest
          const patched = current.map((c, idx) =>
            cardIsEmpty(c) && REFERENCE_SITE_CARDS[idx] ? REFERENCE_SITE_CARDS[idx] : c
          );
          if (JSON.stringify(patched) !== JSON.stringify(current)) {
            item.props.cards = JSON.stringify(patched);
            changes.push('SiteCardsSection: filled empty card slots');
          }
        }
      }

      // --- InterludeSection: backfill empty backgroundImageUrl ---
      if (item.type === 'InterludeSection') {
        if (!item.props.backgroundImageUrl) {
          item.props.backgroundImageUrl = DEFAULT_INTERLUDE_BG;
          changes.push(`InterludeSection: set backgroundImageUrl to ${DEFAULT_INTERLUDE_BG}`);
        }
      }
    }

    if (changes.length === 0) {
      return json({ ok: true, changes: [], note: 'Home page content already looks good — nothing to repair.' });
    }

    // Write the repaired data back and make sure the page is using the builder
    const { error: updErr } = await sb
      .from('pages')
      .update({
        page_builder_data: data,
        use_page_builder: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', page.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Commit a post-repair version too so the history is clear
    await sb.from('page_versions').insert({
      page_id: page.id,
      data,
      reason: 'manual',
      label: `Auto-repair: ${changes.length} change${changes.length === 1 ? '' : 's'}`,
      saved_by: user.id,
    });

    // Clear any stale draft so the builder loads the repaired live data
    await sb.from('page_drafts').delete().eq('page_id', page.id);

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'content_publish_request',
      targetTable: 'pages',
      targetId: page.id,
      targetLabel: `Home page content auto-repair (${changes.length} change${changes.length === 1 ? '' : 's'})`,
      ...requestContext(request),
    });

    return json({ ok: true, changes });
  } catch (err) {
    return handleError(err);
  }
};
