/**
 * Operational admin dashboard.
 *
 * Public page changes now use Netlify Agent Runners + Git review. This screen
 * intentionally focuses on the systems still managed in the park console.
 */

import { useEffect, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useAuth } from './AuthContext';
import { apiGet } from './api-client';
import { Card, CardHeader, StatCard } from './ui/Card';
import { Button } from './ui/Button';
import {
  IconSparkle, IconCalendar, IconMedia, IconUsers, IconGlobe,
  IconAudit, IconSettings, IconCheck, IconAlert,
} from './ui/Icon';

interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: string;
  target_label: string | null;
}

interface SyncService {
  status: 'idle' | 'running' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  items_processed: number | null;
}

interface SyncStatus {
  services: Record<string, SyncService | null>;
  checkedAt: string;
}

interface DashboardStats {
  conversions: {
    totals7d: { book_now: number; reserve: number; call: number; email: number; golf_tee: number };
  };
  alerts: Array<{ key: string; severity: 'info' | 'warning' | 'error'; message: string; href?: string }>;
  clarity: { dashboardUrl: string };
}

function DashboardInner() {
  const { user } = useAuth();
  const [recent, setRecent] = useState<AuditEntry[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiGet<{ entries: AuditEntry[] }>('/api/audit/log', { limit: 6 }).then((result) => setRecent(result.entries)).catch(() => setRecent([]));
    apiGet<SyncStatus>('/api/sync/status').then(setSync).catch(() => setSync(null));
    apiGet<DashboardStats>('/api/dashboard/stats').then(setStats).catch(() => setStats(null));
  }, []);

  const drive = sync?.services?.zoho_drive ?? null;
  const calendar = sync?.services?.zoho_calendar ?? null;
  const totalConversions = stats
    ? Object.values(stats.conversions.totals7d).reduce((sum, value) => sum + value, 0)
    : '—';

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
      <Card style={{ background: 'linear-gradient(135deg, #153d33, #0c241e)', color: '#fff', border: 'none' }}>
        <div className="card-eyebrow" style={{ color: '#bce4d8' }}>Website changes</div>
        <h2 style={{ color: '#fff', margin: 'var(--sp-2) 0 var(--sp-3)' }}>Edit with Claude Code or Codex in Netlify.</h2>
        <p style={{ maxWidth: 720, color: 'rgba(255,255,255,.74)', lineHeight: 1.65 }}>
          Agent Runners create an isolated branch, show the file diff, build a Deploy Preview, and prepare a GitHub pull request. The live site changes only after review and merge.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
          <Button size="lg" onClick={() => window.open('https://app.netlify.com/', '_blank', 'noopener,noreferrer')} leading={<IconSparkle size={16} />}>Open Netlify</Button>
          <Button size="lg" variant="secondary" onClick={() => window.open('/', '_blank', 'noopener,noreferrer')} style={{ background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.18)' }}>View live site</Button>
        </div>
      </Card>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <StatCard label="7-day actions" value={totalConversions} footnote="Bookings, calls, email, golf" />
        <StatCard label="Admin role" value={user?.role ?? '—'} footnote="Operational access" />
        <StatCard label="Photo sync" value={drive?.status ?? '—'} footnote={drive?.started_at ? relativeTime(drive.started_at) : 'No run found'} />
        <StatCard label="Calendar sync" value={calendar?.status ?? '—'} footnote={calendar?.started_at ? relativeTime(calendar.started_at) : 'No run found'} />
      </div>

      {stats?.alerts?.map((alert) => (
        <div key={alert.key} className={`alert ${alert.severity === 'error' ? 'alert-danger' : 'alert-warning'}`}>
          <IconAlert size={16} /><div><div className="alert-title">{alert.message}</div>{alert.href && <a href={alert.href}>Open the relevant tool →</a>}</div>
        </div>
      ))}

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Card>
          <CardHeader title="Operational tools" eyebrow="Still managed here" />
          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            <QuickLink href="/admin/media" icon={<IconMedia size={18} />} title="Media library" hint="Upload and manage park photos" />
            <QuickLink href="/admin/events" icon={<IconCalendar size={18} />} title="Events" hint="Manage the published park calendar" />
            <QuickLink href="/admin/area-guide" icon={<IconGlobe size={18} />} title="Area guide data" hint="Trails, places, activities, and park sites" />
            <QuickLink href="/admin/park-map" icon={<IconGlobe size={18} />} title="Park map" hint="Map image, polygons, and site placement" />
          </div>
        </Card>

        <Card>
          <CardHeader title="System health" eyebrow="Current services" />
          <HealthRow label="Database and authentication" state="success" detail="Supabase-backed operations" />
          <HealthRow label="Zoho photo sync" state={drive?.status ?? 'idle'} detail={drive?.error_message ?? (drive?.started_at ? relativeTime(drive.started_at) : 'Waiting for first run')} />
          <HealthRow label="Zoho calendar sync" state={calendar?.status ?? 'idle'} detail={calendar?.error_message ?? (calendar?.started_at ? relativeTime(calendar.started_at) : 'Waiting for first run')} />
          <a href="/admin/settings" style={{ display: 'inline-block', marginTop: 'var(--sp-4)' }}><IconSettings size={13} /> Open settings →</a>
        </Card>

        <Card>
          <CardHeader title="Recent operational activity" eyebrow="Audit log" action={<a href="/admin/audit">View all →</a>} />
          {!recent.length ? <p className="text-muted">No recent entries returned.</p> : (
            <ul style={{ display: 'grid', gap: 'var(--sp-3)', margin: 0, padding: 0, listStyle: 'none' }}>
              {recent.map((entry) => <li key={entry.id}><strong>{entry.target_label ?? entry.action}</strong><div className="text-xs text-muted">{entry.actor_email ?? 'System'} · {relativeTime(entry.occurred_at)}</div></li>)}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Administration" eyebrow="People + accountability" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          <a className="btn btn-secondary" href="/admin/users"><IconUsers size={14} /> Users</a>
          <a className="btn btn-secondary" href="/admin/audit"><IconAudit size={14} /> Change log</a>
          {stats?.clarity?.dashboardUrl && <a className="btn btn-secondary" href={stats.clarity.dashboardUrl} target="_blank" rel="noreferrer">Analytics ↗</a>}
        </div>
      </Card>
    </div>
  );
}

function QuickLink({ href, icon, title, hint }: { href: string; icon: React.ReactNode; title: string; hint: string }) {
  return <a href={href} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, padding: 'var(--sp-3)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', textDecoration: 'none' }}><span>{icon}</span><span><strong>{title}</strong><small className="text-muted" style={{ display: 'block' }}>{hint}</small></span></a>;
}

function HealthRow({ label, state, detail }: { label: string; state: string; detail: string }) {
  const ok = state === 'success';
  return <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 10, marginBottom: 'var(--sp-3)' }}>{ok ? <IconCheck size={16} /> : <IconAlert size={16} />}<div><strong>{label}</strong><small className="text-muted" style={{ display: 'block' }}>{detail}</small></div></div>;
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function Dashboard() {
  return <AdminProviders><AuthGuard><DashboardInner /></AuthGuard></AdminProviders>;
}
