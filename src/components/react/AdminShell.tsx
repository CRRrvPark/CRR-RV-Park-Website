/**
 * AdminShell — sidebar + topbar + main content wrapper for every admin page.
 *
 * Rendered as a client:load island from AdminBase.astro. Wraps itself in
 * AdminProviders so nested islands get the same Auth/Toast/Confirm context.
 *
 * Features:
 *   - Role-aware sidebar: links the current user lacks access to are hidden.
 *   - Mobile hamburger that slides the sidebar in.
 *   - Command palette (Cmd/Ctrl+K) with page jumps + quick actions.
 *   - Session pill in the topbar with sign-out.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { AdminProviders } from './AdminProviders';
import { useAuth } from './AuthContext';
import { can, type Capability } from '@lib/rbac';
import {
  IconDashboard, IconPages, IconMedia, IconCalendar, IconAudit,
  IconHistory, IconUsers, IconCode, IconSettings, IconBook,
  IconMenu, IconClose, IconSearch, IconLogout, IconHelp, IconSparkle,
  IconGlobe,
} from './ui/Icon';
import { Button } from './ui/Button';
import { CommandPalette } from './CommandPalette';
import { HelpPanel } from './HelpPanel';

interface NavItem {
  slug: string;
  href: string;
  label: string;
  icon: ReactNode;
  capability?: Capability;
  group: 'main' | 'advanced';
  description?: string;
}

const NAV: NavItem[] = [
  { slug: 'dashboard', href: '/admin', label: 'Dashboard', icon: <IconDashboard />, group: 'main', description: 'Overview, quick actions, recent activity' },
  { slug: 'editor',    href: '/admin/editor', label: 'Pages', icon: <IconPages />, group: 'main', description: 'Edit page content & publish changes' },
  { slug: 'builder',   href: '/admin/builder/index', label: 'Visual Editor', icon: <IconSparkle />, group: 'main', description: 'Drag-and-drop visual editor (jumps to home page)' },
  { slug: 'media',     href: '/admin/media', label: 'Media Library', icon: <IconMedia />, capability: 'view_media', group: 'main', description: 'Upload photos & manage galleries' },
  { slug: 'events',    href: '/admin/events', label: 'Events', icon: <IconCalendar />, capability: 'view_events', group: 'main', description: 'Schedule events visible on the site' },
  { slug: 'area-guide', href: '/admin/area-guide', label: 'Area Guide', icon: <IconGlobe />, capability: 'view_area_guide', group: 'main', description: 'Trails, things to do, local places, and the park site map' },

  { slug: 'audit',     href: '/admin/audit',    label: 'Change Log', icon: <IconAudit />, capability: 'view_audit_log', group: 'advanced', description: 'Who changed what, and when' },
  { slug: 'versions',  href: '/admin/versions', label: 'Versions',   icon: <IconHistory />, capability: 'view_snapshots', group: 'advanced', description: 'Restore the site from a prior snapshot' },
  { slug: 'users',     href: '/admin/users',    label: 'Users',      icon: <IconUsers />, capability: 'view_users', group: 'advanced', description: 'Invite teammates & assign roles' },
  { slug: 'code',      href: '/admin/code',     label: 'Code Editor', icon: <IconCode />, capability: 'view_code', group: 'advanced', description: 'Edit layouts & templates (owner only)' },
  { slug: 'settings',  href: '/admin/settings', label: 'Settings',   icon: <IconSettings />, group: 'advanced', description: 'Integrations, publishing, email' },
  { slug: 'runbook',   href: '/admin/runbook',  label: 'Runbook',    icon: <IconBook />, capability: 'view_runbook', group: 'advanced', description: 'Operations manual for successors' },
];

interface ShellProps {
  active?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AdminShell({ active, title, subtitle, children }: ShellProps) {
  return (
    <AdminProviders>
      <AdminShellInner active={active} title={title} subtitle={subtitle}>
        {children}
      </AdminShellInner>
    </AdminProviders>
  );
}

function AdminShellInner({ active, title, subtitle, children }: ShellProps) {
  const { user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Redirect to login if not authenticated. Skipping on loading so we
  // don't flash-redirect during the initial session check.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const current = window.location.pathname + window.location.search;
      if (current !== '/admin/login') {
        window.location.href = `/admin/login?next=${encodeURIComponent(current)}`;
      }
    }
  }, [loading, user]);

  // Cmd/Ctrl+K opens palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === '?' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleNav = NAV.filter((n) => {
    if (!n.capability) return true;
    return user ? can(user.role, n.capability) : false;
  });

  const mainNav = visibleNav.filter((n) => n.group === 'main');
  const advNav = visibleNav.filter((n) => n.group === 'advanced');

  return (
    <div className="admin-shell">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 70 }}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-brand-row">
            <div className="admin-sidebar-brand-mark">CR</div>
            <div>
              <div className="admin-sidebar-brand-title">Crooked River Ranch</div>
              <div className="admin-sidebar-brand-subtitle">Admin Console</div>
            </div>
          </div>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Main navigation">
          <div className="admin-sidebar-group-label">Content</div>
          {mainNav.map((n) => (
            <a
              key={n.slug}
              href={n.href}
              className={`admin-sidebar-link ${active === n.slug ? 'active' : ''}`}
            >
              <span className="admin-sidebar-link-icon">{n.icon}</span>
              <span>{n.label}</span>
            </a>
          ))}

          <div className="admin-sidebar-group-label">Manage</div>
          {advNav.map((n) => (
            <a
              key={n.slug}
              href={n.href}
              className={`admin-sidebar-link ${active === n.slug ? 'active' : ''}`}
            >
              <span className="admin-sidebar-link-icon">{n.icon}</span>
              <span>{n.label}</span>
            </a>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div>
            <div style={{ fontWeight: 500, color: 'rgba(255,255,255,.9)' }}>{user?.displayName ?? '—'}</div>
            <div style={{ textTransform: 'capitalize', marginTop: 2 }}>{user?.role ?? 'guest'}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'rgba(255,255,255,.85)', background: 'rgba(255,255,255,.05)' }}
              onClick={() => setHelpOpen(true)}
            ><IconHelp size={14} /> Help</button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'rgba(255,255,255,.85)', background: 'rgba(255,255,255,.05)' }}
              onClick={() => signOut().then(() => { window.location.href = '/admin/login'; })}
            ><IconLogout size={14} /> Sign out</button>
          </div>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="admin-topbar">
          <button
            className="admin-hamburger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <IconClose size={18} /> : <IconMenu size={18} />}
          </button>
          <h1 className="admin-topbar-title">{title}</h1>
          <div className="admin-topbar-spacer" />
          <div className="admin-topbar-actions">
            <button className="admin-topbar-search" onClick={() => setPaletteOpen(true)}>
              <IconSearch size={14} />
              <span>Search or jump…</span>
              <kbd>⌘K</kbd>
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open('/', '_blank', 'noopener,noreferrer')}
              leading={<IconSparkle size={14} />}
              className="hidden-mobile"
            >
              View live site
            </Button>
          </div>
        </header>

        <main className="admin-main">
          {subtitle && (
            <div className="admin-page-subtitle" style={{ marginBottom: 'var(--sp-6)' }}>
              {subtitle}
            </div>
          )}
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={visibleNav.map((n) => ({
          id: n.slug,
          label: n.label,
          hint: n.description,
          icon: n.icon,
          action: () => { window.location.href = n.href; },
        }))}
      />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
