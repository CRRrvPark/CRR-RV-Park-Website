/**
 * Auth helpers for the admin UI and Netlify Functions.
 *
 * Uses Supabase Auth (email + password). The session JWT contains the user's
 * UUID; we look up their role from app_users on every request.
 */

import { browserClient, serverClient } from './supabase';
import type { UserRole } from './rbac';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface AuthedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
}

/** Sign in a user via email + password (browser-side). */
export async function signIn(email: string, password: string): Promise<AuthedUser> {
  const sb = browserClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? 'Sign in failed');

  const profile = await loadUserProfile(sb, data.user);
  if (!profile.isActive) {
    await sb.auth.signOut();
    throw new Error('Your account is inactive. Contact an owner to reactivate.');
  }
  return profile;
}

export async function signOut(): Promise<void> {
  await browserClient().auth.signOut();
}

/** Returns the currently signed-in user's profile, or null if not signed in. */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const sb = browserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return loadUserProfile(sb, user);
}

async function loadUserProfile(sb: SupabaseClient, user: User): Promise<AuthedUser> {
  const { data, error } = await sb
    .from('app_users')
    .select('id, email, display_name, role, is_active')
    .eq('id', user.id)
    .single();
  if (error || !data) {
    throw new Error('No app_users row found. Contact an owner — your account may not be fully provisioned.');
  }
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    isActive: data.is_active,
  };
}

/** Server-side: verify the JWT from a request and return the user. */
export async function verifyRequestUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);

  const sb = serverClient();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;

  const { data } = await sb
    .from('app_users')
    .select('id, email, display_name, role, is_active, last_login_at')
    .eq('id', user.id)
    .single();
  if (!data || !data.is_active) return null;

  // Throttled last-seen touch. Updates last_login_at at most once every
  // 2 minutes per user so the Users admin screen reflects active sessions
  // (not just the original invite click, which is what sign-in magic-link
  // users were stuck showing). Fire-and-forget: do not block auth on it.
  const STALE_MS = 2 * 60 * 1000;
  const lastSeen = data.last_login_at ? new Date(data.last_login_at).getTime() : 0;
  if (Date.now() - lastSeen > STALE_MS) {
    sb.from('app_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {}, () => {});
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    isActive: data.is_active,
  };
}
