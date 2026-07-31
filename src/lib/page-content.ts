/**
 * page-content.ts — helpers Astro pages use to fetch their content from Supabase.
 *
 * Pattern in every public page:
 *
 *   ---
 *   import { getBlocks, pickText, pickHtml, pickImage, pickJson } from '@lib/page-content';
 *   const blocks = await getBlocks('index');
 *   const heroEyebrow = pickText(blocks, 'hero', 'eyebrow', 'Central Oregon · Open 365 Days');
 *   ---
 *   <div class="hero-eyebrow">{heroEyebrow}</div>
 *
 * The 3rd argument to each `pick*` call is the **fallback** — what renders
 * if the DB is empty or doesn't have that block. This means:
 *   - The site builds correctly even before any migrations are applied
 *   - The site never shows "undefined" to visitors
 *   - Editors see the hardcoded value first, edit it in the admin,
 *     and the DB value takes over
 */

import { serverClient } from './supabase';

export interface BlockMap {
  // Flat map keyed by "section_key.block_key" — e.g. "hero.eyebrow"
  [key: string]: ContentBlock;
}

export interface ContentBlock {
  id: string;
  block_type: string;
  value_text: string | null;
  value_html: string | null;
  value_json: unknown;
  value_number: number | null;
  value_boolean: boolean | null;
  value_image_url: string | null;
  value_image_alt: string | null;
  value_image_width: number | null;
  value_image_height: number | null;
}

/**
 * Load all content blocks for a page, keyed by `section.key.block.key`.
 *
 * Returns an empty map if Supabase isn't configured or the page doesn't exist
 * — never throws. Callers always provide fallbacks for each block.
 */
export async function getBlocks(pageSlug: string): Promise<BlockMap> {
  // Vite exposes env vars via import.meta.env during SSR, not via process.env
  // (which is empty for non-PUBLIC keys). Fall back to process.env for pure
  // Node contexts.
  const hasUrl = Boolean(
    import.meta.env.PUBLIC_SUPABASE_URL ??
      (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : undefined)
  );
  const hasServiceKey = Boolean(
    (import.meta.env as any).SUPABASE_SERVICE_ROLE_KEY ??
      (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined)
  );
  if (!hasUrl || !hasServiceKey) return {};

  try {
    const sb = serverClient();
    const { data: page } = await sb.from('pages').select('id').eq('slug', pageSlug).maybeSingle();
    if (!page) return {};

    const { data } = await sb
      .from('content_blocks')
      .select('*, sections!inner(key, page_id)')
      .eq('sections.page_id', page.id);

    const map: BlockMap = {};
    for (const b of data ?? []) {
      const sectionKey = (b as any).sections?.key;
      if (!sectionKey) continue;
      map[`${sectionKey}.${b.key}`] = b as ContentBlock;
    }
    return map;
  } catch (err) {
    console.warn(`[getBlocks] Could not fetch content for "${pageSlug}":`, err);
    return {};
  }
}

export function pickText(blocks: BlockMap, sectionKey: string, blockKey: string, fallback: string): string {
  const b = blocks[`${sectionKey}.${blockKey}`];
  return b?.value_text ?? fallback;
}

export function pickHtml(blocks: BlockMap, sectionKey: string, blockKey: string, fallback: string): string {
  const b = blocks[`${sectionKey}.${blockKey}`];
  const raw = b?.value_html ?? b?.value_text ?? fallback;
  return unwrapSingleParagraph(raw);
}

/**
 * Tiptap wraps edited content in <p>...</p>. When that content is inserted
 * via set:html into a template that already has a block-level element
 * (e.g. <p class="hero-sub">), the browser auto-closes the outer <p> on
 * encountering the inner one, breaking styling. For single-paragraph rich
 * text we strip the wrapper so the inline content inserts cleanly. For
 * multi-paragraph content we keep the <p> tags (the template should be a
 * <div> container in that case).
 */
function unwrapSingleParagraph(html: string): string {
  const match = html.match(/^\s*<p>([\s\S]*?)<\/p>\s*$/);
  if (match && !/<p\b/i.test(match[1])) return match[1];
  return html;
}

export function pickImage(
  blocks: BlockMap,
  sectionKey: string,
  blockKey: string,
  fallback: { url: string; alt: string; width?: number; height?: number }
): { url: string; alt: string; width: number; height: number } {
  const b = blocks[`${sectionKey}.${blockKey}`];
  return {
    url: b?.value_image_url ?? fallback.url,
    alt: b?.value_image_alt ?? fallback.alt,
    width: b?.value_image_width ?? fallback.width ?? 1400,
    height: b?.value_image_height ?? fallback.height ?? 933,
  };
}

export function pickJson<T = unknown>(blocks: BlockMap, sectionKey: string, blockKey: string, fallback: T): T {
  const b = blocks[`${sectionKey}.${blockKey}`];
  return (b?.value_json as T) ?? fallback;
}

export function pickNumber(blocks: BlockMap, sectionKey: string, blockKey: string, fallback: number): number {
  const b = blocks[`${sectionKey}.${blockKey}`];
  return b?.value_number ?? fallback;
}

export function pickUrl(blocks: BlockMap, sectionKey: string, blockKey: string, fallback: string): string {
  const b = blocks[`${sectionKey}.${blockKey}`];
  return b?.value_text ?? fallback;
}

/**
 * Derive WebP variant URL from a JPEG URL by swapping extension.
 * Used when value_image_url points to a media-table JPEG; the WebP variant
 * follows our naming convention ([stem].webp).
 */
export function webpVariant(url: string): string {
  return url.replace(/\.jpe?g$/i, '.webp');
}

export function mobileWebpVariant(url: string): string {
  return url.replace(/\.jpe?g$/i, '-mobile.webp').replace(/\.webp$/i, '-mobile.webp');
}
