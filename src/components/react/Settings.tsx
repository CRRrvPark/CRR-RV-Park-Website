/**
 * Settings — admin settings page. Owner-focused.
 *
 * Shows Zoho connection status, lets the owner connect / reconnect Zoho,
 * manually triggers syncs, displays configuration and env-var diagnostics.
 */

import { useEffect, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useToast } from './Toast';
import { apiGet, apiPost } from './api-client';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import {
  IconCheck, IconAlert, IconSpinner, IconDownload,
  IconExternal, IconSettings, IconGlobe, IconMail,
} from './ui/Icon';

interface ZohoStatus {
  hasOauthConfig: boolean;
  connected: boolean;
  authorizeUrl: string | null;
  tokens: { service: string; expiresAt: string; updatedAt: string; scope: string }[];
  mediaFolderId: string | null;
  calendarUid: string | null;
  driveSync: SyncRun | null;
  calendarSync: SyncRun | null;
}
interface SyncRun {
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failed' | 'idle';
  items_added: number;
  items_updated: number;
  error_message: string | null;
}

interface CalendarListItem {
  uid: string;
  name: string;
  description?: string;
  isdefault?: boolean;
  owned?: boolean;
}

function SettingsInner() {
  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [syncing, setSyncing] = useState<'drive' | 'calendar' | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [calendars, setCalendars] = useState<CalendarListItem[] | null>(null);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const { toast } = useToast();

  const reload = () =>
    apiGet<ZohoStatus>('/api/zoho/status').then(setStatus).catch(() => setStatus(null));

  useEffect(() => { reload(); }, []);

  const repairHome = async () => {
    setRepairing(true);
    try {
      const res = await apiPost<{ ok: boolean; changes: string[]; note?: string }>('/api/builder/repair-home');
      if (!res.changes || res.changes.length === 0) {
        toast.success('Home page already looks good', { detail: res.note ?? 'Nothing to repair.' });
      } else {
        toast.success('Home page content restored', {
          detail: `${res.changes.length} change${res.changes.length === 1 ? '' : 's'} applied. A pre-repair snapshot was saved — roll back from Versions if needed.`,
        });
      }
    } catch (err: any) {
      toast.error('Repair failed', { detail: err.message });
    } finally {
      setRepairing(false);
    }
  };

  const findCalendars = async () => {
    setLoadingCalendars(true);
    setCalendars(null);
    try {
      const res = await apiGet<{ calendars: CalendarListItem[] }>('/api/zoho/calendars');
      setCalendars(res.calendars ?? []);
    } catch (err: any) {
      toast.error('Could not list calendars', { detail: err.message });
    } finally {
      setLoadingCalendars(false);
    }
  };

  const syncNow = async (service: 'drive' | 'calendar') => {
    setSyncing(service);
    try {
      const path = service === 'drive' ? '/api/zoho/drive-sync' : '/api/zoho/calendar-sync';
      const res = await apiPost<any>(path);
      toast.success(`${service} sync finished`, { detail: `+${res.added ?? 0} added, ${res.updated ?? 0} updated` });
      reload();
    } catch (err: any) {
      toast.error(`${service} sync failed`, { detail: err.message });
    } finally {
      setSyncing(null);
    }
  };

  if (!status) {
    return (
      <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
        <IconSpinner size={24} /> <div className="text-muted mt-3">Loading settings…</div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
      {/* Zoho integration banner */}
      <Card>
        <CardHeader
          title="Zoho Integration"
          eyebrow="External services"
          subtitle="Connect Zoho One so the website can read your WorkDrive photos and Calendar events."
        />

        {!status.hasOauthConfig ? (
          <div className="alert alert-warning">
            <IconAlert size={18} />
            <div>
              <div className="alert-title">OAuth not configured</div>
              <div className="alert-body">
                Set <code>ZOHO_CLIENT_ID</code>, <code>ZOHO_CLIENT_SECRET</code>,
                and <code>ZOHO_REDIRECT_URI</code> in your Netlify environment
                variables. See the <code>NETLIFY-DEPLOY.md</code> file or
                the <a href="/admin/runbook">runbook</a> for step-by-step instructions.
              </div>
            </div>
          </div>
        ) : !status.connected ? (
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-danger"><span className="badge-dot" /> Not connected</span>
            {status.authorizeUrl && (
              <a href={status.authorizeUrl} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <IconExternal size={14} /> Connect Zoho
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-success"><IconCheck size={10} /> Connected</span>
            {status.tokens[0] && (
              <span className="text-sm text-muted">
                Last authorized {new Date(status.tokens[0].updatedAt).toLocaleString()}
              </span>
            )}
            {status.authorizeUrl && (
              <a href={status.authorizeUrl} className="btn btn-ghost btn-sm">Reconnect</a>
            )}
          </div>
        )}
      </Card>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {/* Drive */}
        <Card>
          <CardHeader title="Zoho WorkDrive" eyebrow="Media library source" />
          <KV items={[
            ['Media folder', status.mediaFolderId
              ? <code className="text-xs">{truncateMiddle(status.mediaFolderId, 36)}</code>
              : <em className="text-muted">not set</em>],
            ['Last sync', <SyncCell run={status.driveSync} />],
          ]} />
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <Button
              size="sm"
              variant="secondary"
              loading={syncing === 'drive'}
              disabled={!status.connected}
              onClick={() => syncNow('drive')}
              leading={<IconDownload size={14} />}
            >Sync now</Button>
          </div>
        </Card>

        {/* Calendar */}
        <Card>
          <CardHeader title="Zoho Calendar" eyebrow="Events source" />
          <KV items={[
            ['Calendar UID', status.calendarUid
              ? <code className="text-xs">{truncateMiddle(status.calendarUid, 36)}</code>
              : <em className="text-muted">not set</em>],
            ['Last sync', <SyncCell run={status.calendarSync} />],
          ]} />

          {/* Warn if the configured UID looks like an embed key (the common misconfiguration) */}
          {status.calendarUid && (status.calendarUid.startsWith('zz') || status.calendarUid.length > 80) && (
            <div className="alert alert-warning" style={{ marginTop: 'var(--sp-3)' }}>
              <IconAlert size={16} />
              <div>
                <div className="alert-title">This looks like an embed key, not a calendar UID</div>
                <div className="alert-body">
                  Zoho's API needs the short <code>uid</code> of the calendar (usually 32 characters),
                  not the long public-share/embed key. Click "Find my calendars" below to look up
                  the right value, then update <code>ZOHO_CALENDAR_PUBLIC_EVENTS_ID</code> in your
                  Netlify environment variables.
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 'var(--sp-3)', display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              loading={syncing === 'calendar'}
              disabled={!status.connected}
              onClick={() => syncNow('calendar')}
              leading={<IconDownload size={14} />}
            >Sync now</Button>
            <Button
              size="sm"
              variant="ghost"
              loading={loadingCalendars}
              disabled={!status.connected}
              onClick={findCalendars}
            >Find my calendars</Button>
          </div>

          {calendars && (
            <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-sm)' }}>
              {calendars.length === 0 ? (
                <em className="text-muted">No calendars returned — check the OAuth scope.</em>
              ) : (
                <>
                  <div className="text-muted" style={{ marginBottom: 4 }}>
                    Copy the <code>uid</code> of the calendar whose events you want to publish and
                    set it as <code>ZOHO_CALENDAR_PUBLIC_EVENTS_ID</code> in Netlify env vars.
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                    {calendars.map((c) => (
                      <li key={c.uid} style={{
                        padding: 'var(--sp-2)',
                        border: '1px solid var(--c-border)',
                        borderRadius: 'var(--r-sm)',
                        background: 'var(--c-surface-muted)',
                      }}>
                        <div style={{ fontWeight: 500 }}>
                          {c.name}
                          {c.isdefault && <span className="badge badge-info" style={{ marginLeft: 6 }}>default</span>}
                        </div>
                        <code className="text-xs" style={{ wordBreak: 'break-all' }}>{c.uid}</code>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Site configuration */}
      <Card>
        <CardHeader title="Site configuration" eyebrow="Read-only" subtitle="To change these, update environment variables in Netlify." />
        <KV items={[
          ['Public URL', <a href="https://www.crookedriverranchrv.com" target="_blank" rel="noopener noreferrer"><IconGlobe size={12} /> crookedriverranchrv.com</a>],
          ['Admin URL', <code>/admin</code>],
          ['System email', <><IconMail size={12} /> <a href="mailto:rvpark@crookedriverranch.com">rvpark@crookedriverranch.com</a></>],
          ['Hosting', 'Netlify (serverless functions)'],
          ['Database', 'Supabase (PostgreSQL)'],
          ['Analytics', <>Microsoft Clarity (<code>w90s0eo24y</code>) · <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer">dashboard <IconExternal size={10} /></a></>],
        ]} />
      </Card>

      {/* Content repair */}
      <Card>
        <CardHeader
          title="Home page content repair"
          eyebrow="Diagnostics"
          subtitle="Restore the canonical 4 site-type cards (Full Hookup, W&E, Tent, Dry Camp) and the Dark Skies nebula background if they migrated as empty."
        />
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="secondary"
            loading={repairing}
            onClick={repairHome}
          >Restore default home content</Button>
          <span className="text-xs text-muted">
            Safe — creates a version snapshot first. Only fills fields that are currently empty.
          </span>
        </div>
      </Card>

      {/* Where to go next */}
      <Card style={{ background: 'var(--c-surface-alt)' }}>
        <CardHeader title="Need to change something else?" eyebrow="Further reading" />
        <div className="text-sm" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <div>· Brand colors & fonts: edit <code>public/styles/global.css</code>.</div>
          <div>· Per-page meta & navigation: use the <a href="/admin/editor">Pages</a> tab.</div>
          <div>· Role/capability rules: see <code>src/lib/rbac.ts</code> in the code editor.</div>
          <div>· Publishing cadence: every publish triggers a Netlify build (~1–2 min).</div>
          <div>· Ask for help: email <a href="mailto:rvpark@crookedriverranch.com">rvpark@crookedriverranch.com</a> or press <kbd style={kbdStyle}>?</kbd>.</div>
        </div>
      </Card>
    </div>
  );
}

function KV({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl style={{
      display: 'grid',
      gridTemplateColumns: 'max-content 1fr',
      gap: 'var(--sp-2) var(--sp-4)',
      margin: 0,
      fontSize: 'var(--fs-sm)',
    }}>
      {items.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt className="text-muted">{k}</dt>
          <dd style={{ margin: 0 }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SyncCell({ run }: { run: SyncRun | null }) {
  if (!run) return <em className="text-muted">Never</em>;
  const cls = run.status === 'success' ? 'badge-success' : run.status === 'failed' ? 'badge-danger' : 'badge-info';
  return (
    <div>
      <span className={`badge ${cls}`}>{run.status}</span>
      <span className="text-muted" style={{ marginLeft: 8 }}>
        {new Date(run.started_at).toLocaleString()}
      </span>
      {run.status === 'success' && (
        <div className="text-xs text-muted">
          +{run.items_added} added · {run.items_updated} updated
        </div>
      )}
      {run.error_message && (
        <div className="text-xs" style={{ color: 'var(--c-danger-text)', marginTop: 4 }}>
          {run.error_message}
        </div>
      )}
    </div>
  );
}

function truncateMiddle(s: string, n: number) {
  if (s.length <= n) return s;
  const side = Math.floor((n - 1) / 2);
  return `${s.slice(0, side)}…${s.slice(-side)}`;
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

export function Settings() {
  return (
    <AdminProviders>
      <AuthGuard>
        <SettingsInner />
      </AuthGuard>
    </AdminProviders>
  );
}
