/**
 * Puck section components — 14 custom components + ImageBlock for the visual
 * page builder.
 *
 * Each component:
 *   - Uses `puck.dragRef` on the outermost element
 *   - Renders with CSS classes from public/styles/global.css
 *   - Uses `type: 'textarea'` for JSON array fields (parsed safely)
 *   - Uses `richTextField(label)` for rich text (Tiptap-powered custom field,
 *     see fields/RichTextField.tsx)
 *
 * Image-using components include imageWidth, imageHeight, objectFit, and
 * borderRadius fields for user-controlled image sizing.
 *
 * TextBlock (#8) is already defined in puck-config.tsx, so it's not here.
 */

import type { ComponentConfig } from '@puckeditor/core';
import { DropZone } from '@puckeditor/core';
import { MediaPickerField } from './fields/MediaPickerField';
import { richTextField } from './fields/RichTextField';
import { linkPickerField } from './fields/LinkPickerField';
import { styleFields, STYLE_DEFAULTS } from '@lib/puck-style';
import { ATOM_NAMES } from './atoms';

/* ── helpers ── */

function safeJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  // Already-parsed data (Puck's array-type field feeds us real arrays).
  if (Array.isArray(raw) || (typeof raw === 'object' && raw !== null)) {
    return stripProtoKeys(raw) as T;
  }
  if (typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    // BUG-6: defense-in-depth against prototype pollution. Strip dangerous
    // keys at every level before returning.
    return stripProtoKeys(parsed) as T;
  } catch {
    return fallback;
  }
}

function stripProtoKeys(value: any): any {
  if (Array.isArray(value)) return value.map(stripProtoKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = stripProtoKeys(v);
    }
    return out;
  }
  return value;
}

/** Build inline style object for background-image sections with resize controls. */
function bgImageStyle(
  url: string,
  objectFit?: string,
): React.CSSProperties {
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: objectFit === 'contain' ? 'contain' : objectFit === 'fill' ? '100% 100%' : 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

/** Build inline style for img elements with resize controls. */
function imgStyle(
  width?: number,
  height?: number,
  objectFit?: string,
  borderRadius?: number,
): React.CSSProperties {
  const s: React.CSSProperties = {};
  if (width) s.width = `${width}px`;
  if (height) s.height = `${height}px`;
  if (objectFit) s.objectFit = objectFit as any;
  if (borderRadius) s.borderRadius = `${borderRadius}px`;
  if (width || height) s.maxWidth = '100%';
  return s;
}

/* ── Shared field fragments for image controls ── */

const objectFitField = {
  type: 'select' as const,
  label: 'Image fit',
  options: [
    { label: 'Cover', value: 'cover' },
    { label: 'Contain', value: 'contain' },
    { label: 'Fill', value: 'fill' },
  ],
};

const imageWidthField = { type: 'number' as const, label: 'Image width (px)', min: 0, max: 2000 };
const imageHeightField = { type: 'number' as const, label: 'Image height (px)', min: 0, max: 2000 };
const borderRadiusField = { type: 'number' as const, label: 'Border radius (px)', min: 0, max: 200 };

/* ── 0. ImageBlock ── */

export const ImageBlock: ComponentConfig = {
  label: 'Image Block',
  defaultProps: {
    ...STYLE_DEFAULTS,
    imageUrl: '',
    alt: '',
    width: 0,
    height: 0,
    objectFit: 'cover',
    borderRadius: 0,
    alignment: 'center',
    caption: '',
    linkUrl: '',
  },
  fields: {
    ...styleFields,
    imageUrl: {
      type: 'custom',
      label: 'Image',
      render: MediaPickerField,
    },
    alt: { type: 'text', label: 'Alt text' },
    width: { type: 'number', label: 'Width (px, 0 = auto)', min: 0, max: 2000 },
    height: { type: 'number', label: 'Height (px, 0 = auto)', min: 0, max: 2000 },
    objectFit: {
      type: 'select',
      label: 'Object fit',
      options: [
        { label: 'Cover', value: 'cover' },
        { label: 'Contain', value: 'contain' },
        { label: 'Fill', value: 'fill' },
        { label: 'None (original)', value: 'none' },
      ],
    },
    borderRadius: { type: 'number', label: 'Border radius (0-50px)', min: 0, max: 50 },
    alignment: {
      type: 'radio',
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    caption: { type: 'text', label: 'Caption (optional)' },
    linkUrl: linkPickerField('Link URL (optional)'),
  },
  render: ({ imageUrl, alt, width, height, objectFit, borderRadius, alignment, caption, linkUrl, puck }: any) => {
    const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };

    const imgEl = imageUrl ? (
      <img
        src={imageUrl}
        alt={alt || ''}
        loading="lazy"
        style={{
          display: 'block',
          maxWidth: '100%',
          ...(width ? { width: `${width}px` } : {}),
          ...(height ? { height: `${height}px` } : {}),
          objectFit: objectFit || 'cover',
          borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        }}
      />
    ) : (
      <div
        style={{
          width: width || 300,
          height: height || 200,
          background: 'var(--sand, #f5f0e6)',
          border: '2px dashed var(--c-border, #e5e5e5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: borderRadius ? `${borderRadius}px` : undefined,
          color: 'var(--c-muted, #888)',
          fontSize: '0.85rem',
        }}
      >
        Select an image
      </div>
    );

    const wrapped = linkUrl ? <a href={linkUrl}>{imgEl}</a> : imgEl;

    return (
      <figure
        ref={puck.dragRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: alignMap[alignment] || 'center',
          padding: '1rem 3rem',
          margin: 0,
        }}
      >
        {wrapped}
        {caption && (
          <figcaption
            style={{
              marginTop: '0.5rem',
              fontSize: 'var(--fs-sm, 0.85rem)',
              color: 'var(--c-muted, #888)',
              textAlign: alignment || 'center',
            }}
          >
            {caption}
          </figcaption>
        )}
      </figure>
    );
  },
};

/* ── 1. HeroSection ── */

