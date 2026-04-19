/**
 * AuthGuard — wraps admin React islands. Redirects to /admin/login when the
 * visitor isn't signed in, and shows a friendly 403 if they lack the
 * capability for this specific route.
 *
 * Why per-island (duplicating AdminShell's redirect): each React island
 * hydrates independently and has its own AuthContext. Without per-island
 * guards, the inner UI could briefly render (or fail API calls) before the
 * shell's redirect fires.
 */

import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { can, type Capability } from '@lib/rbac';
import { IconSpinner, IconLock } from './ui/Icon';

export function AuthGuard({ children, requireCapability }: { children: ReactNode; requireCapability?: Capability }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const current = window.location.pathname + window.location.search;
      if (!current.startsWith('/admin/login')) {
        window.location.href = `/admin/login?next=${encodeURIComponent(current)}`;
      }
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div style={{
        padding: 'var(--sp-12)',
        textAlign: 'center',
        color: 'var(--c-text-muted)',
      }}>
        <IconSpinner size={22} />
        <div style={{ marginTop: 'var(--sp-3)' }}>Checking your session…</div>
      </div>
    );
  }

  if (!user) return null;

  if (requireCapability && !can(user.role, requireCapability)) {
    return (
      <div className="alert alert-danger" style={{ maxWidth: 640, margin: 'var(--sp-8) auto' }}>
        <IconLock size={18} />
        <div>
          <div className="alert-title">Access denied</div>
          <div className="alert-body" style={{ marginTop: 6 }}>
            This page requires the <strong>{requireCapability}</strong> capability.
            Your role is <strong>{user.role}</strong>. If you think you should
            have access, ask an owner to update your role.
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <a href="/admin">← Back to dashboard</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
