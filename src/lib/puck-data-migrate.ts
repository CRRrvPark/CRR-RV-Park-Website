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
 *   • Section-chrome migration for 9 standard-pattern sections
 *     (TwoColumn, CardGrid, SiteCards, Explore, Reviews, ReserveForm,
 *     FeatureList, AmenityGrid, EventsWidget): lifts label + headline
 *     (+ inlineItalic for most) + body/intro into a `section-chrome` zone.
 *     TwoColumnSection additionally lifts ctaLabel/ctaUrl into a
 *     `section-ctas` zone. CtaBanner, RatesTable, Interlude, ImageBlock,
 *     TrustBar are intentionally not migrated — either they carry inline
 *     styles that atoms can't currently express without a dedicated
 *     inlineStyle field (CtaBanner, RatesTable, Interlude), or they have
 *     no chrome to lift (ImageBlock, TrustBar).
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
 * V4 per-section chrome migration config.
 *
 * Each entry describes how to lift a section's legacy flat chrome props
 * (label, headline, headlineItalic, body/intro) into atoms in the
 * `section-chrome` zone. `headline` is required when `useHeading` is true;
 * other fields are optional.
 *
 * `bodyKey` = which flat prop holds the rich-text body ('body' | 'intro').
 * `bodyClass` = the public-site CSS class wrapping the body text
 * ('section-body' | 'sites-intro' | etc.) — preserved on the atom so
 * emitted HTML stays byte-identical.
 *
 * `useLabel` = whether to lift `label` into an EditableEyebrow atom.
 * `useItalicInline` = whether to map `headlineItalic` to EditableHeading's
 * `inlineItalic` field (space + italic pattern).
 *
 * Sections omitted from this table are NOT migrated (CtaBanner, RatesTable,
 * Interlude, ImageBlock, TrustBar). Their legacy path remains active.
 */
interface SectionChromeConfig {
  useLabel?: boolean;
  useHeading?: boolean;
  useItalicInline?: boolean;
  headingLevel?: number;
  headingClass?: string;
  bodyKey?: 'body' | 'intro';
  bodyClass?: string;
  headingKey?: 'headline' | 'heading';
}

const SECTION_CHROME: Record<string, SectionChromeConfig> = {
  TwoColumnSection: {
    useLabel: true,
    useHeading: true,
    useItalicInline: true,
    headingLevel: 2,
    headingClass: 'st',
    bodyKey: 'body',
    bodyClass: 'section-body',
  },
  CardGridSection: {
    useLabel: true,
    useHeading: true,
    useItalicInline: true,
    headingLevel: 2,
    headingClass: 'st',
  },
  SiteCardsSection: {
    useLabel: true,
    useHeading: true,
    useItalicInline: true,
    headingLevel: 2,
    headingClass: 'st',
    bodyKey: 'intro',
    bodyClass: 'sites-intro',
  },
  ExploreGridSection: {
    useLabel: true,
    useHeading: true,
    useItalicInline: true,
    headingLevel: 2,
    headingClass: 'st',
    bodyKey: 'intro',
    bodyClass: 'section-body',
  },
  ReviewsSection: {
    useLabel: true,
    useHeading: true,
    useItalicInline: true,
    headingLevel: 2,
    headingClass: 'st',
  },
  ReserveFormSection: {
    useLabel: true,
    useHeading: true,
    useItalicInline: true,
    headingLevel: 2,
    headingClass: 'st',
    bodyKey: 'body',
    bodyClass: 'section-body',
  },
  FeatureListSection: {
    useLabel: true,
    useHeading: true,
    headingLevel: 2,
    headingClass: 'st',
  },
  AmenityGridSection: {
    useLabel: true,
    useHeading: true,
    useItalicInline: true,
    headingLevel: 2,
    headingClass: 'st',
  },
  // EventsWidgetSection is intentionally omitted — public-site renderer
  // hard-codes a "What's Happening" label span and inline h2 styles that
  // atoms cannot currently reproduce byte-identically.
};

/**
 * Build the section-chrome zone atoms + cleared props for a standard
 * chrome-pattern section. Returns null if the section has no flat content
 * worth lifting (so the migrator doesn't produce empty zones).
 */
