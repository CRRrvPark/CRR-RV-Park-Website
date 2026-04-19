/**
 * Shared helpers for Astro-side Puck block rendering, used by
 * PuckRenderer.astro. Kept in a .ts file (not the .astro frontmatter) so
 * Astro's dev-mode parser doesn't choke on the HTML-inside-template-literal
 * strings that renderChildBlock() uses.
 */

export interface PuckItem {
  type: string;
  props: Record<string, any>;
}

const WIDTH_MAP: Record<string, string> = { narrow: '640px', medium: '900px', full: '100%' };
const DIV_WIDTH_MAP: Record<string, string> = { narrow: '50%', medium: '80%', full: '100%' };

/**
 * Push CSS declarations for the shared per-block style props (margin /
 * padding / bg / border / radius / shadow) onto an accumulator array.
 * Mirrors `computeStyle()` in src/lib/puck-style.ts but for Astro inline
 * styles. Zero / empty values are skipped so the block's own defaults
 * still apply.
 */
export function pushStyleProps(acc: string[], p: Record<string, any>): void {
  if (p.marginTop) acc.push('margin-top:' + p.marginTop + 'px');
  if (p.marginBottom) acc.push('margin-bottom:' + p.marginBottom + 'px');
  if (p.paddingTop) acc.push('padding-top:' + p.paddingTop + 'px');
  if (p.paddingBottom) acc.push('padding-bottom:' + p.paddingBottom + 'px');
  if (p.paddingX) {
    acc.push('padding-left:' + p.paddingX + 'px');
    acc.push('padding-right:' + p.paddingX + 'px');
  }
  if (p.bgColor) acc.push('background:' + p.bgColor);
  if (p.textColor) acc.push('color:' + p.textColor);
  if (p.borderWidth) acc.push('border:' + p.borderWidth + 'px solid ' + (p.borderColor || '#d8ccb7'));
  if (p.borderRadius) acc.push('border-radius:' + p.borderRadius + 'px');
  if (p.shadow && p.shadow !== 'none') {
    const shadowMap: Record<string, string> = {
      soft: '0 1px 3px rgba(0,0,0,.08)',
      medium: '0 4px 14px rgba(0,0,0,.12)',
      strong: '0 18px 40px rgba(0,0,0,.22)',
    };
    if (shadowMap[p.shadow]) acc.push('box-shadow:' + shadowMap[p.shadow]);
  }
}

function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tag(name: string, style: string, inner = ''): string {
  return '<' + name + ' style="' + style + '">' + inner + '</' + name + '>';
}

function selfTag(name: string, attrs: string): string {
  return '<' + name + ' ' + attrs + ' />';
}

/**
 * Render a child block as an HTML string, used for children of
 * FreeformContainerBlock on the public site. Supports the basic blocks
 * that are most likely to appear inside a container; complex section
 * blocks (Hero, TwoColumn, CardGrid, etc.) are not supported inside
 * containers on the public site yet and render a placeholder.
 */
