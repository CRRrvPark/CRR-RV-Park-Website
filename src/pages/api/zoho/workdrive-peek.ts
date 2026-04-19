/**
 * GET /api/zoho/workdrive-peek
 *
 * Diagnostic endpoint — calls Zoho WorkDrive for the configured media
 * folder and returns exactly what came back, plus how each item was
 * classified by our image filter. Use this when the sync reports success
 * but no images appear in the library.
 *
 * Returns:
 *   {
 *     folderId: string,
 *     rawCount: number,
 *     items: [
 *       { id, name, type, mimeType, extn, size, modifiedAt, isImage }
 *     ],
 *     mediaTableCount: number
 *   }
 */

import type { APIRoute } from 'astro';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError, json } from '@lib/api';
import { listWorkDriveFolderFiles, isImageFile } from '@lib/zoho';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);
    const folderId = process.env.ZOHO_WORKDRIVE_MEDIA_FOLDER_ID;
    if (!folderId) {
      return json({ error: 'ZOHO_WORKDRIVE_MEDIA_FOLDER_ID env var not set.' }, 400);
    }

    // Pull the live list from Zoho
    let items: Array<Record<string, any>> = [];
    let fetchError: string | null = null;
    try {
      const raw = await listWorkDriveFolderFiles(folderId);
      items = raw.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        mimeType: f.mimeType,
        extn: f.extn,
        size: f.size,
        modifiedAt: f.modifiedAt,
        isImage: isImageFile(f),
      }));
    } catch (err: any) {
      fetchError = err?.message ?? String(err);
    }

    // Compare against what's actually in our `media` table
    const sb = serverClient();
    const { count: mediaTableCount } = await sb
      .from('media')
      .select('*', { count: 'exact', head: true });

    return json({
      folderId,
      rawCount: items.length,
      imagesCount: items.filter((i) => i.isImage).length,
      foldersCount: items.filter((i) => i.type === 'folder').length,
      fetchError,
      items: items.slice(0, 50),
      mediaTableCount: mediaTableCount ?? 0,
      hint: fetchError
        ? 'Zoho API call failed — see fetchError for details.'
        : items.length === 0
          ? 'Zoho returned 0 items. The folder ID may be wrong, the OAuth token may lack access to this folder, or the folder is empty at the API level (try the parent folder ID instead).'
          : items.filter((i) => i.isImage).length === 0
            ? 'Zoho returned items but none classified as images. Check the type/mimeType/extn fields below.'
            : `Zoho returned ${items.length} item(s), ${items.filter((i) => i.isImage).length} classified as images. If media library still shows 0, the issue is in the ingest/upload step — check function logs.`,
    });
  } catch (err) {
    return handleError(err);
  }
};
