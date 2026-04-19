/**
 * Supabase clients — two flavors:
 *
 *   browserClient()   — for client-side admin UI (uses anon key, respects RLS)
 *   serverClient()    — for Netlify Functions (uses service_role, bypasses RLS)
 *
 * NEVER expose the service_role key to the browser. The build will fail at
 * runtime if you try to import serverClient() into a client component.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// `process` is a Node global — it does not exist in the browser. Guard every
// `process.env` reference so this module can load safely on both sides.
const PROC_ENV: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL ?? PROC_ENV.PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? PROC_ENV.PUBLIC_SUPABASE_ANON_KEY ?? '';
// Service key: Vite exposes all .env vars via import.meta.env in SSR (but NOT
// in client bundles for non-PUBLIC ones — that's why serverClient() also
// hard-guards against being called from the browser). Fall back to process.env
// for pure Node contexts (e.g., scripts run outside the Vite runtime).
const SUPABASE_SERVICE_KEY =
  (import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined) ??
  PROC_ENV.SUPABASE_SERVICE_ROLE_KEY ??
  '';

if (!SUPABASE_URL) {
  console.warn('[supabase] PUBLIC_SUPABASE_URL is not set — Supabase calls will fail');
}

let _browserClient: SupabaseClient | null = null;
let _serverClient: SupabaseClient | null = null;

/**
 * Browser-safe Supabase client. Honors RLS. Use for the admin UI.
 *
 * If env vars are missing (e.g. Vite didn't replace import.meta.env at
 * build-time), throws a clear diagnostic error instead of passing empty
 * strings to createClient (which produces confusing errors downstream).
 */
export function browserClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const msg = [
      'Supabase browser client cannot be created — env vars missing.',
      `  PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? '✓ set' : '✗ EMPTY'}`,
      `  PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✓ set' : '✗ EMPTY'}`,
      '',
      'Fix:',
      '  1. Verify .env has both vars',
      '  2. Stop dev server (Ctrl+C) and run `npm run dev` fresh — Vite only reads .env on full restart',
      '  3. If still broken, delete node_modules/.vite and restart',
    ].join('\n');
    console.error('[supabase]', msg);
    throw new Error('Supabase not configured. See console for details.');
  }
  if (!_browserClient) {
    _browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _browserClient;
}

/** Server-only Supabase client. Bypasses RLS. ONLY for Netlify Functions. */
export function serverClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('serverClient() must not be called from the browser');
  }
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  if (!_serverClient) {
    _serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _serverClient;
}

/** Build-time content fetch — used by Astro pages during `astro build`. */
export async function fetchPageContent(slug: string) {
  const sb = serverClient();
  const { data: page, error: pageErr } = await sb
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .single();
  if (pageErr || !page) throw new Error(`fetchPageContent: page "${slug}" not found`);

  const { data: sections } = await sb
    .from('sections')
    .select('*, content_blocks(*)')
    .eq('page_id', page.id)
    .order('display_order');

  return { page, sections: sections ?? [] };
}
