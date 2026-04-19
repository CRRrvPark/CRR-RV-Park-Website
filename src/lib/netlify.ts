/**
 * Netlify API client — used to trigger publishes via the Deploy API.
 *
 * Two paths supported:
 *   triggerBuildHook()  — simplest: POST to a build hook URL, Netlify rebuilds
 *   uploadDeploy(zipBuffer) — full Deploy API: upload a pre-built zip
 *
 * We use triggerBuildHook for the standard "publish" button; the Deploy API
 * is reserved for future use cases where we want to control the build env
 * more tightly.
 */

const NETLIFY_API = 'https://api.netlify.com/api/v1';

export async function triggerBuildHook(): Promise<{ ok: boolean; statusCode: number }> {
  const hook = process.env.NETLIFY_BUILD_HOOK;
  if (!hook) throw new Error('NETLIFY_BUILD_HOOK env var is not set');
  const res = await fetch(hook, { method: 'POST' });
  return { ok: res.ok, statusCode: res.status };
}

export interface DeployStatus {
  id: string;
  state: 'new' | 'pending_review' | 'accepted' | 'enqueued' | 'building' | 'uploading' | 'uploaded' | 'preparing' | 'prepared' | 'processing' | 'processed' | 'ready' | 'error';
  url?: string;
  ssl_url?: string;
  deploy_url?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
  branch?: string;
  context?: 'production' | 'deploy-preview' | 'branch-deploy';
}

export async function getDeploy(deployId: string): Promise<DeployStatus> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) throw new Error('NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID required');
  const res = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys/${deployId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Netlify API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<DeployStatus>;
}

export async function listRecentDeploys(limit = 20): Promise<DeployStatus[]> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) throw new Error('NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID required');
  const res = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys?per_page=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Netlify API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<DeployStatus[]>;
}

/** Roll back to a specific previous deploy. */
export async function restoreDeploy(deployId: string): Promise<DeployStatus> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) throw new Error('NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID required');
  const res = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys/${deployId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Netlify restore ${res.status}: ${await res.text()}`);
  return res.json() as Promise<DeployStatus>;
}
