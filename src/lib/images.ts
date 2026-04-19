/**
 * Image processing — mirrors the optimization pattern of the current site.
 *
 * For every source image we generate:
 *   - full-size JPEG (quality 80, progressive)
 *   - full-size WebP (quality 80)
 *   - mobile WebP (800px wide, quality 78)
 *
 * Max dimension for full-size is 1400px (longest side).
 * Matches the pattern from HANDOFF.md §3.5.
 */

import sharp from 'sharp';

export interface ImageVariants {
  jpg: Buffer;
  webp: Buffer;
  mobileWebp: Buffer;
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
}

const MAX_FULL_DIMENSION = 1400;
const MOBILE_WIDTH = 800;
const FULL_QUALITY = 80;
const MOBILE_QUALITY = 78;

/**
 * Take source image bytes, return JPG + WebP + mobile-WebP variants.
 * Auto-orients based on EXIF; strips metadata for privacy + smaller files.
 */
export async function generateVariants(sourceBytes: ArrayBuffer | Buffer): Promise<ImageVariants> {
  const input = Buffer.isBuffer(sourceBytes) ? sourceBytes : Buffer.from(sourceBytes);
  const image = sharp(input).rotate(); // auto-orient from EXIF

  const meta = await image.metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;

  // Resize for full-size: cap longest side at MAX_FULL_DIMENSION
  let fullW = srcW, fullH = srcH;
  if (srcW >= srcH && srcW > MAX_FULL_DIMENSION) {
    fullW = MAX_FULL_DIMENSION;
    fullH = Math.round((srcH * MAX_FULL_DIMENSION) / srcW);
  } else if (srcH > MAX_FULL_DIMENSION) {
    fullH = MAX_FULL_DIMENSION;
    fullW = Math.round((srcW * MAX_FULL_DIMENSION) / srcH);
  }

  const fullBase = sharp(input).rotate().resize(fullW, fullH, { fit: 'inside', withoutEnlargement: true });

  const jpg = await fullBase
    .clone()
    .jpeg({ quality: FULL_QUALITY, progressive: true, mozjpeg: true })
    .toBuffer();

  const webp = await fullBase
    .clone()
    .webp({ quality: FULL_QUALITY })
    .toBuffer();

  // Mobile: fixed width, maintain aspect ratio
  const mobileH = fullH > 0 ? Math.round((fullH * MOBILE_WIDTH) / fullW) : 600;
  const mobileWebp = await sharp(input)
    .rotate()
    .resize(MOBILE_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: MOBILE_QUALITY })
    .toBuffer();

  return {
    jpg,
    webp,
    mobileWebp,
    width: fullW,
    height: fullH,
    mobileWidth: MOBILE_WIDTH,
    mobileHeight: mobileH,
  };
}

/**
 * Given a base filename like `hero.jpg`, derive the variant filenames.
 */
export function variantFilenames(baseFilename: string) {
  const stem = baseFilename.replace(/\.[^.]+$/, '');
  return {
    jpg: `${stem}.jpg`,
    webp: `${stem}.webp`,
    mobileWebp: `${stem}-mobile.webp`,
  };
}