/**
 * HeroSection — V4 refactor.
 *
 * Structure:
 *   <section class="page-hero full">
 *     <div class="hero-bg">background image</div>
 *     <div class="hero-overlay" />
 *     <div class="hero-content">
 *       <DropZone "hero-main"> — EditableEyebrow/Heading/RichText atoms
 *       <div class="hero-ctas">
 *         <DropZone "hero-ctas"> — EditableButton atoms only
 *       </div>
 *     </div>
 *   </section>
 *
 * Legacy flat-prop data (eyebrow, headlineLine1, headlineLine2Italic,
 * subtitle, ctaPrimary*, ctaSecondary*) is still accepted and rendered
 * when zones are empty. puck-data-migrate.ts lifts those flat props into
 * atoms in the two zones on load, after which the zones take over and the
 * flat-prop fallback never fires.
 *
 * The flat-prop *fields* are preserved in the config so:
 *   (a) old saves without zones still show their current content in the
 *       right panel while editors migrate, and
 *   (b) the old editor UX is available if an atom-based edit hits a snag
 *       (useful during V4 rollout).
 * Once all hero pages are migrated, a future cleanup pass will drop the
 * flat-prop fields and renderer fallback.
 */
export const HeroSection: ComponentConfig = {
  label: 'Hero Section',
  defaultProps: {
    ...STYLE_DEFAULTS,
    eyebrow: '',
    headlineLine1: '',
    headlineLine2Italic: '',
    subtitle: '',
    ctaPrimaryLabel: '',
    ctaPrimaryUrl: '',
    ctaSecondaryLabel: '',
    ctaSecondaryUrl: '',
    backgroundImageUrl: '/images/hero.jpg',
    bgObjectFit: 'cover',
  },
  fields: {
    ...styleFields,
    backgroundImageUrl: {
      type: 'custom',
      label: 'Background image',
      render: MediaPickerField,
    },
    bgObjectFit: objectFitField,
    // Legacy flat-prop fallback fields — kept so pre-migration saves remain
    // editable. New content lives in the DropZone atoms; these can be left
    // blank once the page is migrated.
    eyebrow: { type: 'text', label: 'Legacy eyebrow (fallback — prefer the Eyebrow atom)' },
    headlineLine1: { type: 'text', label: 'Legacy headline L1 (fallback — prefer the Heading atom)' },
    headlineLine2Italic: { type: 'text', label: 'Legacy headline L2 italic (fallback)' },
    subtitle: richTextField('Legacy subtitle (fallback — prefer the Rich Text atom)'),
    ctaPrimaryLabel: { type: 'text', label: 'Legacy primary CTA label (fallback — prefer the Button atom)' },
    ctaPrimaryUrl: linkPickerField('Legacy primary CTA URL (fallback)'),
    ctaSecondaryLabel: { type: 'text', label: 'Legacy secondary CTA label (fallback)' },
    ctaSecondaryUrl: linkPickerField('Legacy secondary CTA URL (fallback)'),
  },
  render: ({
    eyebrow, headlineLine1, headlineLine2Italic, subtitle,
    ctaPrimaryLabel, ctaPrimaryUrl, ctaSecondaryLabel, ctaSecondaryUrl,
    backgroundImageUrl, bgObjectFit, puck,
  }: any) => {
    // Legacy fallback: if no atoms have been added to the zones yet AND the
    // flat props still hold the content, render the old flat output.
    // Once puck-data-migrate.ts lifts flat → atoms, this branch never fires
    // because the flat props are cleared during migration.
    const hasLegacyContent = Boolean(
      (eyebrow && String(eyebrow).trim())
      || (headlineLine1 && String(headlineLine1).trim())
      || (headlineLine2Italic && String(headlineLine2Italic).trim())
      || (subtitle && String(subtitle).trim())
      || (ctaPrimaryLabel && String(ctaPrimaryLabel).trim())
      || (ctaSecondaryLabel && String(ctaSecondaryLabel).trim())
    );

    return (
      <section className="page-hero full" ref={puck.dragRef}>
        <div className="hero-bg" style={bgImageStyle(backgroundImageUrl, bgObjectFit)} />
        <div className="hero-overlay" />
        <div className="hero-content">
          {hasLegacyContent ? (
            <>
              {eyebrow && <div className="hero-eyebrow">{eyebrow}</div>}
              <h1 className="hero-hl">
                {headlineLine1}
                {headlineLine2Italic && <><br /><em>{headlineLine2Italic}</em></>}
              </h1>
              {subtitle && <div className="hero-sub" dangerouslySetInnerHTML={{ __html: subtitle }} />}
              <div className="hero-ctas">
                {ctaPrimaryLabel && <a className="btn-p" href={ctaPrimaryUrl || '#'}>{ctaPrimaryLabel}</a>}
                {ctaSecondaryLabel && <a className="btn-g" href={ctaSecondaryUrl || '#'}>{ctaSecondaryLabel}</a>}
              </div>
            </>
          ) : (
            <>
              <DropZone
                zone="hero-main"
                allow={ATOM_NAMES.filter((n) => n !== 'EditableButton') as string[]}
              />
              <div className="hero-ctas">
                <DropZone zone="hero-ctas" allow={['EditableButton']} />
              </div>
            </>
          )}
        </div>
      </section>
    );
  },
};

/* ── Shared chrome helpers ── */

/**
 * V4 section chrome atoms — the standard set of atoms each section's
 * `section-chrome` DropZone accepts. All sections' chromes consist of the
 * same 3 atom types (eyebrow/section-label + headline + rich body/intro),
 * so this list is the single source of truth.
 */
const CHROME_ATOMS = ['EditableEyebrow', 'EditableHeading', 'EditableRichText'] as const;

/** Returns true when any legacy chrome prop has real content. */
function hasLegacyChrome(p: Record<string, unknown>, keys: readonly string[]): boolean {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'string' && v.trim()) return true;
  }
  return false;
}

/* ── 2. TwoColumnSection ── */

