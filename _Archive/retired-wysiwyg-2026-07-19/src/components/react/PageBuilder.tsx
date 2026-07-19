/**
 * PageBuilder — the visual drag-and-drop page editor.
 *
 * This is the main React island that wraps Puck's <Editor>. It handles:
 *   - Loading the current draft (or published data, or empty doc)
 *   - Auto-saving drafts with 2-second debounce
 *   - Manual checkpoints (named snapshots)
 *   - Publishing (writes to pages.page_builder_data + creates version)
 *   - Version history browser with instant restore
 *   - Keyboard shortcuts (Ctrl+S save, Ctrl+Shift+P publish)
 *   - Responsive preview toggle (desktop/tablet/mobile)
 *   - SEO metadata panel
 *   - Template save/load
 *   - Global style controls
 *   - Onboarding tour
 *   - Error boundaries on all section renders
 *
 * Mounted from /admin/builder/[slug].astro via client:only="react".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';

import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost } from './api-client';
import puckConfig from '@lib/puck-config.tsx';
import { Button } from './ui/Button';
import {
  IconSparkle, IconSave, IconHistory, IconExternal, IconSpinner,
  IconCheck, IconSettings, IconEye, IconHelp,
} from './ui/Icon';

// New panels
import { BuilderSeoPanel } from './BuilderSeoPanel';
import { SaveTemplateButton, TemplatePickerModal } from './BuilderTemplates';
import { BuilderStylePanel, DEFAULT_GLOBAL_STYLES, type GlobalStyles } from './BuilderStylePanel';
import { BuilderOnboarding, useOnboardingTour } from './BuilderOnboarding';

interface PageMeta {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  ogImage: string | null;
  usePageBuilder: boolean;
}

interface VersionEntry {
  id: string;
  reason: string;
  label: string | null;
  byte_size: number | null;
  created_at: string;
}

function PageBuilderInner({ slug }: { slug: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [page, setPage] = useState<PageMeta | null>(null);
  const [initialData, setInitialData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<Data | null>(null);

  // Panels
  const [showVersions, setShowVersions] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Global styles
  const [globalStyles, setGlobalStyles] = useState<GlobalStyles>({ ...DEFAULT_GLOBAL_STYLES });

  // Onboarding tour
  const { showTour, triggerTour, dismissTour } = useOnboardingTour();

  // Load initial data
  useEffect(() => {
    setLoading(true);
    apiGet<{ page: PageMeta; data: Data }>('/api/builder/draft', { slug })
      .then((res) => {
        setPage(res.page);
        setInitialData(res.data);
        latestDataRef.current = res.data;
        // Load global styles from root props if present
        const rootProps = (res.data as any)?.root?.props;
        if (rootProps?.globalStyles) {
          setGlobalStyles({ ...DEFAULT_GLOBAL_STYLES, ...rootProps.globalStyles });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // Auto-save with debounce
  const debouncedSave = useCallback(
    (data: Data) => {
      latestDataRef.current = data;
      setSaveStatus('idle');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        try {
          await apiPost('/api/builder/save', { slug, data, reason: 'auto' });
          setSaveStatus('saved');
          setLastSaved(new Date());
        } catch {
          setSaveStatus('error');
        }
      }, 2000);
    },
    [slug]
  );

  // Save on unload. BUG-4 in SECURITY-AND-BUGS-REPORT.md: cancel any
  // pending debounced save before sendBeacon, otherwise the debounce
  // timer fires after the page is detached and throws a silent
  // rejection in the background.
  useEffect(() => {
    const onUnload = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (latestDataRef.current) {
        navigator.sendBeacon(
          '/api/builder/save',
          JSON.stringify({ slug, data: latestDataRef.current, reason: 'auto' })
        );
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [slug]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (latestDataRef.current) {
          debouncedSave(latestDataRef.current);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        handlePublish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slug]);

  const handlePublish = async () => {
    const data = latestDataRef.current;
    if (!data) return;

    const ok = await confirm({
      title: 'Publish this page?',
      message: (
        <>
          This writes the current builder layout to the live site at <strong>/{slug === 'index' ? '' : slug}</strong>.
          A version snapshot is created automatically so you can roll back.
        </>
      ),
      confirmLabel: 'Publish now',
    });
    if (!ok) return;

    setPublishing(true);
    try {
      await apiPost('/api/builder/save', { slug, data, reason: 'publish' });
      toast.success('Published', { detail: `/${slug} is now using the visual editor layout.` });
      setSaveStatus('saved');
      setLastSaved(new Date());
    } catch (err: any) {
      toast.error('Publish failed', { detail: err.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveCheckpoint = async () => {
    const data = latestDataRef.current;
    if (!data) return;
    const label = window.prompt('Name this checkpoint (optional):');
    if (label === null) return; // cancelled
    try {
      await apiPost('/api/builder/save', { slug, data, reason: 'manual', label: label || undefined });
      toast.success('Checkpoint saved');
      if (showVersions) loadVersions();
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    }
  };

  const loadVersions = async () => {
    try {
      const res = await apiGet<{ versions: VersionEntry[] }>('/api/builder/versions', { slug });
      setVersions(res.versions);
    } catch {
      setVersions([]);
    }
  };

  const restoreVersion = async (versionId: string) => {
    const ok = await confirm({
      title: 'Restore this version?',
      message: 'The current draft will be replaced. A pre-restore snapshot is saved first so you can undo.',
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiPost<{ data: Data }>('/api/builder/restore', { slug, versionId });
      toast.success('Restored — reload the page to see changes.');
      // Reload the whole page to reinitialize Puck with new data
      window.location.reload();
    } catch (err: any) {
      toast.error('Restore failed', { detail: err.message });
    }
  };

  // Close other panels when opening one
  const openPanel = (panel: 'versions' | 'seo' | 'styles') => {
    setShowVersions(panel === 'versions' ? !showVersions : false);
    setShowSeo(panel === 'seo' ? !showSeo : false);
    setShowStyles(panel === 'styles' ? !showStyles : false);
    if (panel === 'versions' && !showVersions) loadVersions();
  };

  // Handle global style changes — embed into data root props
  const handleStyleChange = (newStyles: GlobalStyles) => {
    setGlobalStyles(newStyles);
    // Update the data's root props so it persists with saves
    if (latestDataRef.current) {
      const data = { ...latestDataRef.current };
      data.root = {
        ...data.root,
        props: {
          ...(data.root as any)?.props,
          globalStyles: newStyles,
        },
      };
      latestDataRef.current = data;
      debouncedSave(data);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 'var(--sp-3)' }}>
        <IconSpinner size={24} />
        <span className="text-muted">Loading visual editor...</span>
      </div>
    );
  }

  if (error || !initialData || !page) {
    return (
      <div className="alert alert-danger" style={{ maxWidth: 600, margin: 'var(--sp-8) auto' }}>
        <div>
          <div className="alert-title">Could not load the builder</div>
          <div className="alert-body">{error ?? 'Page not found.'}</div>
          <a href="/admin/editor" style={{ marginTop: 'var(--sp-3)', display: 'inline-block' }}>Back to pages</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-h))' }}>
      {/* Onboarding tour */}
      <BuilderOnboarding forceShow={showTour} onDismiss={dismissTour} />

      {/* Builder toolbar */}
      <div
        data-builder-toolbar
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          padding: 'var(--sp-2) var(--sp-4)',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
          flexWrap: 'wrap',
          zIndex: 30,
        }}
      >
        <a href="/admin/editor" className="text-sm text-muted" style={{ marginRight: 'var(--sp-2)' }}>
          &larr; Pages
        </a>
        <span style={{ fontWeight: 500 }}>/{slug}</span>

        <div style={{ flex: 1 }} />

        {/* Save status */}
        <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
          {saveStatus === 'saving' && <><IconSpinner size={12} /> Saving...</>}
          {saveStatus === 'saved' && <><IconCheck size={12} style={{ color: 'var(--c-success)' }} /> Saved {lastSaved ? formatTimeAgo(lastSaved) : ''}</>}
          {saveStatus === 'error' && <span style={{ color: 'var(--c-danger)' }}>Save failed</span>}
        </div>

        {/* Viewport toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--c-surface-muted)', borderRadius: 'var(--r-md)', padding: 2 }}>
          {(['desktop', 'tablet', 'mobile'] as const).map((vp) => (
            <button
              key={vp}
              type="button"
              onClick={() => setViewport(vp)}
              className={viewport === vp ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'}
              style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px' }}
              title={`${vp} preview`}
            >
              {vp === 'desktop' ? '\u{1F5A5}' : vp === 'tablet' ? '\u{1F4F1}' : '\u{1F4F1}'}
              <span className="hidden-mobile" style={{ marginLeft: 4 }}>
                {vp === 'desktop' ? 'Desktop' : vp === 'tablet' ? 'Tablet' : 'Mobile'}
              </span>
            </button>
          ))}
        </div>

        {/* Template save */}
        <SaveTemplateButton
          getData={() => latestDataRef.current}
          onSaved={() => toast.success('Template saved')}
        />

        {/* Template load */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowTemplates(true)}
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          Templates
        </button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleSaveCheckpoint}
          leading={<IconSave size={14} />}
        >
          Checkpoint
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openPanel('versions')}
          leading={<IconHistory size={14} />}
          data-builder-history-btn
        >
          History
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openPanel('seo')}
          leading={<IconSettings size={14} />}
        >
          SEO
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openPanel('styles')}
          leading={<IconEye size={14} />}
        >
          Styles
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => window.open(`/${slug === 'index' ? '' : slug}`, '_blank', 'noopener,noreferrer')}
          leading={<IconExternal size={14} />}
          title="Open the published page in a new tab"
        >
          Published
        </Button>
        <Button
          size="sm"
          loading={publishing}
          onClick={handlePublish}
          leading={<IconSparkle size={14} />}
        >
          Publish
        </Button>

        {/* Help / Tour */}
        <button
          type="button"
          className="icon-btn"
          onClick={triggerTour}
          title="Show guided tour"
          style={{ marginLeft: 'var(--sp-1)' }}
        >
          <IconHelp size={18} />
        </button>
      </div>

      {/* Main editor area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          <Puck
            config={puckConfig}
            data={initialData}
            onChange={debouncedSave}
            onPublish={async (data) => {
              latestDataRef.current = data;
              await handlePublish();
            }}
            viewports={[
              { width: 1280, height: 'auto', label: 'Desktop', icon: undefined },
              { width: 768, height: 'auto', label: 'Tablet', icon: undefined },
              { width: 375, height: 'auto', label: 'Mobile', icon: undefined },
            ]}
            iframe={{ enabled: true, waitForStyles: true }}
            overrides={{
              iframe: ({ children, document: iframeDoc }) => (
                <CanvasStyleInjector document={iframeDoc}>{children}</CanvasStyleInjector>
              ),
            }}
          />
        </div>

        {/* Version history panel */}
        {showVersions && (
          <aside style={{
            width: 320,
            borderLeft: '1px solid var(--c-border)',
            background: 'var(--c-surface)',
            overflow: 'auto',
            padding: 'var(--sp-4)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Version History</h3>
              <button className="icon-btn" onClick={() => setShowVersions(false)} title="Close">&times;</button>
            </div>

            {versions === null && (
              <div className="text-center text-muted" style={{ padding: 'var(--sp-6)' }}>
                <IconSpinner size={18} />
              </div>
            )}

            {versions && versions.length === 0 && (
              <div className="text-sm text-muted text-center" style={{ padding: 'var(--sp-6)' }}>
                No versions yet. Versions are created every time you publish or save a checkpoint.
              </div>
            )}

            {versions && versions.map((v) => (
              <div
                key={v.id}
                style={{
                  borderBottom: '1px solid var(--c-border)',
                  padding: 'var(--sp-3) 0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="text-sm" style={{ fontWeight: 500 }}>
                      {v.label || reasonLabel(v.reason)}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(v.created_at).toLocaleString()}
                      {v.byte_size ? ` | ${formatBytes(v.byte_size)}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${v.reason === 'publish' ? 'badge-success' : v.reason === 'pre_restore' ? 'badge-warning' : ''}`}>
                    {v.reason}
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--fs-xs)' }}
                  onClick={() => restoreVersion(v.id)}
                >
                  Restore this version
                </button>
              </div>
            ))}
          </aside>
        )}

        {/* SEO panel */}
        {showSeo && page && (
          <BuilderSeoPanel
            pageId={page.id}
            slug={page.slug}
            initialTitle={page.title}
            initialMetaDescription={page.metaDescription}
            initialOgImage={page.ogImage}
            onClose={() => setShowSeo(false)}
          />
        )}

        {/* Global style panel */}
        {showStyles && (
          <BuilderStylePanel
            styles={globalStyles}
            onChange={handleStyleChange}
            onClose={() => setShowStyles(false)}
          />
        )}
      </div>

      {/* Template picker modal */}
      <TemplatePickerModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={(data) => {
          // Replace the builder data with the template
          latestDataRef.current = data;
          setShowTemplates(false);
          toast.success('Template loaded — reloading builder...');
          // Save the template data as draft, then reload
          apiPost('/api/builder/save', { slug, data, reason: 'auto' })
            .then(() => window.location.reload())
            .catch(() => window.location.reload());
        }}
      />
    </div>
  );
}

