/**
 * Puck data sanitizer — runs on every /api/builder/save before data touches
 * the DB or gets published to the public site.
 *
 * WHY THIS EXISTS (HIGH-4 in SECURITY-AND-BUGS-REPORT.md):
 *
 * The legacy section editor (`/api/content/blocks` PATCH) already sanitizes
 * rich-text HTML and URL fields. The Visual Builder (Puck) save endpoint
 * stored the entire Puck JSON blob untouched — meaning any contributor with
 * draft access could inject stored XSS (scripts in rich-text body props) that
 * would fire for every public site visitor once an editor approved and
 * published the draft. This module closes that gap.
 *
 * HOW:
 *   - Traverse Puck's content[] array
 *   - For each component item, sanitize its props based on a per-component
 *     allow-list of field names → sanitizer function
 *   - Unknown components pass through untouched (so adding a new component
 *     to puck-config.tsx doesn't break saves — but their fields won't be
 *     sanitized until declared here)
 *   - Never reshape the data — only replace string values in place
 *
 * EXTENDING:
 *   When adding a new component in puck-config.tsx, also add its rich-text
 *   and URL fields to `COMPONENT_FIELD_MAP` below.
 */

/** Fields on each component whose values need sanitization. */
type FieldKind = 'html' | 'url' | 'json';

interface FieldSpec {
  kind: FieldKind;
}

type ComponentFieldMap = Record<string, Record<string, FieldSpec>>;

/**
 * Declarative map: for each Puck component type, which props carry
 * rich HTML (need HTML sanitization) or URLs (need scheme validation)?
 *
 * Derived by reading src/lib/puck-config.tsx + src/components/react/puck-components/sections.tsx
 * and marking every field defined with `richTextField(...)` as html and every
 * URL-shaped field (ending in Url, href, url, Link, linkUrl) as url.
 */
const COMPONENT_FIELD_MAP: ComponentFieldMap = {
  TextBlock: {
    body: { kind: 'html' },
  },
  HeroSection: {
    subtitle: { kind: 'html' },
    ctaPrimaryUrl: { kind: 'url' },
    ctaSecondaryUrl: { kind: 'url' },
    backgroundImageUrl: { kind: 'url' },
  },
  TwoColumnSection: {
    body: { kind: 'html' },
    image: { kind: 'url' },
    ctaUrl: { kind: 'url' },
    featureList: { kind: 'json' },
  },
  CardGridSection: {
    cards: { kind: 'json' },
  },
  SiteCardsSection: {
    intro: { kind: 'html' },
    cards: { kind: 'json' },
  },
  ExploreGridSection: {
    intro: { kind: 'html' },
    cards: { kind: 'json' },
  },
  ReviewsSection: {
    reviews: { kind: 'json' },
    reviewsLink: { kind: 'url' },
  },
  CtaBannerSection: {
    body: { kind: 'html' },
    ctaUrl: { kind: 'url' },
  },
  EventsWidgetSection: {},
  ReserveFormSection: {
    body: { kind: 'html' },
  },
  RatesTableSection: {
    rows: { kind: 'json' },
  },
  FeatureListSection: {
    features: { kind: 'json' },
  },
  AmenityGridSection: {
    cards: { kind: 'json' },
  },
  InterludeSection: {
    headline: { kind: 'html' },
    body: { kind: 'html' },
    backgroundImageUrl: { kind: 'url' },
    ctaUrl: { kind: 'url' },
  },
  TrustBarSection: {
    items: { kind: 'json' },
  },
  ImageBlock: {
    imageUrl: { kind: 'url' },
    linkUrl: { kind: 'url' },
  },
  HtmlEmbed: {
    // HtmlEmbed renders into a sandboxed iframe with srcdoc, so we don't
    // HTML-sanitize the code field — the sandbox is the boundary.
  },
  VideoEmbed: {
    url: { kind: 'url' },
  },
  Spacer: {},
  Divider: {},
  ShapeBlock: {},
  LineBlock: {},
  BackgroundImageBlock: {
    imageUrl: { kind: 'url' },
    content: { kind: 'html' },
  },
  FreeformContainerBlock: {
    bgImageUrl: { kind: 'url' },
  },
};

/**
 * Conservative HTML sanitizer for rich-text content. Mirrors the logic in
 * src/pages/api/content/blocks.ts::sanitizeRichHtml — keep them in sync.
 */
