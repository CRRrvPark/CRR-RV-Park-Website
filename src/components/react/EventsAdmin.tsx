/**
 * EventsAdmin — list synced events, toggle published, trigger manual sync.
 *
 * Events are edited in Zoho Calendar (single source of truth). This UI is
 * for visibility + selective publishing to the public site.
 *
 * Features:
 *   - Upcoming / Past tab switch
 *   - Sync-status banner
 *   - Group events by month with sticky month header
 *   - One-click publish toggle with visual state
 */

import { useEffect, useMemo, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { apiGet, apiPost, apiPatch } from './api-client';
import { can } from '@lib/rbac';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import {
  IconCalendar, IconCheck, IconAlert, IconDownload, IconSpinner,
  IconExternal,
} from './ui/Icon';

interface Event {
  id: string;
  zoho_event_uid: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  is_all_day: boolean;
  is_published: boolean;
  last_synced_at: string | null;
}

interface SyncStatus {
  connected: boolean;
  calendarUid: string | null;
  calendarSync: { status: string; started_at: string; items_added: number; items_updated: number; error_message: string | null } | null;
}

function EventsAdminInner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const load = () =>
    apiGet<{ events: Event[] }>('/api/events', { scope })
      .then((r) => setEvents(r.events))
      .catch((err) => toast.error('Could not load events', { detail: err.message }));

  const loadStatus = () => apiGet<SyncStatus>('/api/zoho/status').then(setSyncStatus).catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); loadStatus(); }, [scope]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await apiPost<any>('/api/zoho/calendar-sync');
      toast.success('Sync finished', { detail: `+${res.added ?? 0} added, ${res.updated ?? 0} updated` });
      load(); loadStatus();
    } catch (err: any) {
      toast.error('Sync failed', { detail: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const toggle = async (e: Event) => {
    try {
      await apiPatch(`/api/events/${e.id}`, { isPublished: !e.is_published });
      toast.success(e.is_published ? 'Hidden from public site' : 'Now visible on public site');
      load();
    } catch (err: any) {
      toast.error('Update failed', { detail: err.message });
    }
  };

  const canEdit = can(user?.role, 'edit_events');

  const grouped = useMemo(() => {
    if (!events) return null;
    const map = new Map<string, Event[]>();
    for (const e of events) {
      const d = new Date(e.starts_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).map(([key, list]) => {
      const [y, m] = key.split('-').map(Number);
      return { key, label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), events: list };
    });
  }, [events]);

  return (
    <div>
      {/* Status strip */}
      <Card tight style={{
        marginBottom: 'var(--sp-4)',
        background: syncStatus?.connected ? 'var(--c-success-soft)' : 'var(--c-warning-soft)',
        borderColor: syncStatus?.connected ? '#B8DFC6' : '#EBD59A',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {syncStatus?.connected ? (
              <><IconCheck size={14} style={{ color: 'var(--c-success)' }} />
              <span className="text-sm">
                <strong>Zoho Calendar connected.</strong>{' '}
                {syncStatus.calendarSync
                  ? <>Last sync {new Date(syncStatus.calendarSync.started_at).toLocaleString()}.</>
                  : <>No sync runs yet.</>}
              </span></>
            ) : (
              <><IconAlert size={14} style={{ color: 'var(--c-warning)' }} />
              <span className="text-sm">
                <strong>Zoho Calendar not connected.</strong>{' '}
                <a href="/admin/settings">Connect in Settings →</a>
              </span></>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                loading={syncing}
                disabled={!syncStatus?.connected}
                onClick={syncNow}
                leading={<IconDownload size={14} />}
              >Sync now</Button>
            )}
          </div>
        </div>
      </Card>

      <div className="alert alert-info" style={{ marginBottom: 'var(--sp-4)' }}>
        <IconCalendar size={18} />
        <div>
          <div className="alert-title">Events are edited in Zoho Calendar</div>
          <div className="alert-body">
            Add or edit events in your Zoho Calendar — they sync here hourly (or
            click <strong>Sync now</strong> above). Use the toggle on each event
            to show/hide it from the public Events page.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(['upcoming', 'past'] as const).map((k) => (
          <button
            key={k}
            className={`tab ${scope === k ? 'active' : ''}`}
            onClick={() => setScope(k)}
          >
            {k === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>

      {events === null && (
        <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
          <IconSpinner size={24} /> <div className="text-muted mt-3">Loading events…</div>
        </Card>
      )}
      {events && events.length === 0 && (
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title={scope === 'upcoming' ? 'No upcoming events' : 'No past events'}
            body={
              syncStatus?.connected
                ? 'Add events to your Zoho Calendar to populate this list.'
                : 'Connect Zoho Calendar in Settings to start syncing events.'
            }
            action={!syncStatus?.connected
              ? <Button onClick={() => { window.location.href = '/admin/settings'; }}>Open Settings</Button>
              : null
            }
          />
        </Card>
      )}

      {grouped?.map((group) => (
        <section key={group.key} style={{ marginTop: 'var(--sp-6)' }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontSize: 'var(--fs-xl)',
            margin: '0 0 var(--sp-3)',
            color: 'var(--c-text-soft)',
            letterSpacing: '.005em',
          }}>{group.label}</h2>
          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            {group.events.map((e) => (
              <EventRow key={e.id} event={e} canEdit={canEdit} onToggle={() => toggle(e)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventRow({ event, canEdit, onToggle }: { event: Event; canEdit: boolean; onToggle: () => void }) {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  return (
    <Card tight style={{
      opacity: event.is_published ? 1 : 0.68,
      borderLeft: `4px solid ${event.is_published ? 'var(--c-rust)' : 'var(--c-border-strong)'}`,
    }}>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
        <DateBadge date={start} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-lg)', fontWeight: 500, margin: 0 }}>
                {event.title}
              </h3>
              <div className="text-xs" style={{ color: 'var(--c-rust)', marginTop: 2, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {event.is_all_day
                  ? 'All day'
                  : `${fmtTime(start)} – ${fmtTime(end)}`}
                {event.location && <> · 📍 {event.location}</>}
              </div>
              {event.description && (
                <p className="text-sm text-muted" style={{ marginTop: 'var(--sp-2)', whiteSpace: 'pre-wrap' }}>
                  {truncate(event.description, 280)}
                </p>
              )}
            </div>
            {canEdit && (
              <Toggle checked={event.is_published} onChange={onToggle} label={event.is_published ? 'Public' : 'Hidden'} />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DateBadge({ date }: { date: Date }) {
  return (
    <div style={{
      flexShrink: 0,
      width: 56,
      textAlign: 'center',
      background: 'var(--c-rust-soft)',
      border: '1px solid rgba(196,98,45,.2)',
      borderRadius: 'var(--r-md)',
      padding: 'var(--sp-1) var(--sp-2)',
      color: 'var(--c-rust)',
    }}>
      <div className="text-xs" style={{ fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' }}>
        {date.toLocaleDateString('en-US', { month: 'short' })}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', lineHeight: 1, marginTop: 2, fontWeight: 400 }}>
        {date.getDate()}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--sp-2)',
      cursor: 'pointer',
      fontSize: 'var(--fs-sm)',
      color: checked ? 'var(--c-success-text)' : 'var(--c-text-muted)',
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ position: 'absolute', opacity: 0 }} />
      <span style={{
        width: 32, height: 18,
        borderRadius: 10,
        background: checked ? 'var(--c-success)' : 'var(--c-border-strong)',
        position: 'relative',
        transition: 'background 140ms',
      }}>
        <span style={{
          position: 'absolute',
          top: 2, left: checked ? 16 : 2,
          width: 14, height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 140ms',
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        }} />
      </span>
      <span>{label}</span>
    </label>
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

export function EventsAdmin() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_events">
        <EventsAdminInner />
      </AuthGuard>
    </AdminProviders>
  );
}
