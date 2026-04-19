/**
 * Versions — snapshot list + restore action.
 *
 * Every publish automatically creates a "pre_publish" snapshot, and the user
 * can create a manual snapshot at any time. Restoring sets the content state
 * back — but does NOT automatically publish (so the editor can tweak before
 * pushing live).
 */

import { useEffect, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost } from './api-client';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import {
  IconHistory, IconSpinner, IconSave, IconDownload,
} from './ui/Icon';

interface Snapshot {
  id: string;
  triggered_by: string | null;
  reason: string;
  byte_size: number | null;
  created_at: string;
}

function VersionsInner() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const reload = () =>
    apiGet<{ snapshots: Snapshot[] }>('/api/snapshots')
      .then((r) => setSnapshots(r.snapshots))
      .catch((err) => toast.error('Could not load versions', { detail: err.message }));

  useEffect(() => { reload(); }, []);

  const createManual = async () => {
    setCreating(true);
    try {
      await apiPost('/api/snapshots', { reason: 'manual' });
      toast.success('Snapshot created');
      reload();
    } catch (err: any) {
      toast.error('Snapshot failed', { detail: err.message });
    } finally {
      setCreating(false);
    }
  };

  const restore = async (s: Snapshot) => {
    const ok = await confirm({
      title: 'Restore this version?',
      message: (
        <>
          This replaces ALL current content with what was saved at{' '}
          <strong>{new Date(s.created_at).toLocaleString()}</strong>.
          Don't worry — a fresh snapshot of current state is taken first, so you
          can always undo. After restoring, click "Publish" on the dashboard to
          push the restored content live.
        </>
      ),
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiPost('/api/snapshots/restore', { snapshotId: s.id });
      toast.success('Restored', { detail: 'Hit "Publish" on the dashboard to push live.' });
      reload();
    } catch (err: any) {
      toast.error('Restore failed', { detail: err.message });
    }
  };

  if (!snapshots) {
    return (
      <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
        <IconSpinner size={24} /> <div className="text-muted mt-3">Loading versions…</div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
      <div className="alert alert-info">
        <IconHistory size={18} />
        <div>
          <div className="alert-title">How restore works</div>
          <div className="alert-body">
            Every time you publish, we capture a snapshot. Restoring swaps your
            content back to that point in time. The system takes a fresh
            snapshot first, so you can always undo the restore.
            Snapshots older than 90 days are pruned automatically (except the
            most recent 10 publishes, which we keep forever).
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Versions"
          eyebrow={`${snapshots.length} saved`}
          action={
            <Button
              onClick={createManual}
              loading={creating}
              leading={<IconSave size={14} />}
            >Take snapshot</Button>
          }
        />

        {snapshots.length === 0 ? (
          <EmptyState
            icon={<IconHistory size={24} />}
            title="No versions yet"
            body="Take your first snapshot to create a restore point."
            action={<Button onClick={createManual} loading={creating} leading={<IconSave size={14} />}>Take snapshot</Button>}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Reason</th>
                  <th>Size</th>
                  <th style={{ width: 180, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="text-sm">{new Date(s.created_at).toLocaleString()}</td>
                    <td>
                      <span className="badge badge-info">{humanizeReason(s.reason)}</span>
                    </td>
                    <td className="text-sm text-muted">{formatBytes(s.byte_size)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        leading={<IconDownload size={14} />}
                        onClick={() => restore(s)}
                      >Restore</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function humanizeReason(r: string): string {
  if (r === 'pre_publish') return 'Auto: before publish';
  if (r === 'manual') return 'Manual';
  if (r === 'pre_restore') return 'Auto: before restore';
  return r.replace(/_/g, ' ');
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Versions() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_snapshots">
        <VersionsInner />
      </AuthGuard>
    </AdminProviders>
  );
}
