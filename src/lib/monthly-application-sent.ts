/**
 * Remember which monthly-application submissions already produced a PDF
 * email so the webhook, the production-build drain, and the scheduled
 * drain can share work without sending duplicates.
 */

import { getStore, type Store } from '@netlify/blobs';
import type { NetlifyFormSubmission } from './monthly-application';

const STORE = 'monthly-application-mail';

function sentStore(): Store | null {
  try {
    const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) {
      return getStore({ name: STORE, siteID, token, consistency: 'strong' });
    }
    return getStore({ name: STORE, consistency: 'strong' });
  } catch (err) {
    console.warn('[monthly-application] blobs store unavailable', err);
    return null;
  }
}

export function sentKey(payload: NetlifyFormSubmission): string {
  if (payload.id) return `id:${payload.id}`;
  if (payload.number != null && String(payload.number).length > 0) return `num:${payload.number}`;
  const email = String(payload.email ?? payload.data?.email ?? 'none');
  const created = String(payload.created_at ?? 'none');
  return `fallback:${email}:${created}`;
}

export async function alreadyEmailed(key: string): Promise<boolean> {
  const store = sentStore();
  if (!store) return false;
  try {
    return Boolean(await store.get(key));
  } catch {
    return false;
  }
}

export async function markEmailed(key: string): Promise<void> {
  const store = sentStore();
  if (!store) return;
  try {
    await store.set(key, new Date().toISOString());
  } catch (err) {
    console.warn('[monthly-application] could not mark emailed', key, err);
  }
}
