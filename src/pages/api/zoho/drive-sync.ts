/**
 * Scheduled Function: zoho-drive-sync
 *
 * Runs every 15 minutes (see netlify.toml [functions."zoho-drive-sync"]).
 *
 * Mirrors files from a designated Zoho WorkDrive Team Folder into the
 * `media` table + Supabase Storage. Generates WebP + mobile-WebP variants
 * via Sharp to preserve the existing image optimization pattern.
 *
 * Idempotent: re-running is safe; only changed files are re-downloaded + reprocessed.
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { listWorkDriveFolderFiles, downloadWorkDriveFile, isImageFile, classifyZohoError, type WorkDriveFile } from '@lib/zoho';
import { generateVariants, variantFilenames } from '@lib/images';
import { logAudit } from '@lib/audit';
import { json, requireScheduledOrAuth, handleError } from '@lib/api';

export const prerender = false;

const MEDIA_BUCKET = 'media';  // Supabase Storage bucket

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireScheduledOrAuth(request);
    return await runSync();
  } catch (err: any) {
    // If runSync() itself throws (outside its internal try/catch), surface
    // the actual message instead of letting Astro return a bare 500.
    console.error('[zoho/drive-sync] outer handler:', err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
};
export const GET: APIRoute = async ({ request }) => {
  try {
    await requireScheduledOrAuth(request);
    return await runSync();
  } catch (err: any) {
    console.error('[zoho/drive-sync] outer handler:', err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
};

async function runSync(): Promise<Response> {
  const folderId = process.env.ZOHO_WORKDRIVE_MEDIA_FOLDER_ID;
  if (!folderId) {
    return json({ error: 'ZOHO_WORKDRIVE_MEDIA_FOLDER_ID not set' }, 500);
  }

  const sb = serverClient();
  const { data: run } = await sb.from('sync_runs').insert({
    service: 'zoho_drive',
    status: 'running',
  }).select('id').single();
  const runId = run?.id;

  try {
    const files = await listWorkDriveFolderFiles(folderId);

    // Log a sample so we can see what Zoho actually returned (critical for
    // diagnosing "syncs but nothing populates"). Only logs first 3 items
    // and trims the structure to stay readable in function logs.
    console.log(
      `[zoho/drive-sync] Zoho returned ${files.length} item(s) in folder ${folderId}. ` +
      `Sample: ${JSON.stringify(files.slice(0, 3).map(f => ({
        name: f.name, type: f.type, mimeType: f.mimeType, extn: f.extn, size: f.size,
      })))}`
    );

    let added = 0, updated = 0, skipped = 0, errors = 0;
    let skippedNotImage = 0, skippedFolders = 0;

    for (const file of files) {
      // Skip folders entirely
      if (file.type === 'folder') {
        skippedFolders++;
        skipped++;
        continue;
      }
      // Only process images (using robust check — mime_type, type, or extn)
      if (!isImageFile(file)) {
        skippedNotImage++;
        skipped++;
        continue;
      }

      try {
        const { data: existing } = await sb
          .from('media')
          .select('id, zoho_modified_at')
          .eq('zoho_resource_id', file.id)
          .maybeSingle();

        if (!existing) {
          await ingestFile(sb, file);
          added++;
        } else {
          const existingTime = existing.zoho_modified_at ? new Date(existing.zoho_modified_at).getTime() : 0;
          const remoteTime = new Date(file.modifiedAt).getTime();
          if (remoteTime > existingTime) {
            await updateFile(sb, existing.id, file);
            updated++;
          } else {
            skipped++;
          }
        }
      } catch (err: any) {
        console.error(`[zoho/drive-sync] failed for ${file.name}:`, err);
        errors++;
      }
    }

    if (runId) {
      await sb.from('sync_runs').update({
        status: errors > 0 ? 'failed' : 'success',
        completed_at: new Date().toISOString(),
        items_added: added,
        items_updated: updated,
        error_message: errors > 0 ? `${errors} file(s) failed to process` : null,
        error_class: errors > 0 ? 'validation' : null,
      }).eq('id', runId);
    }

    await logAudit({
      action: 'zoho_sync_run',
      targetTable: 'sync_runs',
      targetId: runId,
      notes: `WorkDrive sync: +${added} added, ${updated} updated, ${skipped} skipped (folders=${skippedFolders}, non-image=${skippedNotImage}), ${errors} errors`,
    });

    return json({
      ok: true,
      added,
      updated,
      skipped,
      skippedFolders,
      skippedNotImage,
      errors,
      total: files.length,
      note: files.length > 0 && added === 0 && updated === 0
        ? `Received ${files.length} item(s) from Zoho, but none were classified as images. Check server logs for a sample of what was returned.`
        : undefined,
    });
  } catch (err: any) {
    console.error('[zoho/drive-sync]', err);
    if (runId) {
      await sb.from('sync_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: err.message,
        error_class: classifyZohoError(err),
      }).eq('id', runId);
    }
    await logAudit({
      action: 'zoho_sync_failed',
      targetTable: 'sync_runs',
      targetId: runId,
      notes: err.message,
    });
    return json({ error: err.message }, 500);
  }
}

/**
 * Normalize a Zoho filename into a storage-safe path.
 *
 * Zoho auto-renames collision-y files with timestamps like
 *   "aerial_canyon_rim 16-04-2026 23:53:44:985.webp"
 * Colons and spaces are hostile to S3-style object paths (Supabase Storage
 * sits on top of one), so we strip anything outside [a-z0-9._-] and
 * collapse runs. Lowercased so the same image uploaded under different
 * casings doesn't produce duplicate storage objects.
 */
function safeStorageStem(originalName: string): string {
  const stem = originalName.replace(/\.[^.]+$/, '');
  const cleaned = stem
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .slice(0, 180);
  return cleaned || 'image';
}