export function renderChildBlock(child: PuckItem): string {
  const p = child.props || {};
  const outerAcc: string[] = [];

  if (child.type === 'TextBlock') {
    const maxW = WIDTH_MAP[p.maxWidth] || '900px';
    const inner: string[] = [];
    if (!(p.paddingTop || p.paddingBottom || p.paddingX)) inner.push('padding:5rem 3rem');
    inner.push('text-align:' + (p.alignment || 'left'));
    pushStyleProps(inner, p);
    const labelHtml = p.label ? '<span class="section-label">' + esc(p.label) + '</span>' : '';
    const headlineHtml = p.headline ? '<h2 class="st">' + esc(p.headline) + '</h2>' : '';
    const bodyHtml = p.body ? '<div class="section-body" style="max-width:none;">' + p.body + '</div>' : '';
    return tag('section', inner.join(';'),
      tag('div', 'max-width:' + maxW + ';margin:0 auto;', labelHtml + headlineHtml + bodyHtml));
  }

  if (child.type === 'Spacer') {
    return tag('div', 'height:' + (p.height ?? 48) + 'px;');
  }

  if (child.type === 'Divider') {
    const dw = DIV_WIDTH_MAP[p.width] || '80%';
    const hrStyle = 'border:none;border-top:1px ' + (p.style || 'solid') + ' ' + (p.color || '#e8e3d8') +
      ';width:' + dw + ';margin:' + (p.margin ?? 32) + 'px auto;';
    return tag('div', 'padding:0 3rem;', selfTag('hr', 'style="' + hrStyle + '"'));
  }

  if (child.type === 'ShapeBlock') {
    outerAcc.push('display:flex');
    outerAcc.push('justify-content:' + (p.alignment === 'left' ? 'flex-start' : p.alignment === 'right' ? 'flex-end' : 'center'));
    outerAcc.push('padding:1rem 3rem');
    pushStyleProps(outerAcc, p);
    const strokeStyle = p.strokeWidth > 0 && p.stroke ? p.strokeWidth + 'px solid ' + p.stroke : '';
    const widthPx = Number(p.widthPx ?? 200);
    const heightPx = Number(p.heightPx ?? 200);
    const side = Math.min(widthPx, heightPx);
    const common = ['background:' + (p.fill || '#C4622D')];
    if (strokeStyle) common.push('border:' + strokeStyle);
    const commonStyle = common.join(';');
    if (p.shape === 'circle') {
      return tag('div', outerAcc.join(';'),
        tag('div', 'width:' + side + 'px;height:' + side + 'px;border-radius:50%;' + commonStyle));
    }
    if (p.shape === 'pill') {
      return tag('div', outerAcc.join(';'),
        tag('div', 'width:' + widthPx + 'px;height:' + heightPx + 'px;border-radius:9999px;' + commonStyle));
    }
    if (p.shape === 'rounded') {
      return tag('div', outerAcc.join(';'),
        tag('div', 'width:' + widthPx + 'px;height:' + heightPx + 'px;border-radius:16px;' + commonStyle));
    }
    if (p.shape === 'triangle') {
      const pts = (widthPx / 2) + ',0 ' + widthPx + ',' + heightPx + ' 0,' + heightPx;
      const svg = '<svg width="' + widthPx + '" height="' + heightPx + '" viewBox="0 0 ' + widthPx + ' ' + heightPx +
        '" aria-hidden="true"><polygon points="' + pts + '" fill="' + (p.fill || '#C4622D') +
        '" stroke="' + (p.stroke || 'none') + '" stroke-width="' + (p.strokeWidth || 0) + '" /></svg>';
      return tag('div', outerAcc.join(';'), svg);
    }
    return tag('div', outerAcc.join(';'),
      tag('div', 'width:' + widthPx + 'px;height:' + heightPx + 'px;' + commonStyle));
  }

  if (child.type === 'LineBlock') {
    outerAcc.push('display:flex');
    outerAcc.push('justify-content:' + (p.alignment === 'left' ? 'flex-start' : p.alignment === 'right' ? 'flex-end' : 'center'));
    outerAcc.push('padding:1rem 3rem');
    pushStyleProps(outerAcc, p);
    if (p.orientation === 'vertical') {
      const span = '<span style="width:' + p.thickness + 'px;height:' + p.verticalHeight + 'px;border-left:' +
        p.thickness + 'px ' + p.style + ' ' + p.color + ';"></span>';
      return tag('div', outerAcc.join(';'), span);
    }
    const lengthVal = p.lengthMode === 'px' ? p.lengthPx + 'px' : p.lengthPercent + '%';
    const hrStyle = 'width:' + lengthVal + ';border:none;border-top:' + p.thickness + 'px ' + p.style + ' ' + p.color + ';margin:0;';
    return tag('div', outerAcc.join(';'), selfTag('hr', 'style="' + hrStyle + '"'));
  }

  if (child.type === 'ImageBlock') {
    const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
    const align = alignMap[p.alignment as string] || 'center';
    const imgStyleParts: string[] = ['display:block', 'max-width:100%'];
    if (p.width) imgStyleParts.push('width:' + p.width + 'px');
    if (p.height) imgStyleParts.push('height:' + p.height + 'px');
    imgStyleParts.push('object-fit:' + (p.objectFit || 'cover'));
    if (p.borderRadius) imgStyleParts.push('border-radius:' + p.borderRadius + 'px');
    const imgAttrs = 'src="' + esc(p.imageUrl) + '" alt="' + esc(p.alt || '') + '" loading="lazy" style="' + imgStyleParts.join(';') + '"';
    const imgEl = p.imageUrl ? selfTag('img', imgAttrs) : '';
    const wrapped = p.linkUrl && imgEl ? '<a href="' + esc(p.linkUrl) + '">' + imgEl + '</a>' : imgEl;
    const cap = p.caption
      ? '<figcaption style="margin-top:.5rem;font-size:.85rem;color:var(--muted,#888);text-align:' + (p.alignment || 'center') + ';">' + esc(p.caption) + '</figcaption>'
      : '';
    return '<figure style="display:flex;flex-direction:column;align-items:' + align + ';padding:1rem 3rem;margin:0;">' + wrapped + cap + '</figure>';
  }

  return '<div style="padding:1rem 3rem;color:#888;font-size:.85rem;font-style:italic;">[' + esc(child.type) + ' is not yet supported as a nested child on public pages]</div>';
}
