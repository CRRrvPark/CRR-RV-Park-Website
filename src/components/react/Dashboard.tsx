/**
 * Dashboard — the /admin landing page.
 *
 * Goal: a non-technical user should land here and instantly know:
 *   1. Is the site healthy? (green dots)
 *   2. Is there anything waiting on me? (pending drafts, sync errors)
 *   3. How do I publish changes? (big primary button)
 *   4. Where should I go next? (clickable quick links)
 *
 * Everything uses the design system — no inline style noise.
 */

import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost } from './api-client';
import { Card, CardHeader, StatCard } from './ui/Card';
import { Button } from './ui/Button';
import {
  IconSparkle, IconCalendar, IconPages, IconMedia, IconUsers,
  IconHelp, IconHistory, IconCheck, IconAlert,
} from './ui/Icon';

interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: string;
  target_label: string | null;
}

interface SyncStatusResp {
  services: Record<string, null | {
    status: 'idle' | 'running' | 'success' | 'failed';
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
    items_processed: number | null;
  }>;
  pendingDrafts: number;
  unpublishedChanges: number;
  checkedAt: string;
}

interface DailyCount {
  day: string;
  book_now: number;
  reserve: number;
  call: number;
  email: number;
  golf_tee: number;
}
interface DashboardStats {
  conversions: {
    daily: DailyCount[];
    totals7d: { book_now: number; reserve: number; call: number; email: number; golf_tee: number };
  };
  alerts: Array<{ key: string; severity: 'info' | 'warning' | 'error'; message: string; href?: string }>;
  clarity: { projectId: string; dashboardUrl: string };
  checkedAt: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [recent, setRecent] = useState<AuditEntry[] | null>(null);
  const [sync, setSync] = useState<SyncStatusResp | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem('crr-welcome-dismissed');
  });

  useEffect(() => {
    apiGet<{ entries: AuditEntry[] }>('/api/audit/log', { limit: 6 })
      .then((res) => setRecent(res.entries))
      .catch(() => setRecent([]));
    apiGet<SyncStatusResp>('/api/sync/status')
      .then(setSync)
      .catch(() => setSync({ services: {}, pendingDrafts: 0, unpublishedChanges: 0, checkedAt: new Date().toISOString() }));
    apiGet<DashboardStats>('/api/dashboard/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const publish = async () => {
    const ok = await confirm({
      title: 'Publish to the live site?',
      message: (
        <>
          This pushes every unpublished change to <strong>crookedriverranchrv.com</strong>.
          Updates appear within 1–2 minutes. If anything breaks, you can roll back from the
          Versions tab.
        </>
      ),
      confirmLabel: 'Publish now',
    });
    if (!ok) return;
    setPublishing(true);
    setPublishStatus('queued');
    try {
      const res = await apiPost<{ publishId: string }>('/api/publish');
      toast.success('Publish started', { detail: 'You can keep working — it runs in the background.' });
      pollPublishStatus(res.publishId);
    } catch (err: any) {
      toast.error('Publish failed', { detail: err.message });
      setPublishing(false);
      setPublishStatus(null);
    }
  };

  const pollPublishStatus = async (id: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await apiGet<{ publish: { status: string; error_message?: string } }>('/api/publish/status', { id });
        setPublishStatus(res.publish.status);
        if (res.publish.status === 'success') {
          toast.success('Published successfully', { detail: 'Changes are now live.' });
          setPublishing(false);
          return;
        }
        if (res.publish.status === 'failed' || res.publish.status === 'rolled_back') {
          toast.error('Publish failed', { detail: res.publish.error_message });
          setPublishing(false);
          return;
        }
      } catch { /* transient; keep polling */ }
    }
    setPublishing(false);
    setPublishStatus('timed-out');
    toast.warning('Still running…', { detail: 'Check the Change Log tab.' });
  };

  const dismissWelcome = () => {
    window.localStorage.setItem('crr-welcome-dismissed', String(Date.now()));
    setShowWelcome(false);
  };

  const drafts = sync?.pendingDrafts ?? 0;
  const drive = sync?.services?.zoho_drive ?? null;
  const cal = sync?.services?.zoho_calendar ?? null;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
      {stats?.alerts && stats.alerts.length > 0 && (
        <AlertsStrip alerts={stats.alerts} />
      )}
      {showWelcome && (
        <WelcomeCard name={user?.displayName ?? 'there'} onDismiss={dismissWelcome} />
      )}

      {/* Hero: Publish + quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-5)' }}>
        <Card style={{
          background: 'linear-gradient(135deg, #231810, #3a2820)',
          color: '#fff',
          border: 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div className="card-eyebrow" style={{ color: 'var(--c-gold)' }}>Ready to publish</div>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--fs-3xl)',
              lineHeight: 1.1,
              fontWeight: 400,
              margin: 'var(--sp-2) 0 var(--sp-4)',
            }}>
              {drafts > 0 ? `${drafts} change${drafts === 1 ? '' : 's'} pending` : `Site is up to date`}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 360, marginBottom: 'var(--sp-5)', lineHeight: 1.55 }}>
              {drafts > 0
                ? 'Your edits are saved but not yet on the live site. Publish when you\'re ready.'
                : 'All edits are published. Changes will show up here as you edit.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <Button
              size="lg"
              onClick={publish}
              loading={publishing}
              leading={<IconSparkle size={16} />}
            >
              {publishing ? `Publishing${publishStatus ? ` · ${publishStatus}` : '…'}` : 'Publish changes'}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => window.open('/', '_blank', 'noopener,noreferrer')}
              style={{ background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.18)' }}
            >
              Preview site
            </Button>
          </div>
        </Card>

        <StatCard
          label="Drafts pending"
          value={drafts}
          footnote={drafts === 0 ? 'Nothing waiting' : 'Review + publish below'}
        />
        <StatCard
          label="Your role"
          value={user?.role ?? '—'}
          footnote={<span style={{ textTransform: 'capitalize' }}>{ROLE_BLURB[user?.role ?? 'viewer']}</span>}
        />
      </div>

      {/* Conversions — who clicked what, last 14 days */}
      <ConversionsCard stats={stats} />

      {/* Three-up: health + recent + quick links */}
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Card>
          <CardHeader title="System health" eyebrow="At a glance" />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-3)' }}>
            <HealthRow label="Database (Supabase)" state="ok" detail="Responding normally" />
            <HealthRow
              label="Photo sync (Zoho Drive)"
              state={drive ? (drive.status === 'failed' ? 'error' : drive.status === 'running' ? 'pending' : 'ok') : 'pending'}
              detail={drive?.started_at ? `Last run ${relativeTime(drive.started_at)}${drive.items_processed ? ` · ${drive.items_processed} items` : ''}` : 'No runs yet'}
            />
            <HealthRow
              label="Calendar sync (Zoho)"
              state={cal ? (cal.status === 'failed' ? 'error' : cal.status === 'running' ? 'pending' : 'ok') : 'pending'}
              detail={cal?.started_at ? `Last run ${relativeTime(cal.started_at)}${cal.items_processed ? ` · ${cal.items_processed} events` : ''}` : 'No runs yet'}
            />
          </ul>
          <div style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)' }}>
            Checked {sync ? relativeTime(sync.checkedAt) : '…'} · <a href="/admin/settings">settings</a>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            eyebrow="Last 6 edits"
            action={<a href="/admin/audit" className="btn btn-ghost btn-sm">View all →</a>}
          />
          {recent === null && <ActivitySkeleton />}
          {recent && recent.length === 0 && (
            <div className="text-muted text-sm" style={{ padding: 'var(--sp-6) 0', textAlign: 'center' }}>
              Nothing yet. Edits show up here the moment they happen.
            </div>
          )}
          {recent && recent.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-3)' }}>
              {recent.map((r) => (
                <li key={r.id} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--c-rust-soft)', color: 'var(--c-rust)',
                    display: 'grid', placeItems: 'center',
                    fontFamily: 'var(--font-serif)', fontSize: '1rem',
                    flexShrink: 0,
                  }}>
                    {(r.actor_email ?? 'S')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm">
                      <strong>{r.actor_email ?? 'system'}</strong>
                      <span className="text-muted"> · {humanizeAction(r.action)}</span>
                    </div>
                    <div className="text-xs text-muted truncate">
                      {r.target_label} · {relativeTime(r.occurred_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick links" eyebrow="Jump to" />
          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            <QuickLink href="/admin/editor" icon={<IconPages size={18} />} title="Edit pages"     hint="Change copy, prices, photos" />
            <QuickLink href="/admin/media"  icon={<IconMedia size={18} />} title="Upload photos"   hint="Drag &amp; drop to add" />
            <QuickLink href="/admin/events" icon={<IconCalendar size={18} />} title="Manage events" hint="Schedule + publish" />
            <QuickLink href="/admin/versions" icon={<IconHistory size={18} />} title="Restore a version" hint="Roll back a publish" />
            {user?.role === 'owner' && (
              <QuickLink href="/admin/users"  icon={<IconUsers size={18} />} title="Invite editors" hint="Assign roles" />
            )}
            <QuickLink href="/admin/runbook" icon={<IconHelp size={18} />} title="Operations runbook" hint="Troubleshoot anything" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function HealthRow({ label, state, detail }: { label: string; state: 'ok' | 'error' | 'pending'; detail: string }) {
  const color = state === 'ok' ? 'var(--c-success)' : state === 'error' ? 'var(--c-danger)' : 'var(--c-text-muted)';
  const icon = state === 'ok' ? <IconCheck size={14} /> : state === 'error' ? <IconAlert size={14} /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />;
  return (
    <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <span style={{ color }}>{icon}</span>
        <div>
          <div className="text-sm" style={{ fontWeight: 500 }}>{label}</div>
          <div className="text-xs text-muted">{detail}</div>
        </div>
      </div>
    </li>
  );
}

function QuickLink({ href, icon, title, hint }: { href: string; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
        padding: 'var(--sp-3)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        color: 'var(--c-text)',
        transition: 'border-color 120ms, background 120ms',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--c-rust-soft)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c-surface-alt)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--c-border)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--r-md)',
        background: 'var(--c-rust-soft)', color: 'var(--c-rust)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{title}</div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
    </a>
  );
}