function buildSectionChrome(
  itemType: string,
  itemId: string,
  props: AnyProps,
): { atoms: AnyProps[]; remaining: AnyProps } | null {
  const cfg = SECTION_CHROME[itemType];
  if (!cfg) return null;

  const headingKey = cfg.headingKey || 'headline';
  const label = cfg.useLabel && typeof props.label === 'string' ? props.label.trim() : '';
  const headline = cfg.useHeading && typeof props[headingKey] === 'string' ? (props[headingKey] as string).trim() : '';
  const headlineItalic = cfg.useItalicInline && typeof props.headlineItalic === 'string' ? props.headlineItalic.trim() : '';
  const body = cfg.bodyKey && typeof props[cfg.bodyKey] === 'string' ? (props[cfg.bodyKey] as string).trim() : '';

  if (!label && !headline && !headlineItalic && !body) return null;

  const atoms: AnyProps[] = [];
  if (label) {
    atoms.push({
      type: 'EditableEyebrow',
      props: {
        id: `${itemId}-label`,
        text: label,
        tag: 'span',
        className: 'section-label',
      },
    });
  }
  if (headline || headlineItalic) {
    atoms.push({
      type: 'EditableHeading',
      props: {
        id: `${itemId}-heading`,
        text: headline,
        level: cfg.headingLevel || 2,
        italic: false,
        line2Italic: '',
        inlineItalic: headlineItalic,
        className: cfg.headingClass || '',
      },
    });
  }
  if (body && cfg.bodyKey) {
    atoms.push({
      type: 'EditableRichText',
      props: {
        id: `${itemId}-${cfg.bodyKey}`,
        html: body,
        className: cfg.bodyClass || '',
      },
    });
  }

  const remaining: AnyProps = { ...props };
  if (cfg.useLabel) remaining.label = '';
  remaining[headingKey] = '';
  if (cfg.useItalicInline) remaining.headlineItalic = '';
  if (cfg.bodyKey) remaining[cfg.bodyKey] = '';

  return { atoms, remaining };
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
    const itemId: string = typeof item.props?.id === 'string' ? item.props.id : '';
    let workingItem = item;

    // ── V4 Hero migration: flat props → atoms in zones ──
    if (type === 'HeroSection') {
      const mainKey = `${itemId}:hero-main`;
      const ctasKey = `${itemId}:hero-ctas`;
      const existingMain = zonesIn[mainKey];
      const existingCtas = zonesIn[ctasKey];
      const hasZones = Array.isArray(existingMain) && existingMain.length > 0
        || Array.isArray(existingCtas) && existingCtas.length > 0;

      // Only migrate when we have an id and no zones have been populated yet.
      if (itemId && !hasZones) {
        const built = buildHeroZones(itemId, item.props || {});
        if (built) {
          zonesOut[mainKey] = built.heroMain;
          zonesOut[ctasKey] = built.heroCtas;
          zonesChanged = true;
          workingItem = { ...item, props: built.remainingProps };
        }
      }
      // Hero has zones already (already-migrated) or no content to lift.
    }

    // ── V4 section-chrome migration (9 standard chrome-pattern sections) ──
    if (SECTION_CHROME[type] && itemId) {
      const chromeKey = `${itemId}:section-chrome`;
      const existingChrome = zonesIn[chromeKey];
      const hasChrome = Array.isArray(existingChrome) && existingChrome.length > 0;
      if (!hasChrome) {
        const built = buildSectionChrome(type, itemId, workingItem.props || {});
        if (built) {
          zonesOut[chromeKey] = built.atoms;
          zonesChanged = true;
          workingItem = { ...workingItem, props: built.remaining };
        }
      }
    }

    // ── V4 TwoColumnSection CTA migration: ctaLabel/ctaUrl → section-ctas zone ──
    if (type === 'TwoColumnSection' && itemId) {
      const ctasKey = `${itemId}:section-ctas`;
      const existingCtas = zonesIn[ctasKey];
      const hasCtas = Array.isArray(existingCtas) && existingCtas.length > 0;
      if (!hasCtas) {
        const p = workingItem.props || {};
        const ctaLabel = typeof p.ctaLabel === 'string' ? p.ctaLabel.trim() : '';
        if (ctaLabel) {
          zonesOut[ctasKey] = [{
            type: 'EditableButton',
            props: {
              id: `${itemId}-cta`,
              label: ctaLabel,
              url: typeof p.ctaUrl === 'string' ? p.ctaUrl : '',
              variant: 'custom',
              className: '',
              openInNewTab: false,
            },
          }];
          zonesChanged = true;
          workingItem = { ...workingItem, props: { ...p, ctaLabel: '', ctaUrl: '' } };
        }
      }
    }

    const fields = ARRAY_FIELDS[type];
    if (!fields) return workingItem;

    const nextProps: AnyProps = { ...(workingItem.props ?? {}) };
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

    return changed ? { ...workingItem, props: nextProps } : workingItem;
  });

  const result: any = { ...(data as any), content: nextContent };
  if (zonesChanged) result.zones = zonesOut;
  return result as T;
}
