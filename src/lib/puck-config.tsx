/**
 * Puck Configuration — component registry for the visual page builder.
 *
 * This is the single source of truth for what components the builder offers,
 * what fields each component exposes, and how they render in the editor
 * canvas. The same config is used for:
 *   1. The editor UI (drag palette, field panels)
 *   2. The public site renderer (PuckRenderer.astro calls Render with this)
 *
 * Components are organized into categories that mirror the original
 * section-types.ts groupings so editors feel at home.
 */

import { DropZone, type Config } from '@puckeditor/core';
import { PUCK_SECTIONS } from '@components/react/puck-components';
import { richTextField } from '@components/react/puck-components/fields/RichTextField';
import { MediaPickerField } from '@components/react/puck-components/fields/MediaPickerField';
import { styleFields, STYLE_DEFAULTS, computeStyle, type StyleProps } from './puck-style';

const puckConfig: Config = {
  categories: {
    atoms: { title: 'Text & Blocks', defaultExpanded: true },
    content: { title: 'Content' },
    media: { title: 'Media & Heroes' },
    lists: { title: 'Lists & Grids' },
    engagement: { title: 'Engagement' },
    data: { title: 'Data & Tables' },
    layout: { title: 'Layout & Utility' },
    embeds: { title: 'Embeds & Code' },
  },
  components: {
    // ---- Content ----
    TextBlock: {
      label: 'Text Block',
      defaultProps: {
        label: '',
        headline: 'Your Headline',
        headlineItalic: '',
        body: '<p>Start typing here…</p>',
        alignment: 'left',
        maxWidth: 'medium',
        ...STYLE_DEFAULTS,
      },
      fields: {
        label: { type: 'text', label: 'Section label (small caps above headline)' },
        headline: { type: 'text', label: 'Headline' },
        headlineItalic: {
          type: 'text',
          label: 'Headline italic tail (optional — renders as " <em>tail</em>")',
        },
        body: richTextField('Body text'),
        alignment: {
          type: 'radio',
          label: 'Text alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
          ],
        },
        maxWidth: {
          type: 'select',
          label: 'Content width',
          options: [
            { label: 'Narrow (640px)', value: 'narrow' },
            { label: 'Medium (900px)', value: 'medium' },
            { label: 'Full width', value: 'full' },
          ],
        },
        ...styleFields,
      },
      // Headline is intentionally *not* treated as HTML. Pre-V4 seed data
      // stuffed literal `<em>…</em>` into the headline field, which the
      // renderer then HTML-escaped — the owner saw "Park guests get
      // <em>discounted green fees.</em>" on /golf-course. The fix is the
      // new `headlineItalic` field (same pattern TwoColumnSection,
      // CardGridSection et al. have used since day one). The data migrator
      // splits the legacy `<em>…</em>` markup out into `headlineItalic` on
      // load, so old saves render correctly without touching the DB.
      render: ({ label, headline, headlineItalic, body, alignment, maxWidth, puck, ...rest }) => {
        const styleProps = rest as StyleProps;
        const widthMap: Record<string, string> = { narrow: '640px', medium: '900px', full: '100%' };
        const baseStyle: React.CSSProperties = {
          padding: styleProps.paddingTop || styleProps.paddingBottom || styleProps.paddingX ? undefined : '5rem 3rem',
          textAlign: alignment as any,
        };
        return (
          <section style={{ ...baseStyle, ...computeStyle(styleProps) }} ref={puck.dragRef}>
            <div style={{ maxWidth: widthMap[maxWidth] || '900px', margin: '0 auto' }}>
              {label && <span className="section-label">{label}</span>}
              {(headline || headlineItalic) && (
                <h2 className="st">
                  {headline}
                  {headlineItalic && <> <em>{headlineItalic}</em></>}
                </h2>
              )}
              {body && <div className="section-body" style={{ maxWidth: 'none' }} dangerouslySetInnerHTML={{ __html: body }} />}
            </div>
          </section>
        );
      },
    },

    // ---- Shapes & Dividers ----
    ShapeBlock: {
      label: 'Shape',
      defaultProps: {
        shape: 'rect',
        fill: '#C4622D',
        stroke: '',
        strokeWidth: 0,
        widthPx: 200,
        heightPx: 200,
        alignment: 'center',
        ...STYLE_DEFAULTS,
      },
      fields: {
        shape: {
          type: 'select',
          label: 'Shape',
          options: [
            { label: 'Rectangle', value: 'rect' },
            { label: 'Rounded rectangle', value: 'rounded' },
            { label: 'Pill', value: 'pill' },
            { label: 'Circle', value: 'circle' },
            { label: 'Triangle', value: 'triangle' },
          ],
        },
        fill: { type: 'text', label: 'Fill color (hex / rgba)' },
        stroke: { type: 'text', label: 'Stroke color (hex, blank = none)' },
        strokeWidth: { type: 'number', label: 'Stroke width (px)', min: 0, max: 40 },
        widthPx: { type: 'number', label: 'Width (px)', min: 4, max: 2000 },
        heightPx: { type: 'number', label: 'Height (px)', min: 4, max: 2000 },
        alignment: {
          type: 'radio',
          label: 'Horizontal alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
        },
        ...styleFields,
      },
      render: ({ shape, fill, stroke, strokeWidth, widthPx, heightPx, alignment, puck, ...rest }) => {
        const styleProps = rest as StyleProps;
        const outer: React.CSSProperties = {
          display: 'flex',
          justifyContent: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
          padding: '1rem 3rem',
          ...computeStyle(styleProps),
        };
        const side = Math.min(widthPx as number, heightPx as number);
        const strokeStyle = strokeWidth > 0 && stroke ? `${strokeWidth}px solid ${stroke}` : undefined;
        let shapeEl: React.ReactNode;
        if (shape === 'circle') {
          shapeEl = <div style={{ width: side, height: side, background: fill, border: strokeStyle, borderRadius: '50%' }} />;
        } else if (shape === 'pill') {
          shapeEl = <div style={{ width: widthPx, height: heightPx, background: fill, border: strokeStyle, borderRadius: 9999 }} />;
        } else if (shape === 'rounded') {
          shapeEl = <div style={{ width: widthPx, height: heightPx, background: fill, border: strokeStyle, borderRadius: 16 }} />;
        } else if (shape === 'triangle') {
          // Equilateral-ish triangle via SVG so stroke + fill both work cleanly.
          const w = widthPx as number; const h = heightPx as number;
          shapeEl = (
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
              <polygon
                points={`${w / 2},0 ${w},${h} 0,${h}`}
                fill={fill || '#C4622D'}
                stroke={stroke || 'none'}
                strokeWidth={strokeWidth || 0}
              />
            </svg>
          );
        } else {
          shapeEl = <div style={{ width: widthPx, height: heightPx, background: fill, border: strokeStyle }} />;
        }
        return (
          <div ref={puck.dragRef} style={outer}>
            {shapeEl}
          </div>
        );
      },
    },

    // ---- Layout ----
    Spacer: {
      label: 'Spacer',
      defaultProps: { height: 48 },
      fields: {
        height: { type: 'number', label: 'Height (px)', min: 8, max: 400 },
      },
      render: ({ height, puck }) => (
        <div
          ref={puck.dragRef}
          style={{
            height: `${height}px`,
            background: 'transparent',
            position: 'relative',
          }}
        >
          {/* Editor-only visual indicator */}
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '1px dashed rgba(196,98,45,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'rgba(196,98,45,0.5)',
            pointerEvents: 'none',
          }}>
            {height}px
          </div>
        </div>
      ),
    },

    LineBlock: {
      label: 'Line',
      defaultProps: {
        style: 'solid',
        color: '#C4622D',
        thickness: 2,
        lengthMode: 'percent',
        lengthPercent: 60,
        lengthPx: 400,
        alignment: 'center',
        orientation: 'horizontal',
        verticalHeight: 80,
        ...STYLE_DEFAULTS,
      },
      fields: {
        orientation: {
          type: 'radio',
          label: 'Orientation',
          options: [
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
          ],
        },
        style: {
          type: 'select',
          label: 'Line style',
          options: [
            { label: 'Solid', value: 'solid' },
            { label: 'Dashed', value: 'dashed' },
            { label: 'Dotted', value: 'dotted' },
            { label: 'Double', value: 'double' },
            { label: 'Groove', value: 'groove' },
          ],
        },
        color: { type: 'text', label: 'Color (hex)' },
        thickness: { type: 'number', label: 'Thickness (px)', min: 1, max: 40 },
        lengthMode: {
          type: 'radio',
          label: 'Length mode (horizontal only)',
          options: [
            { label: 'Percent of row', value: 'percent' },
            { label: 'Fixed pixels', value: 'px' },
          ],
        },
        lengthPercent: { type: 'number', label: 'Length (% of row, if percent mode)', min: 5, max: 100 },
        lengthPx: { type: 'number', label: 'Length (px, if fixed mode)', min: 10, max: 4000 },
        verticalHeight: { type: 'number', label: 'Height (px, vertical only)', min: 20, max: 2000 },
        alignment: {
          type: 'radio',
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
        },
        ...styleFields,
      },
      render: ({ orientation, style, color, thickness, lengthMode, lengthPercent, lengthPx, alignment, verticalHeight, puck, ...rest }) => {
        const styleProps = rest as StyleProps;
        const justify = alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center';
        const outer: React.CSSProperties = {
          display: 'flex',
          justifyContent: justify,
          padding: '1rem 3rem',
          ...computeStyle(styleProps),
        };
        if (orientation === 'vertical') {
          const line: React.CSSProperties = {
            width: thickness,
            height: verticalHeight,
            borderLeft: `${thickness}px ${style} ${color}`,
          };
          return <div ref={puck.dragRef} style={outer}><span style={line} /></div>;
        }
        const lengthVal = lengthMode === 'px' ? `${lengthPx}px` : `${lengthPercent}%`;
        const hr: React.CSSProperties = {
          width: lengthVal,
          border: 'none',
          borderTop: `${thickness}px ${style} ${color}`,
          margin: 0,
        };
        return (
          <div ref={puck.dragRef} style={outer}><hr style={hr} /></div>
        );
      },
    },

    Divider: {
      label: 'Divider',
      defaultProps: { style: 'solid', color: '#e8e3d8', width: 'medium', margin: 32 },
      fields: {
        style: {
          type: 'select',
          label: 'Line style',
          options: [
            { label: 'Solid', value: 'solid' },
            { label: 'Dashed', value: 'dashed' },
            { label: 'Dotted', value: 'dotted' },
          ],
        },
        color: { type: 'text', label: 'Color (hex)' },
        width: {
          type: 'select',
          label: 'Width',
          options: [
            { label: 'Narrow (50%)', value: 'narrow' },
            { label: 'Medium (80%)', value: 'medium' },
            { label: 'Full', value: 'full' },
          ],
        },
        margin: { type: 'number', label: 'Vertical margin (px)', min: 0, max: 200 },
      },
      render: ({ style, color, width, margin, puck }) => {
        const widthMap: Record<string, string> = { narrow: '50%', medium: '80%', full: '100%' };
        return (
          <div ref={puck.dragRef} style={{ padding: '0 3rem' }}>
            <hr style={{
              border: 'none',
              borderTop: `1px ${style} ${color}`,
              width: widthMap[width] || '80%',
              margin: `${margin}px auto`,
            }} />
          </div>
        );
      },
    },

    // ---- Containers ----
    FreeformContainerBlock: {
      label: 'Container (drop blocks inside)',
      defaultProps: {
        direction: 'column',
        gap: 16,
        contentMaxWidth: 1200,
        contentAlign: 'stretch',
        bgImageUrl: '',
        ...STYLE_DEFAULTS,
        paddingTop: 48,
        paddingBottom: 48,
        paddingX: 32,
      },
      fields: {
        direction: {
          type: 'radio',
          label: 'Stack direction',
          options: [
            { label: 'Vertical', value: 'column' },
            { label: 'Horizontal', value: 'row' },
          ],
        },
        gap: { type: 'number', label: 'Gap between items (px)', min: 0, max: 200 },
        contentMaxWidth: { type: 'number', label: 'Max width (px)', min: 200, max: 3000 },
        contentAlign: {
          type: 'select',
          label: 'Item alignment',
          options: [
            { label: 'Start', value: 'flex-start' },
            { label: 'Center', value: 'center' },
            { label: 'End', value: 'flex-end' },
            { label: 'Stretch', value: 'stretch' },
          ],
        },
        bgImageUrl: {
          type: 'custom',
          label: 'Background image (optional)',
          render: MediaPickerField as any,
        },
        ...styleFields,
      },
      render: ({ direction, gap, contentMaxWidth, contentAlign, bgImageUrl, puck, ...rest }) => {
        const styleProps = rest as StyleProps;
        const section: React.CSSProperties = {
          position: 'relative',
          backgroundImage: bgImageUrl ? `url("${bgImageUrl}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          ...computeStyle(styleProps),
        };
        const inner: React.CSSProperties = {
          maxWidth: contentMaxWidth,
          margin: '0 auto',
          display: 'flex',
          flexDirection: direction as any,
          gap: gap,
          alignItems: contentAlign as any,
        };
        return (
          <section ref={puck.dragRef} style={section}>
            <div style={inner}>
              <DropZone zone="items" />
            </div>
          </section>
        );
      },
    },

    // ---- Media & backgrounds ----
    BackgroundImageBlock: {
      label: 'Background Image',
      defaultProps: {
        imageUrl: '',
        overlayColor: 'rgba(0,0,0,.3)',
        minHeightPx: 360,
        attachment: 'scroll',
        vAlign: 'middle',
        hAlign: 'center',
        content: '<h2 class="st">Headline over image</h2><p>Supporting copy goes here.</p>',
        ...STYLE_DEFAULTS,
      },
      fields: {
        imageUrl: {
          type: 'custom',
          label: 'Background image',
          render: MediaPickerField as any,
        },
        overlayColor: { type: 'text', label: 'Overlay color (hex / rgba, blank = none)' },
        minHeightPx: { type: 'number', label: 'Minimum height (px)', min: 60, max: 2000 },
        attachment: {
          type: 'select',
          label: 'Attachment',
          options: [
            { label: 'Scroll with page', value: 'scroll' },
            { label: 'Fixed (parallax)', value: 'fixed' },
          ],
        },
        vAlign: {
          type: 'radio',
          label: 'Vertical alignment',
          options: [
            { label: 'Top', value: 'top' },
            { label: 'Middle', value: 'middle' },
            { label: 'Bottom', value: 'bottom' },
          ],
        },
        hAlign: {
          type: 'radio',
          label: 'Horizontal alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
        },
        content: richTextField('Content (over image)'),
        ...styleFields,
      },
      render: ({ imageUrl, overlayColor, minHeightPx, attachment, vAlign, hAlign, content, puck, ...rest }) => {
        const styleProps = rest as StyleProps;
        const section: React.CSSProperties = {
          position: 'relative',
          minHeight: minHeightPx,
          backgroundImage: imageUrl ? `url("${imageUrl}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: attachment === 'fixed' ? 'fixed' : 'scroll',
          background: !imageUrl ? '#f5f0e6' : undefined,
          display: 'flex',
          alignItems: vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center',
          justifyContent: hAlign === 'left' ? 'flex-start' : hAlign === 'right' ? 'flex-end' : 'center',
          padding: styleProps.paddingTop || styleProps.paddingBottom || styleProps.paddingX ? undefined : '4rem 3rem',
          color: styleProps.textColor || '#fff',
          textAlign: hAlign as any,
          overflow: 'hidden',
          ...computeStyle(styleProps),
        };
        const overlay: React.CSSProperties = overlayColor
          ? { position: 'absolute', inset: 0, background: overlayColor, pointerEvents: 'none' }
          : {};
        const inner: React.CSSProperties = {
          position: 'relative',
          zIndex: 1,
          maxWidth: 900,
        };
        return (
          <section ref={puck.dragRef} style={section}>
            {overlayColor && <div style={overlay} aria-hidden="true" />}
            <div style={inner} dangerouslySetInnerHTML={{ __html: content || '' }} />
          </section>
        );
      },
    },

    // ---- Embeds ----
    HtmlEmbed: {
      label: 'HTML / Code Embed',
      defaultProps: {
        code: '<div style="padding:20px;background:#f5f0e6;border-radius:4px;text-align:center;color:#665040;">Paste your HTML, CSS, or JS here</div>',
        minHeight: 200,
        sandbox: false,
      },
      fields: {
        code: { type: 'textarea', label: 'HTML / CSS / JS code' },
        sandbox: {
          type: 'radio',
          label: 'Rendering mode',
          options: [
            { label: 'Inline (inherits site CSS — use for prose, notices, forms)', value: false },
            { label: 'Sandboxed iframe (isolates custom JS / untrusted HTML)', value: true },
          ],
        },
        minHeight: { type: 'number', label: 'Minimum height (px, sandboxed mode only)', min: 50, max: 2000 },
      },
      // Default is inline — paste raw HTML and have it inherit the site's
      // typography + container widths, same as any other block. The iframe
      // mode remains available for cases where you really do want isolation
      // (a calculator widget with its own JS, an embedded third-party widget,
      // etc.). Pre-V4 data without the `sandbox` prop renders inline now:
      // the old iframe behavior was the source of the "broken formatting"
      // bug on /area-guide and /golf-course. Admins are authenticated and
      // their HTML is trusted; if that ever changes, switch the default back.
      render: ({ code, minHeight, sandbox, puck }) => {
        if (sandbox) {
          return (
            <div ref={puck.dragRef} style={{ padding: '0 3rem' }}>
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,sans-serif;}</style></head><body>${code}</body></html>`}
                sandbox="allow-scripts"
                style={{
                  width: '100%',
                  minHeight: `${minHeight}px`,
                  border: '1px solid #e8e3d8',
                  borderRadius: 4,
                  background: '#fff',
                }}
                title="Embedded content"
              />
            </div>
          );
        }
        return (
          <div ref={puck.dragRef} dangerouslySetInnerHTML={{ __html: code || '' }} />
        );
      },
    },

    VideoEmbed: {
      label: 'Video Embed',
      defaultProps: {
        url: '',
        aspectRatio: '16:9',
        caption: '',
      },
      fields: {
        url: { type: 'text', label: 'YouTube or Vimeo URL' },
        aspectRatio: {
          type: 'select',
          label: 'Aspect ratio',
          options: [
            { label: '16:9 (widescreen)', value: '16:9' },
            { label: '4:3 (standard)', value: '4:3' },
            { label: '1:1 (square)', value: '1:1' },
          ],
        },
        caption: { type: 'text', label: 'Caption (optional)' },
      },
      render: ({ url, aspectRatio, caption, puck }) => {
        const embedUrl = parseVideoUrl(url);
        const ratioMap: Record<string, string> = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%' };
        return (
          <div ref={puck.dragRef} style={{ padding: '0 3rem', maxWidth: 900, margin: '0 auto' }}>
            {embedUrl ? (
              <div style={{ position: 'relative', paddingBottom: ratioMap[aspectRatio] || '56.25%', height: 0, overflow: 'hidden', borderRadius: 4 }}>
                <iframe
                  src={embedUrl}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video embed"
                />
              </div>
            ) : (
              <div style={{ padding: 40, background: '#f5f0e6', borderRadius: 4, textAlign: 'center', color: '#665040' }}>
                Paste a YouTube or Vimeo URL above
              </div>
            )}
            {caption && <p style={{ fontSize: '.85rem', color: '#665040', textAlign: 'center', marginTop: '.8rem' }}>{caption}</p>}
          </div>
        );
      },
    },
  },
};

function parseVideoUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  // Already an embed URL
  if (url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/')) return url;
  return null;
}

// Merge in the section components from puck-components/
Object.assign(puckConfig.components!, PUCK_SECTIONS);

// Assign categories
if (puckConfig.components) {
  const catMap: Record<string, string> = {
    TextBlock: 'content',
    ShapeBlock: 'layout',
    LineBlock: 'layout',
    Spacer: 'layout',
    Divider: 'layout',
    BackgroundImageBlock: 'media',
    FreeformContainerBlock: 'layout',
    HtmlEmbed: 'embeds',
    VideoEmbed: 'embeds',
    // Section components
    ImageBlock: 'media',
    HeroSection: 'media',
    TwoColumnSection: 'content',
    CardGridSection: 'lists',
    SiteCardsSection: 'lists',
    ExploreGridSection: 'lists',
    ReviewsSection: 'engagement',
    CtaBannerSection: 'engagement',
    EventsWidgetSection: 'engagement',
    ReserveFormSection: 'engagement',
    RatesTableSection: 'data',
    FeatureListSection: 'lists',
    AmenityGridSection: 'lists',
    InterludeSection: 'media',
    TrustBarSection: 'layout',
    RegionMapSection: 'media',
    // V4 atoms — block-level editable units.
    EditableHeading: 'atoms',
    EditableRichText: 'atoms',
    EditableButton: 'atoms',
    EditableImage: 'atoms',
    EditableEyebrow: 'atoms',
  };
  for (const [name, cat] of Object.entries(catMap)) {
    const comp = (puckConfig.components as any)[name];
    if (comp) comp.category = cat;
  }
}

export default puckConfig;
export type { Config };
