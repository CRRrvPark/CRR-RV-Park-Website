/**
 * Normalize legacy Puck component data on load.
 *
 * Historical reason: several section components stored their repeated
 * child items as a single JSON string in a `textarea` field (e.g.
 * `cards: '[{"name": "…"}]'`). V3.1 item 5 migrated those to Puck's
 * native `array` field type, which expects a real array. Existing pages
 * still have the old string values until they're re-saved, which means
 * the array UI in the right panel shows empty inputs even though the
 * canvas still renders the data correctly (render() parses either shape).
 *
 * This helper walks the content array and converts any known
 * array-valued field from JSON string → parsed array so the editor
 * and the DB stay in sync after the first save.
 *
 * Also handles the SiteCards `specs` → `specsText` shape change: legacy
 * data stores `specs: ["50 AMP", ...]`; the new UI collects a
 * comma-separated string `specsText`. We convert once on load.
 */

type AnyProps = Record<string, unknown>;

/** Map of component.type → list of prop keys that should be arrays. */
const ARRAY_FIELDS: Record<string, string[]> = {
  CardGridSection: ['cards'],
  SiteCardsSection: ['cards'],
  ExploreGridSection: ['cards'],
  ReviewsSection: ['reviews'],
  AmenityGridSection: ['cards'],
  FeatureListSection: ['features'],
  RatesTableSection: ['rows'],
  TrustBarSection: ['items'],
  TwoColumnSection: ['featureList'],
};

function parseArrayField(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Convert a SiteCards card from legacy { specs: string[] } to { specsText }. */
function normalizeSiteCard(card: AnyProps): AnyProps {
  if (Array.isArray(card.specs) && !('specsText' in card)) {
    return {
      ...card,
      specsText: card.specs.filter((s) => typeof s === 'string').join(', '),
    };
  }
  return card;
}

export function migratePuckData<T extends { content?: unknown[] } | null | undefined>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const content = (data as any).content;
  if (!Array.isArray(content)) return data;

  const nextContent = content.map((item: any) => {
    if (!item || typeof item !== 'object') return item;
    const type = item.type;
    const fields = ARRAY_FIELDS[type];
    if (!fields) return item;

    const nextProps: AnyProps = { ...(item.props ?? {}) };
    let changed = false;

    for (const key of fields) {
      const raw = nextProps[key];
      if (Array.isArray(raw)) continue;
      const parsed = parseArrayField(raw);
      if (parsed !== raw) {
        nextProps[key] = parsed;
        changed = true;
      }
    }

    // SiteCards: specs[] → specsText
    if (type === 'SiteCardsSection' && Array.isArray(nextProps.cards)) {
      const converted = (nextProps.cards as AnyProps[]).map(normalizeSiteCard);
      if (converted.some((c, i) => c !== (nextProps.cards as AnyProps[])[i])) {
        nextProps.cards = converted;
        changed = true;
      }
    }

    return changed ? { ...item, props: nextProps } : item;
  });

  return { ...(data as any), content: nextContent } as T;
}
