/**
 * AuthContext — React context providing the current authenticated user.
 *
 * Usage:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 *
 *   const { user, signIn, signOut, loading } = useAuth();
 *
 * Internally wraps lib/auth.ts. Keeps session synced via Supabase auth listener.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { browserClient } from '@lib/supabase';
import {
  signIn as libSignIn,
  signOut as libSignOut,
  getCurrentUser,
  type AuthedUser,
} from '@lib/auth';

interface AuthContextValue {
  user: AuthedUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    console.log('[AuthProvider] refresh: calling getCurrentUser');
    try {
      // 8-second hard timeout — if Supabase is hung, fail loud instead of forever-spinner
      const u = await Promise.race([
        getCurrentUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timed out after 8s')), 8000)
        ),
      ]);
      console.log('[AuthProvider] refresh: got user?', u?.email ?? 'null');
      setUser(u);
      setError(null);
    } catch (err: any) {
      console.error('[AuthProvider] refresh failed:', err);
      setError(err.message);
      setUser(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let sub: { subscription?: { unsubscribe?: () => void } } | null = null;

    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    // Listen for auth changes (token refresh, sign in/out in another tab).
    //
    // CRITICAL: this callback runs INSIDE Supabase's GoTrue navigator.locks
    // lock. Calling any Supabase client method from here (directly or via
    // our refresh()) would re-enter _acquireLock and deadlock. Defer with
    // setTimeout so our refresh() runs outside the lock scope.
    //
    // ALSO: browserClient() may throw if env vars are missing (first deploy).
    // Guard so the component tree doesn't crash — the login form shows its own
    // "Supabase not configured" banner in that case.
    try {
      const result = browserClient().auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setTimeout(() => { refresh(); }, 0);
        }
      });
      sub = result.data;
    } catch {
      // Supabase not configured — auth listener can't start. The login page
      // will show an error banner; other admin pages will redirect to login.
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const u = await libSignIn(email, password);
      setUser(u);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // Record audit event server-side before revoking session
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: await authHeader(),
      });
    } catch {
      // Non-blocking — audit failure shouldn't prevent sign-out
    }
    await libSignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await browserClient().auth.getSession();
  return data.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}