export const TwoColumnSection: ComponentConfig = {
  label: 'Two-Column Section',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: '',
    headline: 'Your Setting',
    headlineItalic: 'Awaits.',
    body: '<p>Description text here.</p>',
    featureList: [],
    image: '/images/hero.jpg',
    imageCaption: '',
    imagePosition: 'left',
    mobileImagePosition: 'inherit',
    imageWidth: 0,
    imageHeight: 0,
    imageObjectFit: 'cover',
    imageBorderRadius: 0,
    ctaLabel: '',
    ctaUrl: '#',
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic part' },
    body: richTextField('Body text'),
    featureList: {
      type: 'array',
      label: 'Feature list (optional)',
      getItemSummary: (item: any, i?: number) => item?.title || `Feature ${((i ?? 0) + 1)}`,
      defaultItemProps: { num: '', title: 'New feature', body: '' },
      arrayFields: {
        num: { type: 'text', label: 'Number / label (e.g. 01)' },
        title: { type: 'text', label: 'Title' },
        body: { type: 'textarea', label: 'Body' },
      },
    },
    image: {
      type: 'custom',
      label: 'Image',
      render: MediaPickerField,
    },
    imageCaption: { type: 'text', label: 'Image caption overlay' },
    imagePosition: {
      type: 'radio',
      label: 'Image position (desktop)',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ],
    },
    mobileImagePosition: {
      type: 'radio',
      label: 'Image position (mobile, stacked)',
      options: [
        { label: 'Follow desktop', value: 'inherit' },
        { label: 'Image on top', value: 'top' },
        { label: 'Image on bottom', value: 'bottom' },
      ],
    },
    imageWidth: imageWidthField,
    imageHeight: imageHeightField,
    imageObjectFit: objectFitField,
    imageBorderRadius: borderRadiusField,
    ctaLabel: { type: 'text', label: 'CTA button label' },
    ctaUrl: linkPickerField('CTA button URL'),
    imageLinkUrl: linkPickerField('Image link URL (optional)'),
  },
  render: ({
    label, headline, headlineItalic, body, featureList,
    image, imageCaption, imagePosition, mobileImagePosition,
    imageWidth, imageHeight, imageObjectFit, imageBorderRadius,
    ctaLabel, ctaUrl, puck,
  }: any) => {
    const features: { num?: string; title?: string; body?: string }[] = safeJson(featureList, []);
    const iStyle = imgStyle(imageWidth, imageHeight, imageObjectFit, imageBorderRadius);
    const imgBlock = (
      <div className="sv">
        {image && (
          <img
            src={image}
            alt={imageCaption || headline || ''}
            loading="lazy"
            style={{ ...iStyle, width: iStyle.width || '100%' }}
          />
        )}
        {imageCaption && <span className="sv-tag">{imageCaption}</span>}
      </div>
    );
    const mobileOrder = mobileImagePosition && mobileImagePosition !== 'inherit' ? mobileImagePosition : null;
    const legacyChrome = hasLegacyChrome(
      { label, headline, headlineItalic, body },
      ['label', 'headline', 'headlineItalic', 'body']
    );
    const legacyCta = Boolean(ctaLabel && String(ctaLabel).trim());

    const textBlock = (
      <div>
        {legacyChrome ? (
          <>
            {label && <span className="section-label">{label}</span>}
            <h2 className="st">
              {headline}
              {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
            </h2>
            {body && <div className="section-body" dangerouslySetInnerHTML={{ __html: body }} />}
          </>
        ) : (
          <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
        )}
        {features.length > 0 && (
          <div className="fl">
            {features.map((f, i) => (
              <div className="fi" key={i}>
                <span className="fn">{f.num ?? String(i + 1).padStart(2, '0')}</span>
                <div className="ft">
                  {f.title && <strong>{f.title}</strong>}
                  {f.body && <span>{f.body}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {legacyCta ? (
          <div className="section-cta">
            <a href={ctaUrl || '#'}>{ctaLabel}</a>
          </div>
        ) : (
          <div className="section-cta">
            <DropZone zone="section-ctas" allow={['EditableButton']} />
          </div>
        )}
      </div>
    );

    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container">
          <div className="sl" data-mobile-img={mobileOrder ?? undefined}>
            {imagePosition === 'right' ? <>{textBlock}{imgBlock}</> : <>{imgBlock}{textBlock}</>}
          </div>
        </div>
      </section>
    );
  },
};

/* ── 3. CardGridSection ── */

export const CardGridSection: ComponentConfig = {
  label: 'Card Grid',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: '',
    headline: 'Amenities',
    headlineItalic: '& Features',
    cards: [
      { icon: '\u{1F3CA}', name: 'Pool', desc: 'Seasonal outdoor pool', href: '', image: '', imageWidth: 0, imageHeight: 0 },
      { icon: '\u{1F4F6}', name: 'Wi-Fi', desc: 'Free high-speed internet', href: '', image: '', imageWidth: 0, imageHeight: 0 },
      { icon: '\u{1F9FA}', name: 'Laundry', desc: 'On-site facilities', href: '', image: '', imageWidth: 0, imageHeight: 0 },
    ],
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic part' },
    cards: {
      type: 'array',
      label: 'Cards',
      getItemSummary: (item: any, i?: number) => item?.name || `Card ${((i ?? 0) + 1)}`,
      defaultItemProps: { icon: '', name: 'New card', desc: '', href: '', image: '', imageWidth: 0, imageHeight: 0 },
      arrayFields: {
        icon: { type: 'text', label: 'Icon (emoji, e.g. 🏊)' },
        name: { type: 'text', label: 'Name' },
        desc: { type: 'text', label: 'Description' },
        image: { type: 'custom', label: 'Image (optional — replaces icon)', render: MediaPickerField as any },
        imageWidth: { type: 'number', label: 'Image width (px, 0 = auto)', min: 0, max: 2000 },
        imageHeight: { type: 'number', label: 'Image height (px, 0 = auto)', min: 0, max: 2000 },
        href: linkPickerField('Make card clickable (optional)'),
      },
    },
  },
  render: ({ label, headline, headlineItalic, cards, puck }: any) => {
    const items: { icon?: string; name?: string; desc?: string; href?: string; image?: string; imageWidth?: number; imageHeight?: number }[] = safeJson(cards, []);
    const legacyChrome = hasLegacyChrome({ label, headline, headlineItalic }, ['label', 'headline', 'headlineItalic']);
    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container">
          {legacyChrome ? (
            <>
              {label && <span className="section-label">{label}</span>}
              <h2 className="st">
                {headline}
                {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
              </h2>
            </>
          ) : (
            <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
          )}
          <div className="am-grid" style={{ marginTop: '2.5rem' }}>
            {items.map((c, i) => (
              <div className="am-card" key={i}>
                {c.image && (
                  <img
                    src={c.image}
                    alt={c.name || ''}
                    loading="lazy"
                    style={imgStyle(c.imageWidth, c.imageHeight, 'cover', 4)}
                  />
                )}
                {c.icon && !c.image && <span className="am-icon">{c.icon}</span>}
                {c.name && <div className="am-name">{c.name}</div>}
                {c.desc && <div className="am-desc">{c.desc}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
};

/* ── 4. SiteCardsSection ── */

export const SiteCardsSection: ComponentConfig = {
  label: 'Site Cards',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: '',
    headline: 'Our Sites',
    headlineItalic: '',
    intro: '<p>Choose from a variety of RV sites.</p>',
    cards: [
      { label: 'Full Hookup', name: 'Premium Pull-Through', desc: 'Spacious sites with full hookups.', specsText: '50 AMP, Full Hookup, Pull-Through', price: '$55', pricePer: '/night', featured: true, image: '', imageWidth: 0, imageHeight: 0 },
      { label: '', name: 'Standard Back-In', desc: 'Comfortable back-in sites.', specsText: '30 AMP, Water/Electric', price: '$40', pricePer: '/night', featured: false, image: '', imageWidth: 0, imageHeight: 0 },
    ],
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic part' },
    intro: richTextField('Intro paragraph'),
    cards: {
      type: 'array',
      label: 'Site cards',
      getItemSummary: (item: any, i?: number) => item?.name || `Site ${((i ?? 0) + 1)}`,
      defaultItemProps: { label: '', name: 'New site', desc: '', specsText: '', price: '', pricePer: '/night', featured: false, image: '', imageWidth: 0, imageHeight: 0 },
      arrayFields: {
        label: { type: 'text', label: 'Small label (e.g. "Full Hookup")' },
        name: { type: 'text', label: 'Site name' },
        desc: { type: 'textarea', label: 'Description' },
        specsText: { type: 'text', label: 'Spec tags (comma-separated, e.g. "50 AMP, Pull-Through")' },
        price: { type: 'text', label: 'Price (e.g. $55)' },
        pricePer: { type: 'text', label: 'Price per (e.g. /night)' },
        featured: { type: 'radio', label: 'Featured card?', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
        image: { type: 'custom', label: 'Image (optional)', render: MediaPickerField as any },
        imageWidth: { type: 'number', label: 'Image width (px, 0 = auto)', min: 0, max: 2000 },
        imageHeight: { type: 'number', label: 'Image height (px, 0 = auto)', min: 0, max: 2000 },
      },
    },
  },
  render: ({ label, headline, headlineItalic, intro, cards, puck }: any) => {
    const items: any[] = safeJson(cards, []);
    const legacyChrome = hasLegacyChrome(
      { label, headline, headlineItalic, intro },
      ['label', 'headline', 'headlineItalic', 'intro']
    );
    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container">
          {legacyChrome ? (
            <>
              {label && <span className="section-label">{label}</span>}
              <h2 className="st">
                {headline}
                {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
              </h2>
              {intro && <div className="sites-intro" dangerouslySetInnerHTML={{ __html: intro }} />}
            </>
          ) : (
            <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
          )}
          <div className="sites-grid">
            {items.map((c, i) => (
              <div className={`site-card${c.featured ? ' featured' : ''}`} key={i}>
                {c.image && (
                  <img
                    src={c.image}
                    alt={c.name || ''}
                    loading="lazy"
                    style={{
                      width: '100%',
                      ...imgStyle(c.imageWidth, c.imageHeight, 'cover', 4),
                      marginBottom: '0.75rem',
                    }}
                  />
                )}
                {c.label && <div className="site-card-label">{c.label}</div>}
                {c.name && <h3>{c.name}</h3>}
                {c.desc && <p>{c.desc}</p>}
                {(() => {
                  const specs: string[] = Array.isArray(c.specs)
                    ? c.specs
                    : typeof c.specsText === 'string'
                      ? c.specsText.split(',').map((s: string) => s.trim()).filter(Boolean)
                      : [];
                  return specs.length > 0 ? (
                    <div className="site-specs">
                      {specs.map((s, j) => (
                        <span className="spec-tag" key={j}>{s}</span>
                      ))}
                    </div>
                  ) : null;
                })()}
                {c.price && (
                  <div className="site-price">
                    <strong>{c.price}</strong>
                    {c.pricePer && <small>{c.pricePer}</small>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
};

/* ── 5. ExploreGridSection ── */

export const ExploreGridSection: ComponentConfig = {
  label: 'Explore Grid',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: '',
    headline: 'Explore',
    headlineItalic: 'the Area',
    intro: '<p>Discover what surrounds the ranch.</p>',
    cards: [
      { image: '/images/hero.jpg', alt: 'Smith Rock', distance: '15 min', title: 'Smith Rock State Park', desc: 'World-class climbing and hiking.', href: '', imageWidth: 0, imageHeight: 0 },
    ],
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic part' },
    intro: richTextField('Intro paragraph'),
    cards: {
      type: 'array',
      label: 'Destinations',
      getItemSummary: (item: any, i?: number) => item?.title || `Destination ${((i ?? 0) + 1)}`,
      defaultItemProps: { image: '', alt: '', distance: '', title: 'New destination', desc: '', href: '', imageWidth: 0, imageHeight: 0 },
      arrayFields: {
        title: { type: 'text', label: 'Title' },
        desc: { type: 'textarea', label: 'Description' },
        distance: { type: 'text', label: 'Distance / time (e.g. "15 min")' },
        image: { type: 'custom', label: 'Image', render: MediaPickerField as any },
        alt: { type: 'text', label: 'Image alt text' },
        imageWidth: { type: 'number', label: 'Image width (px, 0 = auto)', min: 0, max: 2000 },
        imageHeight: { type: 'number', label: 'Image height (px, 0 = auto)', min: 0, max: 2000 },
        href: linkPickerField('Link (optional)'),
      },
    },
  },
  render: ({ label, headline, headlineItalic, intro, cards, puck }: any) => {
    const items: any[] = safeJson(cards, []);
    const legacyChrome = hasLegacyChrome(
      { label, headline, headlineItalic, intro },
      ['label', 'headline', 'headlineItalic', 'intro']
    );
    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container">
          {legacyChrome ? (
            <>
              {label && <span className="section-label">{label}</span>}
              <h2 className="st">
                {headline}
                {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
              </h2>
              {intro && <div className="section-body" dangerouslySetInnerHTML={{ __html: intro }} />}
            </>
          ) : (
            <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
          )}
          <div className="ex-grid">
            {items.map((c, i) => {
              const cardImgStyle = imgStyle(c.imageWidth, c.imageHeight, 'cover', 0);
              const inner = (
                <>
                  <div className="ex-vis">
                    {c.image && (
                      <img
                        src={c.image}
                        alt={c.alt || c.title || ''}
                        loading="lazy"
                        style={{ ...cardImgStyle, width: cardImgStyle.width || '100%' }}
                      />
                    )}
                    {c.distance && <span className="ex-dist">{c.distance}</span>}
                  </div>
                  <div className="ex-body">
                    {c.title && <div className="ex-title">{c.title}</div>}
                    {c.desc && <div className="ex-desc">{c.desc}</div>}
                  </div>
                </>
              );
              return c.href ? (
                <a className="ex-card ex-link" href={c.href} key={i}>{inner}</a>
              ) : (
                <div className="ex-card" key={i}>{inner}</div>
              );
            })}
          </div>
        </div>
      </section>
    );
  },
};

/* ── 6. ReviewsSection ── */

export const ReviewsSection: ComponentConfig = {
  label: 'Reviews',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: 'Testimonials',
    headline: 'What Guests',
    headlineItalic: 'Are Saying',
    rating: '4.8',
    // Owner's canonical Google Knowledge Panel URL for the business —
    // `si=` is the base64-encoded place ID Google uses to resolve the
    // reviews drawer; `q=` is the query slug. Ephemeral session params
    // (sxsrf / ved / biw / bih / dpr / ictx / sca_esv) stripped because
    // they're tied to the browser session where the URL was copied.
    reviewsLink: 'https://www.google.com/search?q=crooked+river+ranch+rv+park&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOaxz-Wa7jb_95ElogqVVpkGrvX3PFXXWIYQiDFelErQ9QQDbJjqpe8ig1hJV3mU4HLSnBpn_GB838KNAuGcAbLVBdoYGwl03XMluXbveXREDWKzs6g%3D%3D',
    reviewsLinkLabel: 'View all reviews on Google',
    reviews: [
      { stars: 5, quote: 'A wonderful place to relax.', author: 'Jane D.', meta: 'Google Review' },
      { stars: 5, quote: 'Beautiful park with great amenities.', author: 'John S.', meta: 'Google Review' },
      { stars: 4, quote: 'Peaceful and well-maintained.', author: 'Mary T.', meta: 'Google Review' },
    ],
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic part' },
    rating: { type: 'text', label: 'Overall rating (e.g. 4.8)' },
    reviewsLink: linkPickerField('"View all reviews" link (your Google Maps reviews URL)'),
    reviewsLinkLabel: { type: 'text', label: '"View all reviews" button label' },
    reviews: {
      type: 'array',
      label: 'Reviews',
      getItemSummary: (item: any, i?: number) => item?.author || `Review ${((i ?? 0) + 1)}`,
      defaultItemProps: { stars: 5, quote: '', author: '', meta: '' },
      arrayFields: {
        stars: {
          type: 'select',
          label: 'Stars',
          options: [
            { label: '5 stars', value: 5 },
            { label: '4 stars', value: 4 },
            { label: '3 stars', value: 3 },
            { label: '2 stars', value: 2 },
            { label: '1 star', value: 1 },
          ],
        },
        quote: { type: 'textarea', label: 'Review quote' },
        author: { type: 'text', label: 'Author' },
        meta: { type: 'text', label: 'Source (e.g. "Google Review")' },
      },
    },
  },
  render: ({ label, headline, headlineItalic, rating, reviewsLink, reviewsLinkLabel, reviews, puck }: any) => {
    const items: any[] = safeJson(reviews, []);
    const starStr = (n: number) => '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);
    const viewAllHref: string =
      typeof reviewsLink === 'string' && reviewsLink.trim()
        ? reviewsLink
        : 'https://www.google.com/maps/place/Crooked+River+Ranch+RV+Park/';
    const viewAllLabel: string =
      typeof reviewsLinkLabel === 'string' && reviewsLinkLabel.trim()
        ? reviewsLinkLabel
        : 'View all reviews on Google';
    const legacyChrome = hasLegacyChrome(
      { label, headline, headlineItalic },
      ['label', 'headline', 'headlineItalic']
    );
    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container">
          <div className="rev-header">
            <div>
              {legacyChrome ? (
                <>
                  {label && <span className="section-label">{label}</span>}
                  <h2 className="st">
                    {headline}
                    {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
                  </h2>
                </>
              ) : (
                <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
              )}
            </div>
            {rating && (
              <div className="rev-overall">
                <div className="rev-big-score">{rating}</div>
                <div className="rev-big-label">out of 5</div>
              </div>
            )}
          </div>
          <div className="rev-grid">
            {items.map((r, i) => (
              <div className="rev-card" key={i}>
                <div className="rev-stars">{starStr(r.stars ?? 5)}</div>
                <div className="rev-quote">{r.quote}</div>
                {r.author && <div className="rev-author">{r.author}</div>}
                {r.meta && <div className="rev-meta">{r.meta}</div>}
              </div>
            ))}
          </div>
          <div className="section-cta" style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <a href={viewAllHref} target="_blank" rel="noopener noreferrer">{viewAllLabel} →</a>
          </div>
        </div>
      </section>
    );
  },
};

/* ── 7. CtaBannerSection ── */

export const CtaBannerSection: ComponentConfig = {
  label: 'CTA Banner',
  defaultProps: {
    ...STYLE_DEFAULTS,
    headline: 'Ready to Reserve?',
    body: '<p>Book your site today and experience Central Oregon at its finest.</p>',
    ctaLabel: 'Reserve Now',
    ctaUrl: '#',
    darkBackground: 'true',
  },
  fields: {
    ...styleFields,
    headline: { type: 'text', label: 'Headline' },
    body: richTextField('Body text'),
    ctaLabel: { type: 'text', label: 'CTA button label' },
    ctaUrl: linkPickerField('CTA button URL'),
    darkBackground: {
      type: 'radio',
      label: 'Dark background',
      options: [
        { label: 'Dark', value: 'true' },
        { label: 'Light', value: 'false' },
      ],
    },
  },
  // Not atom-ized in Session 2 — the body has dark-mode inline styles that
  // EditableRichText cannot currently carry without a dedicated inlineStyle
  // field. Kept on the legacy path until a future session adds inline-style
  // support or an opinionated dark-mode chrome wrapper.
  render: ({ headline, body, ctaLabel, ctaUrl, darkBackground, puck }: any) => {
    // Accept both boolean true and string 'true' — legacy seed stored
    // booleans while newer scripts use strings.
    const dark = darkBackground === 'true' || darkBackground === true;
    return (
      <section
        ref={puck.dragRef}
        style={{
          padding: '5rem 3rem',
          background: dark ? 'var(--deep)' : 'var(--sand)',
          textAlign: 'center',
        }}
      >
        <div className="container" style={{ maxWidth: 720 }}>
          {headline && (
            <h2
              className="st"
              style={dark ? { color: '#fff' } : undefined}
            >
              {headline}
            </h2>
          )}
          {body && (
            <div
              className="section-body"
              style={{ maxWidth: 'none', margin: '0 auto', ...(dark ? { color: 'rgba(255,255,255,.7)' } : {}) }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}
          {ctaLabel && (
            <div className={`section-cta${dark ? ' section-cta-dark' : ''}`} style={{ marginTop: '2rem' }}>
              <a href={ctaUrl || '#'}>{ctaLabel}</a>
            </div>
          )}
        </div>
      </section>
    );
  },
};

/* ── 9. EventsWidgetSection ── */

export const EventsWidgetSection: ComponentConfig = {
  label: 'Events Widget',
  defaultProps: {
    ...STYLE_DEFAULTS,
    heading: 'Upcoming Events',
    limit: 3,
    showLinkToAll: 'yes',
  },
  fields: {
    ...styleFields,
    heading: { type: 'text', label: 'Heading' },
    limit: { type: 'number', label: 'Number of events to show', min: 1, max: 12 },
    showLinkToAll: {
      type: 'radio',
      label: 'Show "View all" link',
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    },
  },
  // Not atom-ized in Session 2 — PuckRenderer.astro's public-site output
  // includes a hard-coded "What's Happening" section-label span and inline
  // styles on the h2 (margin-top, clamp font-size) that the atoms cannot
  // reproduce byte-identically without dedicated inlineStyle support. Kept
  // on the legacy path.
  render: ({ heading, limit, showLinkToAll, puck }: any) => (
    <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
      <div className="container">
        {heading && <h2 className="st">{heading}</h2>}
        <div
          style={{
            marginTop: '2rem',
            padding: '2.5rem',
            background: 'var(--sand)',
            border: '1px dashed var(--rust)',
            borderRadius: 4,
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '.9rem',
          }}
        >
          [Events auto-loaded from calendar — showing up to {limit ?? 3} events]
        </div>
        {showLinkToAll === 'yes' && (
          <div className="section-cta-center">
            <div className="section-cta">
              <a href="/events">View All Events</a>
            </div>
          </div>
        )}
      </div>
    </section>
  ),
};

/* ── 10. ReserveFormSection ── */

export const ReserveFormSection: ComponentConfig = {
  label: 'Reservation Form',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: 'Reservations',
    headline: 'Your site',
    headlineItalic: 'is waiting.',
    body: '<p>Book online in real time through our reservation system, or call the office if you have questions about site selection, rig fit, or winter monthly rates.</p>',
    formName: 'contact',
    formTitle: 'Request a Reservation',
    submitLabel: 'Send Message',
    disclaimer: 'For immediate availability, call 541-923-1441. Check-in 2:00pm · Check-out 12:00pm.',
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic part' },
    body: richTextField('Body text (left column)'),
    formName: { type: 'text', label: 'Form name (Netlify) — e.g. "contact" or "inquiry"' },
    formTitle: { type: 'text', label: 'Form title (shown above fields)' },
    submitLabel: { type: 'text', label: 'Submit button label' },
    disclaimer: { type: 'text', label: 'Small print under the submit button' },
  },
  render: ({ label, headline, headlineItalic, body, formName, formTitle, submitLabel, disclaimer, puck }: any) => {
    const fName = formName || 'contact';
    const fTitle = formTitle || 'Request a Reservation';
    const fSubmit = submitLabel || 'Send Message';
    const fDisclaimer = disclaimer || 'For immediate availability, call 541-923-1441.';
    const legacyChrome = hasLegacyChrome(
      { label, headline, headlineItalic, body },
      ['label', 'headline', 'headlineItalic', 'body']
    );
    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container">
          <div className="rl">
            <div>
              {legacyChrome ? (
                <>
                  {label && <span className="section-label">{label}</span>}
                  <h2 className="st">
                    {headline}
                    {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
                  </h2>
                  {body && <div className="section-body" dangerouslySetInnerHTML={{ __html: body }} />}
                </>
              ) : (
                <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
              )}
            </div>
            {/* Editor-side preview of the real Netlify form — admin sees exactly
                what will render on the live page. The public output is emitted
                by PuckRenderer.astro. */}
            <form className="res-form" onSubmit={(e) => e.preventDefault()}>
              <h3>{fTitle}</h3>
              <div className="fr">
                <div className="fg"><label>First Name</label><input type="text" name="first_name" disabled placeholder="Jane" /></div>
                <div className="fg"><label>Last Name</label><input type="text" name="last_name" disabled placeholder="Doe" /></div>
              </div>
              <div className="fg"><label>Email</label><input type="email" name="email" disabled placeholder="jane@example.com" /></div>
              <div className="fg"><label>Phone</label><input type="tel" name="phone" disabled placeholder="541-555-1234" /></div>
              <div className="fr">
                <div className="fg"><label>Arrival</label><input type="date" name="arrival_date" disabled /></div>
                <div className="fg"><label>Departure</label><input type="date" name="departure_date" disabled /></div>
              </div>
              <div className="fg"><label>Rig / RV type</label><input type="text" name="rig_size" disabled placeholder="e.g., Class C 32ft" /></div>
              <div className="fg"><label>Message</label><textarea name="message" rows={4} disabled /></div>
              <button className="btn-sub" type="button" disabled>{fSubmit}</button>
              <p className="form-disc" style={{ fontStyle: 'italic', color: 'var(--c-muted, #888)' }}>
                {fDisclaimer}
              </p>
              <p style={{ fontSize: '.7rem', color: 'var(--c-muted, #888)', marginTop: 6 }}>
                Preview only — live form name: <code>{fName}</code>
              </p>
            </form>
          </div>
        </div>
      </section>
    );
  },
};

/* ── 11. RatesTableSection ── */

export const RatesTableSection: ComponentConfig = {
  label: 'Rates Table',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: 'Pricing',
    headline: 'Current Rates',
    rows: [
      { name: 'Full Hookup Pull-Through', nightly: '$55', weekly: '$330', monthly: '$1,100', notes: '' },
      { name: 'Standard Back-In', nightly: '$40', weekly: '$240', monthly: '$800', notes: '' },
    ],
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    rows: {
      type: 'array',
      label: 'Rate rows',
      getItemSummary: (item: any, i?: number) => item?.name || `Row ${((i ?? 0) + 1)}`,
      defaultItemProps: { name: 'New site type', nightly: '', weekly: '', monthly: '', notes: '' },
      arrayFields: {
        name: { type: 'text', label: 'Site type name' },
        nightly: { type: 'text', label: 'Nightly rate' },
        weekly: { type: 'text', label: 'Weekly rate' },
        monthly: { type: 'text', label: 'Monthly rate' },
        notes: { type: 'text', label: 'Notes (optional — shown below table)' },
      },
    },
  },
  render: ({ label, headline, rows, puck }: any) => {
    const items: any[] = safeJson(rows, []);
    return (
      <section
        ref={puck.dragRef}
        style={{ padding: '6.5rem 3rem', background: 'var(--deep)', color: '#fff' }}
      >
        <div className="container">
          {label && <span className="section-label" style={{ color: 'var(--gold)' }}>{label}</span>}
          {headline && <h2 className="st" style={{ color: '#fff' }}>{headline}</h2>}
          <div className="rate-table-wrap">
            <table className="rate-table">
              <thead>
                <tr>
                  <th>Site Type</th>
                  <th>Nightly</th>
                  <th>Weekly</th>
                  <th>Monthly</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="rate-type-cell">{r.name}</td>
                    <td className="rate-price">{r.nightly}</td>
                    <td className="rate-price">{r.weekly}</td>
                    <td className="rate-price">{r.monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.some((r) => r.notes) && (
            <div className="rate-note-box">
              {items.filter((r) => r.notes).map((r, i) => (
                <div key={i}>{r.notes}</div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  },
};

/* ── 12. FeatureListSection ── */

export const FeatureListSection: ComponentConfig = {
  label: 'Feature List',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: '',
    headline: 'Why Choose Us',
    features: [
      { num: '01', title: 'Spacious Sites', body: 'Level, well-maintained pull-through and back-in sites.' },
      { num: '02', title: 'Central Location', body: 'Minutes from Smith Rock, the Deschutes River, and more.' },
      { num: '03', title: 'Full Amenities', body: 'Restrooms, laundry, Wi-Fi, and a seasonal pool.' },
    ],
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    features: {
      type: 'array',
      label: 'Features',
      getItemSummary: (item: any, i?: number) => item?.title || `Feature ${((i ?? 0) + 1)}`,
      defaultItemProps: { num: '', title: 'New feature', body: '' },
      arrayFields: {
        num: { type: 'text', label: 'Number / label (e.g. 01)' },
        title: { type: 'text', label: 'Title' },
        body: { type: 'textarea', label: 'Body' },
      },
    },
  },
  render: ({ label, headline, features, puck }: any) => {
    const items: any[] = safeJson(features, []);
    const legacyChrome = hasLegacyChrome({ label, headline }, ['label', 'headline']);
    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          {legacyChrome ? (
            <>
              {label && <span className="section-label">{label}</span>}
              {headline && <h2 className="st">{headline}</h2>}
            </>
          ) : (
            <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
          )}
          <div className="fl" style={{ marginTop: '2.5rem' }}>
            {items.map((f, i) => (
              <div className="fi" key={i}>
                <span className="fn">{f.num ?? String(i + 1).padStart(2, '0')}</span>
                <div className="ft">
                  {f.title && <strong>{f.title}</strong>}
                  {f.body && <span>{f.body}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
};

/* ── 13. AmenityGridSection ── */

export const AmenityGridSection: ComponentConfig = {
  label: 'Amenity Grid',
  defaultProps: {
    ...STYLE_DEFAULTS,
    label: 'Park Amenities',
    headline: 'Everything',
    headlineItalic: 'You Need',
    cards: [
      { icon: '\u{1F3CA}', name: 'Pool', desc: 'Seasonal outdoor pool for guests.' },
      { icon: '\u{1F9FA}', name: 'Laundry', desc: 'Coin-operated washers and dryers.' },
      { icon: '\u{1F4F6}', name: 'Wi-Fi', desc: 'Free park-wide internet access.' },
      { icon: '\u{1F6BF}', name: 'Restrooms', desc: 'Clean, well-maintained facilities.' },
      { icon: '\u{1F415}', name: 'Pet Friendly', desc: 'Leashed pets welcome.' },
      { icon: '\u{1F50C}', name: 'Full Hookups', desc: 'Water, sewer, and electric.' },
    ],
  },
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic part' },
    cards: {
      type: 'array',
      label: 'Amenities',
      getItemSummary: (item: any, i?: number) => item?.name || `Amenity ${((i ?? 0) + 1)}`,
      defaultItemProps: { icon: '', name: 'New amenity', desc: '' },
      arrayFields: {
        icon: { type: 'text', label: 'Icon (emoji)' },
        name: { type: 'text', label: 'Name' },
        desc: { type: 'text', label: 'Description' },
      },
    },
  },
  render: ({ label, headline, headlineItalic, cards, puck }: any) => {
    const items: any[] = safeJson(cards, []);
    const legacyChrome = hasLegacyChrome(
      { label, headline, headlineItalic },
      ['label', 'headline', 'headlineItalic']
    );
    return (
      <section ref={puck.dragRef} style={{ padding: '6.5rem 3rem' }}>
        <div className="container">
          {legacyChrome ? (
            <>
              {label && <span className="section-label">{label}</span>}
              <h2 className="st">
                {headline}
                {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
              </h2>
            </>
          ) : (
            <DropZone zone="section-chrome" allow={CHROME_ATOMS as unknown as string[]} />
          )}
          <div className="am-grid" style={{ marginTop: '2.5rem' }}>
            {items.map((c, i) => (
              <div className="am-card" key={i}>
                {c.icon && <span className="am-icon">{c.icon}</span>}
                {c.name && <div className="am-name">{c.name}</div>}
                {c.desc && <div className="am-desc">{c.desc}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
};

/* ── 14. InterludeSection ── */

export const InterludeSection: ComponentConfig = {
  label: 'Interlude',
  defaultProps: {
    ...STYLE_DEFAULTS,
    eyebrow: '',
    headline: '<p>A moment of stillness in the high desert.</p>',
    body: '',
    credit: '',
    backgroundImageUrl: '/images/hero.jpg',
    bgObjectFit: 'cover',
    ctaLabel: '',
    ctaUrl: '#',
  },
  fields: {
    ...styleFields,
    eyebrow: { type: 'text', label: 'Eyebrow text' },
    headline: richTextField('Headline (rich text)'),
    body: richTextField('Body text'),
    credit: { type: 'text', label: 'Photo credit' },
    backgroundImageUrl: {
      type: 'custom',
      label: 'Background image',
      render: MediaPickerField,
    },
    bgObjectFit: objectFitField,
    ctaLabel: { type: 'text', label: 'CTA label' },
    ctaUrl: linkPickerField('CTA URL'),
  },
  render: ({ eyebrow, headline, body, credit, backgroundImageUrl, bgObjectFit, ctaLabel, ctaUrl, puck }: any) => (
    <section
      ref={puck.dragRef}
      style={{
        position: 'relative',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {backgroundImageUrl && (
        <div
          className="hero-bg"
          style={bgImageStyle(backgroundImageUrl, bgObjectFit)}
        />
      )}
      <div className="hero-overlay" />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          padding: '5rem 3rem',
          maxWidth: 780,
        }}
      >
        {eyebrow && <div className="hero-eyebrow" style={{ justifyContent: 'center' }}>{eyebrow}</div>}
        {headline && (
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(1.8rem, 4vw, 3rem)',
              fontWeight: 300,
              fontStyle: 'italic',
              color: '#fff',
              lineHeight: 1.25,
              marginBottom: '1.5rem',
            }}
            dangerouslySetInnerHTML={{ __html: headline }}
          />
        )}
        {body && (
          <div
            style={{ color: 'rgba(255,255,255,.75)', fontSize: '1rem', lineHeight: 1.7, marginBottom: '1.5rem' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
        {ctaLabel && (
          <div className="section-cta section-cta-dark">
            <a href={ctaUrl || '#'}>{ctaLabel}</a>
          </div>
        )}
        {credit && (
          <div style={{ marginTop: '2rem', fontSize: '.72rem', color: 'rgba(255,255,255,.4)', letterSpacing: '.08em' }}>
            {credit}
          </div>
        )}
      </div>
    </section>
  ),
};

/* ── RegionMapSection ── */

/**
 * RegionMapSection — interactive Area Guide map with category filters.
 *
 * This component can't render a real map in the Puck editor canvas (the
 * map needs Google's JS SDK + DB-pulled pins that only exist on the public
 * site). The canvas shows a labelled placeholder plus the admin-controlled
 * chrome (label, headline, intro) so editors still get a live preview of
 * the text around the map. PuckRenderer.astro replaces the placeholder
 * with the real <RegionMap> component on the public site.
 *
 * Admin-editable fields:
 *   • chrome: label, headline, headline-inline-italic, intro (rich text)
 *   • height of the map element
 *   • center lat/lng and initial zoom
 *
 * The category pill list and the merged pin data are fetched server-side
 * by PuckRenderer.astro — admins don't pick which categories are shown;
 * all available categories from the Things-to-Do admin appear as filters.
 * Owner's intent: any category selectable by editors would quickly drift
 * out of sync with the /things-to-do category list.
 */
export const RegionMapSection: ComponentConfig = {
  label: 'Region Map (Area Guide)',
  defaultProps: {
    ...STYLE_DEFAULTS,
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
  fields: {
    ...styleFields,
    label: { type: 'text', label: 'Section label (above the headline)' },
    headline: { type: 'text', label: 'Headline' },
    headlineItalic: { type: 'text', label: 'Headline italic tail' },
    intro: richTextField('Intro paragraph (shown above the map)'),
    mapHeight: { type: 'number', label: 'Map height (px)', min: 320, max: 1200 },
    centerLat: { type: 'number', label: 'Default map center — latitude' },
    centerLng: { type: 'number', label: 'Default map center — longitude' },
    zoom: { type: 'number', label: 'Default zoom (1-20)', min: 1, max: 20 },
  },
  render: ({ label, headline, headlineItalic, intro, mapHeight, puck }: any) => (
    <section ref={puck.dragRef} style={{ padding: '3rem 3rem 1rem' }}>
      <div className="container">
        {label && <span className="section-label">{label}</span>}
        <h2 className="st" style={{ marginTop: '.4rem' }}>
          {headline}
          {headlineItalic && <>{' '}<em>{headlineItalic}</em></>}
        </h2>
        {intro && <div className="section-body" dangerouslySetInnerHTML={{ __html: intro }} />}
        <div
          style={{
            marginTop: '1.5rem',
            width: '100%',
            height: `${mapHeight || 560}px`,
            background: 'var(--sand, #f5efe3)',
            border: '1px dashed var(--rust, #C4622D)',
            borderRadius: 4,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--muted, #665040)',
          }}
        >
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontFamily: 'var(--serif, serif)', fontSize: '1.2rem', color: 'var(--text, #1f1712)', marginBottom: '.5rem' }}>
              Region Map — rendered on the published site
            </div>
            <div style={{ fontSize: '.9rem', lineHeight: 1.5 }}>
              Category filters and pins are wired live from your Things&nbsp;to&nbsp;Do, Trails, and Local Places data.
              Edit the text and settings on the right; the map appears when you view the public page.
            </div>
          </div>
        </div>
      </div>
    </section>
  ),
};

/* ── 15. TrustBarSection ── */

export const TrustBarSection: ComponentConfig = {
  label: 'Trust Bar',
  defaultProps: {
    ...STYLE_DEFAULTS,
    items: [
      { icon: '\u26F3', text: 'Crooked River Ranch Golf', href: '' },
      { icon: '\u{1F3D4}\uFE0F', text: 'Smith Rock 15 min', href: '' },
      { icon: '\u{1F690}', text: '60 RV Sites', href: '' },
      { icon: '\u{1F4F6}', text: 'Free Wi-Fi', href: '' },
      { icon: '\u{1F415}', text: 'Pet Friendly', href: '' },
    ],
  },
  fields: {
    ...styleFields,
    items: {
      type: 'array',
      label: 'Trust items',
      getItemSummary: (item: any, i?: number) => item?.text || `Item ${((i ?? 0) + 1)}`,
      defaultItemProps: { icon: '', text: 'New item', href: '' },
      arrayFields: {
        icon: { type: 'text', label: 'Icon (emoji)' },
        text: { type: 'text', label: 'Text' },
        href: linkPickerField('Link (optional)'),
      },
    },
  },
  render: ({ items, puck }: any) => {
    const list: { icon?: string; text?: string }[] = safeJson(items, []);
    return (
      <div id="trust" ref={puck.dragRef}>
        {list.map((item, i) => (
          <span key={i}>
            {i > 0 && <span className="td" />}
            <span className="ti">
              {item.icon && <span className="ticon">{item.icon}</span>}
              {item.text}
            </span>
          </span>
        ))}
      </div>
    );
  },
};
