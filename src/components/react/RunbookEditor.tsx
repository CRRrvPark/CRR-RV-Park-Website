/**
 * RunbookEditor — load/edit the runbook Markdown.
 *
 * Deliberately a plain textarea rather than Monaco — the runbook should stay
 * approachable for non-technical owners; a textarea is less intimidating.
 * Owner-only for edits. Anyone can view.
 */

import { useEffect, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { api, apiGet } from './api-client';
import { can } from '@lib/rbac';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { IconSpinner, IconEdit, IconDownload, IconBook, IconSave } from './ui/Icon';

function RunbookEditorInner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState('');

  useEffect(() => {
    apiGet<{ content: string; source: string }>('/api/runbook')
      .then((res) => { setContent(res.content); setDraft(res.content); setSource(res.source); })
      .catch((err) => toast.error('Could not load runbook', { detail: err.message }));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/runbook', { method: 'PATCH', body: { content: draft } });
      setContent(draft);
      setEditing(false);
      setSource('database');
      toast.success('Runbook saved');
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = can(user?.role, 'edit_runbook');

  if (content === null) {
    return (
      <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
        <IconSpinner size={24} /> <div className="text-muted mt-3">Loading runbook…</div>
      </Card>
    );
  }

  return (
    <div>
      <div className="alert alert-warning" style={{ marginBottom: 'var(--sp-4)' }}>
        <IconBook size={18} />
        <div>
          <div className="alert-title">Save this for the future</div>
          <div className="alert-body">
            This is the operations manual for the entire CRR RV Park website.
            If something breaks, if you need to onboard a new admin, or if a
            developer has to take over — start here. Print a copy annually and
            hand it to the HOA board.
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Runbook"
          eyebrow={`Source: ${sourceLabel(source)}`}
          action={
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <a
                href="/api/runbook/pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              ><IconDownload size={14} /> Print / PDF</a>
              {canEdit && !editing && (
                <Button size="sm" onClick={() => setEditing(true)} leading={<IconEdit size={14} />}>Edit</Button>
              )}
              {canEdit && editing && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => { setDraft(content); setEditing(false); }} disabled={saving}>Cancel</Button>
                  <Button size="sm" loading={saving} onClick={save} leading={<IconSave size={14} />}>Save</Button>
                </>
              )}
            </div>
          }
        />

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="textarea"
            style={{
              width: '100%',
              minHeight: '70vh',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-sm)',
              lineHeight: 1.6,
            }}
          />
        ) : (
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.65,
            color: 'var(--c-text)',
            margin: 0,
            background: 'var(--c-surface-alt)',
            padding: 'var(--sp-6)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--c-border)',
          }}>{content}</pre>
        )}
      </Card>
    </div>
  );
}

function sourceLabel(source: string): string {
  if (source === 'database') return 'Database (edited)';
  if (source === 'bundled') return 'Default (bundled)';
  return 'Empty';
}

export function RunbookEditor() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_runbook">
        <RunbookEditorInner />
      </AuthGuard>
    </AdminProviders>
  );
}