function safeVariantFilenames(originalName: string): { jpg: string; webp: string; mobileWebp: string } {
  const stem = safeStorageStem(originalName);
  return {
    jpg: `${stem}.jpg`,
    webp: `${stem}.webp`,
    mobileWebp: `${stem}-mobile.webp`,
  };
}

async function ingestFile(sb: any, file: WorkDriveFile): Promise<void> {
  const bytes = await downloadWorkDriveFile(file.id);
  const variants = await generateVariants(bytes);
  const filenames = safeVariantFilenames(file.name);

  // Sequential uploads per file — reduces peak concurrency against the
  // Storage edge layer, which 502/504s under burst load.
  const jpgUrl = await uploadVariantWithRetry(sb, filenames.jpg, variants.jpg, 'image/jpeg');
  const webpUrl = await uploadVariantWithRetry(sb, filenames.webp, variants.webp, 'image/webp');
  const mobileUrl = await uploadVariantWithRetry(sb, filenames.mobileWebp, variants.mobileWebp, 'image/webp');

  // mime_type is NOT NULL in the schema. Zoho sometimes returns an empty
  // string for it on .webp files; infer from the extension in that case so
  // the insert doesn't pass an empty string and break downstream consumers.
  const fallbackMime = inferMimeFromExt(file.name, file.extn) || 'application/octet-stream';
  const mimeType = (file.mimeType && file.mimeType.trim()) || fallbackMime;

  const { error: insertErr } = await sb.from('media').insert({
    zoho_resource_id: file.id,
    filename: file.name,
    display_name: file.name,
    mime_type: mimeType,
    byte_size: file.size,
    width: variants.width,
    height: variants.height,
    storage_path_jpg: `${MEDIA_BUCKET}/${filenames.jpg}`,
    storage_path_webp: `${MEDIA_BUCKET}/${filenames.webp}`,
    storage_path_mobile_webp: `${MEDIA_BUCKET}/${filenames.mobileWebp}`,
    public_url_jpg: jpgUrl,
    public_url_webp: webpUrl,
    public_url_mobile_webp: mobileUrl,
    zoho_modified_at: file.modifiedAt,
    last_synced_at: new Date().toISOString(),
    is_active: true,
  });
  if (insertErr) {
    // Previously this was silently ignored — toast would lie "+N added"
    // while the DB got zero rows. Surface it so the caller's per-file
    // error counter increments + the log shows what failed.
    throw new Error(`DB insert failed for ${file.name}: ${insertErr.message} (code=${(insertErr as any).code ?? 'n/a'})`);
  }
}

function inferMimeFromExt(name: string, extn: string): string {
  const e = (extn || name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    avif: 'image/avif', bmp: 'image/bmp', tiff: 'image/tiff', heic: 'image/heic',
  };
  return map[e] ?? '';
}

async function updateFile(sb: any, mediaId: string, file: WorkDriveFile): Promise<void> {
  const bytes = await downloadWorkDriveFile(file.id);
  const variants = await generateVariants(bytes);
  const filenames = safeVariantFilenames(file.name);

  const jpgUrl = await uploadVariantWithRetry(sb, filenames.jpg, variants.jpg, 'image/jpeg');
  const webpUrl = await uploadVariantWithRetry(sb, filenames.webp, variants.webp, 'image/webp');
  const mobileUrl = await uploadVariantWithRetry(sb, filenames.mobileWebp, variants.mobileWebp, 'image/webp');

  const { error: updateErr } = await sb.from('media').update({
    byte_size: file.size,
    width: variants.width,
    height: variants.height,
    public_url_jpg: jpgUrl,
    public_url_webp: webpUrl,
    public_url_mobile_webp: mobileUrl,
    zoho_modified_at: file.modifiedAt,
    last_synced_at: new Date().toISOString(),
  }).eq('id', mediaId);
  if (updateErr) {
    throw new Error(`DB update failed for ${file.name}: ${updateErr.message} (code=${(updateErr as any).code ?? 'n/a'})`);
  }
}

/**
 * Retry an upload a few times with exponential backoff when Supabase
 * Storage returns a transient 5xx (Bad Gateway / Gateway Timeout /
 * Service Unavailable). 4xx errors (auth, not-found, forbidden) fail fast.
 */
async function uploadVariantWithRetry(sb: any, path: string, bytes: Buffer, mime: string): Promise<string> {
  const maxAttempts = 3;
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await uploadVariant(sb, path, bytes, mime);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const transient = /Bad Gateway|Gateway Timeout|Service Unavailable|502|503|504|ECONNRESET|ETIMEDOUT/i.test(msg);
      lastErr = err;
      if (!transient || attempt === maxAttempts) throw err;
      const waitMs = 500 * 2 ** (attempt - 1); // 500ms, 1s, 2s
      console.warn(`[zoho/drive-sync] upload attempt ${attempt}/${maxAttempts} for ${path} hit ${msg} — retrying in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

async function uploadVariant(sb: any, path: string, bytes: Buffer, mime: string): Promise<string> {
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true,
    cacheControl: '31536000',
  });
  if (error && !error.message.includes('already exists')) {
    // Supabase JS client bundles real details inside the error object —
    // status code, original response body, sometimes a cause chain. The
    // default `.message` truncates most of it. Stringify the whole thing
    // so function logs show what the backend actually said.
    const detail = {
      message: error.message,
      name: (error as any).name,
      status: (error as any).status ?? (error as any).statusCode,
      cause: (error as any).cause,
      body: (error as any).error,
      payloadSize: bytes.byteLength,
      mime,
    };
    const suffix = ` — detail=${JSON.stringify(detail)}`;
    throw new Error(`Storage upload failed (${path}): ${error.message}${suffix}`);
  }
  const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