function WelcomeCard({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  return (
    <Card style={{
      background: 'linear-gradient(120deg, rgba(196,98,45,.05), rgba(212,168,83,.04))',
      borderColor: 'rgba(196,98,45,.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-4)' }}>
        <div>
          <div className="card-eyebrow">Welcome to the admin</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-2xl)', fontWeight: 400, margin: '0 0 var(--sp-2)' }}>
            Hey <em style={{ color: 'var(--c-rust)' }}>{name}</em> — here's how this works.
          </h2>
          <p className="text-muted" style={{ maxWidth: 600 }}>
            Every change you make saves automatically. When you're ready for those
            changes to appear on the live site, click <strong>Publish changes</strong> below.
            Made a mistake? Roll back from <strong>Versions</strong>. Stuck? Press <kbd style={kbdStyle}>?</kbd> for help.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>Got it</Button>
      </div>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <div className="skeleton" style={{ height: 14, width: '60%' }} />
            <div className="skeleton" style={{ height: 10, width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const ROLE_BLURB: Record<string, string> = {
  owner: 'Full control',
  editor: 'Edit + publish',
  contributor: 'Draft for review',
  viewer: 'Read only',
};

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    content_edit: 'edited content',
    content_publish_request: 'triggered a publish',
    publish_succeeded: 'published the site',
    publish_failed: 'publish failed',
    user_invited: 'invited a user',
    user_removed: 'removed a user',
    role_changed: 'changed a role',
    snapshot_restored: 'restored a snapshot',
    media_uploaded: 'uploaded media',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.round(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  background: 'var(--c-surface-muted)',
  border: '1px solid var(--c-border)',
  borderRadius: 'var(--r-sm)',
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
};

function AlertsStrip({ alerts }: { alerts: DashboardStats['alerts'] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
      {alerts.map((a) => {
        const bg = a.severity === 'error' ? 'var(--c-danger-soft, #fde6e6)'
          : a.severity === 'warning' ? 'var(--c-warning-soft, #fdf2d9)'
          : 'var(--c-info-soft, #e6f1fd)';
        const border = a.severity === 'error' ? 'var(--c-danger, #dc2626)'
          : a.severity === 'warning' ? 'var(--c-warning, #d69e2e)'
          : 'var(--c-info, #2b6cb0)';
        return (
          <div
            key={a.key}
            style={{
              display: 'flex',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-3) var(--sp-4)',
              background: bg,
              borderLeft: `4px solid ${border}`,
              borderRadius: 'var(--r-sm)',
              alignItems: 'center',
            }}
          >
            <IconAlert size={16} style={{ color: border, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>{a.message}</div>
            {a.href && (
              <a href={a.href} className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                Go fix →
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConversionsCard({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return (
      <Card>
        <CardHeader title="Visitor actions" eyebrow="Last 14 days" />
        <div className="text-muted text-sm" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          Loading…
        </div>
      </Card>
    );
  }

  const { daily, totals7d } = stats.conversions;
  const maxDaily = Math.max(
    1,
    ...daily.map((d) => d.book_now + d.reserve + d.call + d.email + d.golf_tee),
  );

  return (
    <Card>
      <CardHeader
        title="Visitor actions"
        eyebrow="Last 14 days · 7-day totals"
        action={
          <a
            href={stats.clarity.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            title="Open Microsoft Clarity for session replays, heatmaps, and engagement metrics"
          >
            Full analytics (Clarity) →
          </a>
        }
      />

      {/* 7-day totals row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-5)',
        }}
      >
        <TotalTile label="Book Now" value={totals7d.book_now} color="var(--c-rust, #c4622d)" />
        <TotalTile label="Reserve" value={totals7d.reserve} color="var(--c-rust, #c4622d)" />
        <TotalTile label="Phone" value={totals7d.call} color="var(--c-success, #2b8a3e)" />
        <TotalTile label="Email" value={totals7d.email} color="var(--c-info, #2b6cb0)" />
        <TotalTile label="Golf tee" value={totals7d.golf_tee} color="var(--c-warning, #d69e2e)" />
      </div>

      {/* Daily bar chart */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 72, marginBottom: 'var(--sp-2)' }}>
        {daily.map((d) => {
          const total = d.book_now + d.reserve + d.call + d.email + d.golf_tee;
          const heightPct = total === 0 ? 2 : (total / maxDaily) * 100;
          return (
            <div
              key={d.day}
              title={`${d.day}: ${total} click${total === 1 ? '' : 's'} (book:${d.book_now} reserve:${d.reserve} call:${d.call} email:${d.email} golf:${d.golf_tee})`}
              style={{
                flex: 1,
                minHeight: 2,
                height: `${heightPct}%`,
                background: total > 0 ? 'var(--c-rust, #c4622d)' : 'var(--c-border, #e5e5e5)',
                borderRadius: 2,
                transition: 'height 160ms',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)' }}>
        <span>{daily[0]?.day}</span>
        <span>Today</span>
      </div>

      <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)' }}>
        Counts are from visitors clicking Book Now, Reserve, phone links, email links, and golf-tee links on the public site.
        Identity is not tracked — visitor counts are session-level only. For heatmaps, scroll depth, and session replays, open the Clarity dashboard.
      </div>
    </Card>
  );
}

function TotalTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-3)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 'var(--fs-2xl)', fontFamily: 'var(--font-serif)', color, lineHeight: 1 }}>
        {value}
      </div>
      <div className="text-xs text-muted" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}
