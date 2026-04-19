/**
 * POST /api/media/upload — direct file upload path (V3.1 item 1).
 *
 * Accepts multipart/form-data from the admin UI and writes the image to
 * Supabase Storage + inserts a media row. Runs the same Sharp variant
 * pipeline the Zoho WorkDrive sync uses so manually-uploaded images are
 * indistinguishable from synced ones at render time.
 *
 * Form fields:
 *   file          (required) — the image bytes
 *   alt_text      (optional) — accessibility text
 *   caption       (optional)
 *   display_name  (optional) — defaults to the uploaded filename
 *
 * Auth: `upload_media` capability.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { generateVariants } from '@lib/images';
import { logAudit, requestContext } from '@lib/audit';
import { requireRole, handleError, json } from '@lib/api';

export const prerender = false;

const MEDIA_BUCKET = 'media';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'image/heic',
]);

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireRole(request, 'upload_media');

    // Astro on Netlify exposes the standard Fetch Request; formData() parses
    // multipart boundaries for us. If the browser forgot to set a multipart
    // body, this throws a clear 400.
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'Expected multipart/form-data body with a `file` field.' }, 400);
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return json({ error: '`file` field is required.' }, 400);
    }

    if (file.size === 0) {
      return json({ error: 'Uploaded file is empty.' }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ error: `File is too large (${fmtBytes(file.size)}). Max ${fmtBytes(MAX_BYTES)}.` }, 413);
    }

    const mimeType = (file.type || '').toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      return json({
        error: `Unsupported file type "${mimeType || 'unknown'}". Allowed: ${[...ALLOWED_MIME].join(', ')}.`,
      }, 415);
    }

    const originalName = (file.name || 'image').trim() || 'image';
    const altText = strOrNull(form.get('alt_text'));
    const caption = strOrNull(form.get('caption'));
    const displayName = strOrNull(form.get('display_name')) ?? originalName;

    // Process the bytes through Sharp. generateVariants throws on corrupt /
    // non-image payloads, which we surface as a 422 rather than a 500.
    const bytes = Buffer.from(await file.arrayBuffer());
    let variants;
    try {
      variants = await generateVariants(bytes);
    } catch (err: any) {
      return json({
        error: `Could not read the image — the file may be corrupt or not a supported format. (${err?.message ?? err})`,
      }, 422);
    }

    // Build collision-free storage paths. Appending a short random suffix
    // guarantees two uploads of `sunset.jpg` don't silently overwrite each
    // other in Storage (which would orphan the earlier media row's URLs).
    const stem = safeStorageStem(originalName);
    const suffix = randomSuffix();
    const paths = {
      jpg: `${stem}-${suffix}.jpg`,
      webp: `${stem}-${suffix}.webp`,
      mobileWebp: `${stem}-${suffix}-mobile.webp`,
    };

    const sb = serverClient();

    const jpgUrl = await uploadVariant(sb, paths.jpg, variants.jpg, 'image/jpeg');
    const webpUrl = await uploadVariant(sb, paths.webp, variants.webp, 'image/webp');
    const mobileUrl = await uploadVariant(sb, paths.mobileWebp, variants.mobileWebp, 'image/webp');

    const { data: row, error: insertErr } = await sb.from('media').insert({
      zoho_resource_id: null,
      filename: originalName,
      display_name: displayName,
      alt_text: altText,
      caption,
      mime_type: mimeType,
      byte_size: file.size,
      width: variants.width,
      height: variants.height,
      storage_path_jpg: `${MEDIA_BUCKET}/${paths.jpg}`,
      storage_path_webp: `${MEDIA_BUCKET}/${paths.webp}`,
      storage_path_mobile_webp: `${MEDIA_BUCKET}/${paths.mobileWebp}`,
      public_url_jpg: jpgUrl,
      public_url_webp: webpUrl,
      public_url_mobile_webp: mobileUrl,
      last_synced_at: null,
      is_active: true,
    }).select('*').single();

    if (insertErr) {
      // Storage bytes were written but DB row failed — best-effort cleanup
      // so we don't leak orphans on every failed insert.
      await Promise.allSettled([
        sb.storage.from(MEDIA_BUCKET).remove([paths.jpg, paths.webp, paths.mobileWebp]),
      ]);
      return json({ error: `DB insert failed: ${insertErr.message}` }, 500);
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'media_added',
      targetTable: 'media',
      targetId: row.id,
      targetLabel: displayName,
      notes: `manual upload · ${fmtBytes(file.size)} · ${mimeType}`,
      ...requestContext(request),
    });

    return json({ media: row }, 201);
  } catch (err) {
    return handleError(err);
  }
};

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function safeStorageStem(originalName: string): string {
  const stem = originalName.replace(/\.[^.]+$/, '');
  const cleaned = stem
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .slice(0, 160);
  return cleaned || 'image';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function uploadVariant(sb: any, path: string, bytes: Buffer, mime: string): Promise<string> {
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) {
    throw new Error(`Storage upload failed (${path}): ${error.message}`);
  }
  const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function fmtBytes(b: number): string {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
