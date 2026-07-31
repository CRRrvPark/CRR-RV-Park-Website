/**
 * CodeEditor — owner-only Monaco-based editor for the site's source files.
 *
 * Gated behind a "I understand the risk" toggle in the enclosing page.
 * Edits save as drafts via /api/code/drafts. Publishing a draft requires
 * a successful preview build (see /api/code/publish). Failed production
 * builds auto-rollback.
 */

import { useEffect, useRef, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost } from './api-client';
import { Button } from './ui/Button';
import { IconCode, IconSave, IconSparkle, IconAlert, IconSpinner } from './ui/Icon';

// Hardcoded file allowlist — scripts/infrastructure/DB are NOT editable here.
const EDITABLE_FILES = [
  'src/pages/index.astro',
  'src/pages/book-now.astro',
  'src/pages/amenities.astro',
  'src/pages/area-guide.astro',
  'src/pages/extended-stays.astro',
  'src/pages/golf-course.astro',
  'src/pages/golf-stays.astro',
  'src/pages/group-sites.astro',
  'src/pages/park-policies.astro',
  'src/pages/events.astro',
  'src/pages/privacy.astro',
  'src/pages/terms.astro',
  'src/components/Nav.astro',
  'src/components/Footer.astro',
  'src/components/HeadMeta.astro',
  'public/styles/global.css',
  'public/scripts/site.js',
  'netlify.toml',
];

interface Draft {
  id: string;
  file_path: string;
  draft_content: string;
  status: string;
  created_at: string;
  preview_url: string | null;
}

function CodeEditorInner() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<any>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const reloadDrafts = async () => {
    try {
      const res = await apiGet<{ drafts: Draft[] }>('/api/code/drafts');
      setDrafts(res.drafts);
      if (selectedFile) {
        const d = res.drafts.find((x) => x.file_path === selectedFile);
        setCurrentDraft(d ?? null);
      }
    } catch (err: any) {
      toast.error('Could not load drafts', { detail: err.message });
    }
  };

  useEffect(() => { reloadDrafts(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!selectedFile || !editorRef.current) return;
    let cancelled = false;

    (async () => {
      const monaco = await import('monaco-editor');
      if (cancelled) return;
      if (monacoRef.current) { monacoRef.current.dispose(); monacoRef.current = null; }

      const lang = selectedFile.endsWith('.css') ? 'css'
        : selectedFile.endsWith('.js') ? 'javascript'
        : selectedFile.endsWith('.ts') || selectedFile.endsWith('.tsx') ? 'typescript'
        : selectedFile.endsWith('.toml') ? 'ini'
        : selectedFile.endsWith('.json') ? 'json'
        : 'html';

      const existing = drafts.find((d) => d.file_path === selectedFile);
      const initialContent = existing?.draft_content ?? '// No draft yet. Edit below to create one.';

      const instance = monaco.editor.create(editorRef.current!, {
        value: initialContent,
        language: lang,
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 13,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
      });

      monacoRef.current = instance;
      setContent(initialContent);
      instance.onDidChangeModelContent(() => setContent(instance.getValue()));
    })();

    return () => {
      cancelled = true;
      if (monacoRef.current) { monacoRef.current.dispose(); monacoRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const save = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await apiPost('/api/code/drafts', { filePath: selectedFile, draftContent: content });
      toast.success('Draft saved');
      reloadDrafts();
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!currentDraft) { toast.warning('Save a draft first'); return; }
    const ok = await confirm({
      title: 'Publish code change?',
      message: (
        <>
          This will update the source of <code>{selectedFile}</code> on the live
          website. A preview build must succeed first. If the production build
          fails, the site will auto-rollback.
        </>
      ),
      confirmLabel: 'Publish code',
      danger: true,
    });
    if (!ok) return;
    setPublishing(true);
    try {
      await apiPost('/api/code/publish', { draftId: currentDraft.id, confirm: true });
      toast.success('Code published — rebuild in progress');
    } catch (err: any) {
      toast.error('Publish failed', { detail: err.message });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      gap: 'var(--sp-4)',
      height: 'calc(100vh - 240px)',
      minHeight: 480,
    }}>
      <aside style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-2)',
        overflow: 'auto',
      }}>
        <div className="card-eyebrow" style={{ padding: 'var(--sp-2)' }}>Editable Files</div>
        {EDITABLE_FILES.map((path) => {
          const hasDraft = drafts.some((d) => d.file_path === path);
          const isSelected = selectedFile === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => setSelectedFile(path)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--sp-2)',
                background: isSelected ? 'var(--c-rust-soft)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--c-text)',
                marginBottom: 2,
              }}
            >
              {hasDraft && <span style={{ color: 'var(--c-rust)' }}>● </span>}{path}
            </button>
          );
        })}
      </aside>

      <main style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {!selectedFile && (
          <div style={{ padding: 'var(--sp-12)', textAlign: 'center', color: 'var(--c-text-muted)' }}>
            <IconCode size={28} />
            <div className="mt-3">Select a file from the left to begin editing.</div>
          </div>
        )}
        {selectedFile && (
          <>
            <div style={{
              padding: 'var(--sp-3) var(--sp-4)',
              borderBottom: '1px solid var(--c-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 'var(--sp-3)', flexWrap: 'wrap',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedFile}
                {currentDraft && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Draft: {currentDraft.status}</span>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={saving}
                  onClick={save}
                  leading={<IconSave size={14} />}
                >Save draft</Button>
                <Button
                  size="sm"
                  loading={publishing}
                  disabled={!currentDraft || currentDraft.status !== 'preview_built'}
                  onClick={publish}
                  leading={<IconSparkle size={14} />}
                >Publish</Button>
              </div>
            </div>
            <div ref={editorRef} style={{ flex: 1, minHeight: 360 }} />
            {currentDraft && !currentDraft.status.startsWith('preview') && (
              <div className="alert alert-warning" style={{ borderRadius: 0, margin: 0 }}>
                <IconAlert size={16} />
                <div className="alert-body">
                  Before publishing, trigger a preview build. (Preview builds ship in Phase 3 completion.)
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export function CodeEditor() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_code">
        <CodeEditorInner />
      </AuthGuard>
    </AdminProviders>
  );
}
