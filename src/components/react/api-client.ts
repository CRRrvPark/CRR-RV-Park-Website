/**
 * apiClient — single wrapper for calling /api/* endpoints from React components.
 *
 * - Injects the Supabase auth JWT as Authorization: Bearer ...
 * - Parses JSON responses
 * - Surfaces HTTP errors as ApiError
 * - Handles 401 by redirecting to /admin/login
 */

import { browserClient } from '@lib/supabase';

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.name = 'ApiError';
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await browserClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  onUnauthenticated?: () => void;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, params, onUnauthenticated } = opts;

  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const authHeaders = await getAuthHeader();
  const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: any = null;
  const contentType = res.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) payload = await res.json().catch(() => null);
  else payload = await res.text().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) {
      if (onUnauthenticated) onUnauthenticated();
      else if (typeof window !== 'undefined') window.location.href = '/admin/login';
    }
    const message = (payload && typeof payload === 'object' && 'error' in payload)
      ? String(payload.error)
      : `HTTP ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

// Convenience method wrappers
export const apiGet = <T = any>(path: string, params?: ApiOptions['params']) =>
  api<T>(path, { method: 'GET', params });
export const apiPost = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body });
export const apiPatch = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T = any>(path: string) =>
  api<T>(path, { method: 'DELETE' });
