/**
 * Helpers for section components: typed accessors on the per-section block map.
 *
 * Each section component receives `blocks` — a Record<string, ContentBlock>
 * keyed by block.key. These helpers pull values with appropriate fallbacks
 * and the same Tiptap-unwrap logic used in page-content.ts.
 */

export interface SectionBlock {
  key: string;
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

export type BlockMap = Record<string, SectionBlock>;

export function blockText(blocks: BlockMap, key: string, fallback = ''): string {
  return blocks[key]?.value_text ?? fallback;
}

export function blockHtml(blocks: BlockMap, key: string, fallback = ''): string {
  const raw = blocks[key]?.value_html ?? blocks[key]?.value_text ?? fallback;
  // Strip Tiptap's wrapping <p> when single-paragraph (matches page-content.ts logic)
  const m = raw.match(/^\s*<p>([\s\S]*?)<\/p>\s*$/);
  if (m && !/<p\b/i.test(m[1])) return m[1];
  return raw;
}

export function blockMultiHtml(blocks: BlockMap, key: string, fallback = ''): string {
  // For places that DO want <p>...</p> preserved (long-form prose).
  return blocks[key]?.value_html ?? blocks[key]?.value_text ?? fallback;
}

export function blockJson<T = unknown>(blocks: BlockMap, key: string, fallback: T): T {
  return (blocks[key]?.value_json as T) ?? fallback;
}

export function blockNumber(blocks: BlockMap, key: string, fallback = 0): number {
  return blocks[key]?.value_number ?? fallback;
}

export function blockBool(blocks: BlockMap, key: string, fallback = false): boolean {
  return blocks[key]?.value_boolean ?? fallback;
}

export function blockUrl(blocks: BlockMap, key: string, fallback = '#'): string {
  return blocks[key]?.value_text ?? fallback;
}

export interface ImageValue {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export function blockImage(blocks: BlockMap, key: string, fallback: Partial<ImageValue> = {}): ImageValue {
  const b = blocks[key];
  return {
    url: b?.value_image_url ?? fallback.url ?? '/images/hero.jpg',
    alt: b?.value_image_alt ?? fallback.alt ?? '',
    width: b?.value_image_width ?? fallback.width ?? 1400,
    height: b?.value_image_height ?? fallback.height ?? 933,
  };
}

/** Derive WebP variant URL from JPEG (matches optimization naming convention) */
export function webpFor(url: string): string {
  return url.replace(/\.jpe?g$/i, '.webp');
}
