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
 *
 * V4 additions:
 *   • Hero flat-prop → atom-zone migration. Legacy heroes store eyebrow,
 *     headlineLine1, headlineLine2Italic, subtitle, ctaPrimary*, ctaSecondary*
 *     as flat props on HeroSection. V4 represents each as its own Puck
 *     component (EditableEyebrow / EditableHeading / EditableRichText /
 *     EditableButton) inside two zones ("hero-main" and "hero-ctas"). This
 *     migrator lifts flat props into those zones and clears the flat props
 *     so the hero renders through the zone path instead of the fallback.
 *     Idempotent: runs only when zones for the hero are empty.
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

/**
 * Build the two hero zones from a hero's legacy flat props.
 * Returns null if the hero has no flat content to lift.
 */
function buildHeroZones(heroId: string, heroProps: AnyProps): {
  heroMain: AnyProps[];
  heroCtas: AnyProps[];
  remainingProps: AnyProps;
} | null {
  const eyebrow = typeof heroProps.eyebrow === 'string' ? heroProps.eyebrow.trim() : '';
  const line1 = typeof heroProps.headlineLine1 === 'string' ? heroProps.headlineLine1.trim() : '';
  const line2 = typeof heroProps.headlineLine2Italic === 'string' ? heroProps.headlineLine2Italic.trim() : '';
  const subtitle = typeof heroProps.subtitle === 'string' ? heroProps.subtitle.trim() : '';
  const ctaPrimaryLabel = typeof heroProps.ctaPrimaryLabel === 'string' ? heroProps.ctaPrimaryLabel.trim() : '';
  const ctaPrimaryUrl = typeof heroProps.ctaPrimaryUrl === 'string' ? heroProps.ctaPrimaryUrl : '';
  const ctaSecondaryLabel = typeof heroProps.ctaSecondaryLabel === 'string' ? heroProps.ctaSecondaryLabel.trim() : '';
  const ctaSecondaryUrl = typeof heroProps.ctaSecondaryUrl === 'string' ? heroProps.ctaSecondaryUrl : '';

  const hasAny = !!(eyebrow || line1 || line2 || subtitle || ctaPrimaryLabel || ctaSecondaryLabel);
  if (!hasAny) return null;

  const heroMain: AnyProps[] = [];
  if (eyebrow) {
    heroMain.push({
      type: 'EditableEyebrow',
      props: {
        id: `${heroId}-eyebrow`,
        text: eyebrow,
        tag: 'div',
        className: 'hero-eyebrow',
      },
    });
  }
  if (line1 || line2) {
    heroMain.push({
      type: 'EditableHeading',
      props: {
        id: `${heroId}-heading`,
        text: line1 || '',
        level: 1,
        italic: false,
        line2Italic: line2 || '',
        className: 'hero-hl',
      },
    });
  }
  if (subtitle) {
    heroMain.push({
      type: 'EditableRichText',
      props: {
        id: `${heroId}-sub`,
        html: subtitle,
        className: 'hero-sub',
      },
    });
  }

  const heroCtas: AnyProps[] = [];
  if (ctaPrimaryLabel) {
    heroCtas.push({
      type: 'EditableButton',
      props: {
        id: `${heroId}-cta-primary`,
        label: ctaPrimaryLabel,
        url: ctaPrimaryUrl,
        variant: 'primary',
        className: '',
        openInNewTab: false,
      },
    });
  }
  if (ctaSecondaryLabel) {
    heroCtas.push({
      type: 'EditableButton',
      props: {
        id: `${heroId}-cta-secondary`,
        label: ctaSecondaryLabel,
        url: ctaSecondaryUrl,
        variant: 'secondary',
        className: '',
        openInNewTab: false,
      },
    });
  }

  // Clear lifted flat props so the HeroSection renderer falls through to
  // the DropZone branch. Keep structural props (background, bgObjectFit,
  // id, styleFields) intact.
  const remainingProps: AnyProps = { ...heroProps };
  for (const key of [
    'eyebrow', 'headlineLine1', 'headlineLine2Italic', 'subtitle',
    'ctaPrimaryLabel', 'ctaPrimaryUrl', 'ctaSecondaryLabel', 'ctaSecondaryUrl',
  ]) {
    remainingProps[key] = '';
  }

  return { heroMain, heroCtas, remainingProps };
}

export function migratePuckData<T extends { content?: unknown[] } | null | undefined>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const content = (data as any).content;
  if (!Array.isArray(content)) return data;

  const zonesIn: Record<string, unknown[]> = ((data as any).zones && typeof (data as any).zones === 'object')
    ? { ...(data as any).zones }
    : {};
  const zonesOut: Record<string, unknown[]> = { ...zonesIn };
  let zonesChanged = false;

  const nextContent = content.map((item: any) => {
    if (!item || typeof item !== 'object') return item;
    const type = item.type;

    // ── V4 Hero migration: flat props → atoms in zones ──
    if (type === 'HeroSection') {
      const heroId = typeof item.props?.id === 'string' ? item.props.id : '';
      const mainKey = `${heroId}:hero-main`;
      const ctasKey = `${heroId}:hero-ctas`;
      const existingMain = zonesIn[mainKey];
      const existingCtas = zonesIn[ctasKey];
      const hasZones = Array.isArray(existingMain) && existingMain.length > 0
        || Array.isArray(existingCtas) && existingCtas.length > 0;

      // Only migrate when we have an id and no zones have been populated yet.
      if (heroId && !hasZones) {
        const built = buildHeroZones(heroId, item.props || {});
        if (built) {
          zonesOut[mainKey] = built.heroMain;
          zonesOut[ctasKey] = built.heroCtas;
          zonesChanged = true;
          return { ...item, props: built.remainingProps };
        }
      }
      // Hero has zones already (already-migrated) or no content to lift.
      // Still fall through to legacy array-field normalization below.
    }

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

  const result: any = { ...(data as any), content: nextContent };
  if (zonesChanged) result.zones = zonesOut;
  return result as T;
}
