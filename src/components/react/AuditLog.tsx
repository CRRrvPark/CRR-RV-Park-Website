/**
 * AuditLog — searchable change log with before/after diff viewer.
 */

import { Fragment, useEffect, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { apiGet } from './api-client';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import {
  IconAudit, IconSearch, IconSpinner, IconChevronRight, IconChevronDown, IconFilter,
} from './ui/Icon';

interface Entry {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  target_label: string | null;
  before_value: unknown;
  after_value: unknown;
  notes: string | null;
}

const ACTIONS = [
  'content_edit', 'publish_succeeded', 'publish_failed',
  'snapshot_created', 'snapshot_restored',
  'role_changed', 'user_invited', 'user_removed',
  'code_edit', 'code_published',
  'zoho_sync_run', 'zoho_sync_failed',
  'login', 'logout',
];

function AuditLogInner() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);

  const load = async (reset = true) => {
    if (reset) { setLoading(true); setEntries([]); }
    try {
      const res = await apiGet<{ entries: Entry[]; nextCursor: string | null }>('/api/audit/log', {
        limit: 50,
        actor: actorFilter || undefined,
        action: actionFilter || undefined,
        before: reset ? undefined : (cursor ?? undefined),
      });
      setEntries((prev) => reset ? res.entries : [...prev, ...res.entries]);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true); }, [actorFilter, actionFilter]);

  const toggle = (id: number) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <Card>
        <CardHeader
          title="Change log"
          eyebrow="System history"
          subtitle="Every content edit, publish, sign-in, and role change."
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--c-text-muted)' }}>
            <IconFilter size={14} />
            <span className="text-sm">Filter</span>
          </div>
          <select
            className="select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 160 }}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <IconSearch
              size={16}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--c-text-muted)', pointerEvents: 'none',
              }}
            />
            <input
              className="input"
              placeholder="Filter by email…"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
            <IconSpinner size={22} /> <div className="text-muted mt-2">Loading…</div>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <EmptyState
            icon={<IconAudit size={24} />}
            title="No matching entries"
            body={actorFilter || actionFilter ? 'Clear the filters to see all recent events.' : 'Nothing has happened yet.'}
          />
        )}

        {entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 24 }}></th>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const open = expanded.has(e.id);
                  return (
                    <Fragment key={e.id}>
                      <tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggle(e.id)}
                      >
                        <td style={{ color: 'var(--c-text-muted)' }}>
                          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                        </td>
                        <td className="text-sm">{new Date(e.occurred_at).toLocaleString()}</td>
                        <td className="text-sm">{e.actor_email ?? <span className="text-muted">system</span>}</td>
                        <td><ActionBadge action={e.action} /></td>
                        <td className="text-sm truncate" style={{ maxWidth: 240 }}>
                          {e.target_label ?? e.target_table ?? '—'}
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={5} style={{ background: 'var(--c-surface-alt)', padding: 'var(--sp-4)' }}>
                            {e.notes && (
                              <div className="text-sm mb-3">
                                <strong>Notes:</strong> {e.notes}
                              </div>
                            )}
                            {(e.before_value || e.after_value)
                              ? <DiffView before={e.before_value} after={e.after_value} />
                              : <div className="text-muted text-sm">No value change recorded.</div>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {cursor && !loading && (
          <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
            <Button variant="secondary" onClick={() => load(false)}>Load more</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const dangerous = ['publish_failed', 'zoho_sync_failed', 'user_removed', 'snapshot_restored'];
  const success = ['publish_succeeded', 'content_edit', 'user_invited'];
  const cls = dangerous.includes(action) ? 'badge-danger' : success.includes(action) ? 'badge-success' : 'badge-info';
  return <span className={`badge ${cls}`}>{humanize(action)}</span>;
}

function DiffView({ before, after }: { before: unknown; after: unknown }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
      <div>
        <div className="text-xs" style={{ letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-danger-text)', marginBottom: 'var(--sp-1)' }}>Before</div>
        <pre style={codeStyle}>{before ? JSON.stringify(before, null, 2) : '(empty)'}</pre>
      </div>
      <div>
        <div className="text-xs" style={{ letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-success-text)', marginBottom: 'var(--sp-1)' }}>After</div>
        <pre style={codeStyle}>{after ? JSON.stringify(after, null, 2) : '(empty)'}</pre>
      </div>
    </div>
  );
}

function humanize(a: string): string {
  return a.replace(/_/g, ' ');
}

const codeStyle: React.CSSProperties = {
  background: 'var(--c-surface)',
  padding: 'var(--sp-3)',
  border: '1px solid var(--c-border)',
  borderRadius: 'var(--r-sm)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  overflow: 'auto',
  maxHeight: 300,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  margin: 0,
};

export function AuditLog() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_audit_log">
        <AuditLogInner />
      </AuthGuard>
    </AdminProviders>
  );
}