function reasonLabel(reason: string): string {
  if (reason === 'publish') return 'Published version';
  if (reason === 'auto') return 'Auto-save snapshot';
  if (reason === 'manual') return 'Manual checkpoint';
  if (reason === 'pre_restore') return 'Before restore';
  if (reason === 'migration') return 'Migrated from legacy editor';
  return reason;
}

function formatTimeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Injects the public-site stylesheets into Puck's canvas iframe so the
 * editing surface renders with the real fonts, colors, and layout rules
 * from `public/styles/global.css`. Without this, the canvas shows
 * components stripped of their site context — the WYSIWYG promise breaks.
 *
 * Mirrors the <link> tags in src/components/HeadMeta.astro.
 */
const SITE_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap';

function CanvasStyleInjector({
  children,
  document: iframeDoc,
}: {
  children: React.ReactNode;
  document?: Document;
}) {
  useEffect(() => {
    if (!iframeDoc) return;
    const head = iframeDoc.head;
    if (!head) return;

    const fontLink = iframeDoc.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = SITE_FONT_HREF;
    head.appendChild(fontLink);

    const globalLink = iframeDoc.createElement('link');
    globalLink.rel = 'stylesheet';
    globalLink.href = '/styles/global.css';
    head.appendChild(globalLink);

    return () => {
      fontLink.remove();
      globalLink.remove();
    };
  }, [iframeDoc]);

  return <>{children}</>;
}

export function PageBuilder({ slug }: { slug: string }) {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="edit_content_draft">
        <PageBuilderInner slug={slug} />
      </AuthGuard>
    </AdminProviders>
  );
}