export function sanitizeRichHtml(html: string): string {
  if (typeof html !== 'string') return html;
  let cleaned = html.replace(
    /<(script|style|iframe|object|embed|form|input|svg|math|link|meta|base)[\s\S]*?<\/\1\s*>/gi,
    ''
  );
  cleaned = cleaned.replace(
    /<(script|style|iframe|object|embed|form|input|svg|math|link|meta|base)[^>]*\/?>/gi,
    ''
  );
  // Strip on* event-handler attributes. PT-2 fix: HTML lets attributes be
  // separated by whitespace OR '/', so `<img/src=x/onerror=…>` is valid.
  // Match any non-alphanumeric separator before `on…`.
  cleaned = cleaned.replace(/[\s\/]on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // PT-3 fix: strip style attributes that contain legacy CSS-based XSS
  // vectors. Modern browsers refuse `javascript:` in CSS URLs, but older
  // IE / Edge / Opera have executed these historically, and
  // `expression(…)` / `-moz-binding` / `behavior:` still have exploitable
  // paths in niche configs. Strip the whole style attribute rather than
  // parsing CSS — Tiptap's default schema doesn't emit inline styles
  // anyway, so this only affects adversarial input.
  cleaned = cleaned.replace(
    /\sstyle\s*=\s*("[^"]*(?:javascript:|vbscript:|expression\s*\(|-moz-binding|behavior\s*:)[^"]*"|'[^']*(?:javascript:|vbscript:|expression\s*\(|-moz-binding|behavior\s*:)[^']*')/gi,
    ''
  );
  // Strip dangerous URL schemes from href / src / xlink:href attributes
  cleaned = cleaned.replace(
    /(href|src|xlink:href)\s*=\s*("|')\s*(javascript|data|vbscript|file|about)\s*:[^"']*\2/gi,
    '$1=$2#blocked-unsafe-url$2'
  );
  cleaned = cleaned.replace(
    /(href|src|xlink:href)\s*=\s*(javascript|data|vbscript|file|about)\s*:[^\s>]*/gi,
    '$1=#blocked-unsafe-url'
  );
  return cleaned;
}

/**
 * URL allow-list. Mirrors src/pages/api/content/blocks.ts::isSafeUrl.
 */
export function isSafeUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^(mailto|tel):/i.test(trimmed)) return true;
  return false;
}

function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  return isSafeUrl(url) ? url : '#blocked-unsafe-url';
}

/**
 * Sanitize a JSON string field (stored textarea that Puck will JSON.parse
 * at render time). We parse → walk known-dangerous string keys → restringify.
 *
 * Field names to sanitize within nested objects — strings that the
 * PuckRenderer passes through set:html or into href attributes.
 */
const NESTED_HTML_KEYS = ['desc', 'description', 'body', 'quote'];
const NESTED_URL_KEYS = ['image', 'href', 'url', 'link', 'linkUrl', 'imageUrl', 'ctaUrl', 'image_url'];

function sanitizeJsonString(raw: unknown): string {
  if (typeof raw !== 'string') return typeof raw === 'undefined' ? '' : String(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not valid JSON — leave as-is (downstream will also fail to parse,
    // which the renderer handles by substituting an empty array).
    return raw;
  }
  const walked = walkAndSanitize(parsed);
  return JSON.stringify(walked);
}

function walkAndSanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walkAndSanitize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Block prototype-pollution keys (defense in depth — see BUG-6 in report)
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (NESTED_HTML_KEYS.includes(k) && typeof v === 'string') {
        out[k] = sanitizeRichHtml(v);
      } else if (NESTED_URL_KEYS.includes(k) && typeof v === 'string') {
        out[k] = sanitizeUrl(v);
      } else {
        out[k] = walkAndSanitize(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * Sanitize a Puck data blob in place. Returns a new object — does not mutate
 * the input.
 */
export function sanitizePuckData<T extends { content?: unknown; root?: unknown; zones?: unknown }>(
  data: T
): T {
  // Clone defensively so we don't mutate the caller's reference.
  const clone: any = JSON.parse(JSON.stringify(data));

  // Walk content[] (top-level) and every nested zone (containers like
  // FreeformContainerBlock use zones for their children).
  const contentArrays: unknown[][] = [];
  if (Array.isArray(clone.content)) contentArrays.push(clone.content);
  if (clone.zones && typeof clone.zones === 'object') {
    for (const key of Object.keys(clone.zones)) {
      const arr = clone.zones[key];
      if (Array.isArray(arr)) contentArrays.push(arr);
    }
  }

  for (const arr of contentArrays) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const type: string | undefined = (item as any).type;
      const props = (item as any).props;
      if (!type || !props || typeof props !== 'object') continue;

      const fieldSpec = COMPONENT_FIELD_MAP[type];
      if (!fieldSpec) continue; // unknown component — pass through

      for (const [fieldName, spec] of Object.entries(fieldSpec)) {
        const value = props[fieldName];
        if (value === undefined || value === null) continue;

        if (spec.kind === 'html' && typeof value === 'string') {
          props[fieldName] = sanitizeRichHtml(value);
        } else if (spec.kind === 'url' && typeof value === 'string') {
          props[fieldName] = sanitizeUrl(value);
        } else if (spec.kind === 'json') {
          props[fieldName] = sanitizeJsonString(value);
        }
      }
    }
  }

  // root.props.globalStyles — no HTML/URL content; passes through.
  return clone;
}
