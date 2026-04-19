/**
 * PageEditor — loads a page's sections + content blocks from Supabase and
 * renders the appropriate editor per block.
 *
 * The rendered form is a flat sidecar editor: every editable field for the
 * page grouped by section. Features:
 *   - Sticky action bar with Preview + Publish buttons
 *   - Drag-free reordering via up/down icons (works on touch)
 *   - Per-section visibility toggle, delete, and add-below
 *   - "+ Add section" dropzones between every section
 */

import { useEffect, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';
import { EditableText } from './editors/EditableText';
import { EditableRichText } from './editors/EditableRichText';
import { EditableImage } from './editors/EditableImage';
import { EditableJson } from './editors/EditableJson';
import { SectionTypePicker } from './SectionTypePicker';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import {
  IconArrowUp, IconArrowDown, IconEye, IconEyeOff, IconTrash,
  IconPlus, IconExternal, IconSparkle, IconSpinner, IconPages, IconGrip,
} from './ui/Icon';

interface ContentBlock {
  id: string;
  section_id: string;
  key: string;
  display_name: string;
  block_type: 'plain_text' | 'rich_text' | 'image' | 'image_pair' | 'json' | 'number' | 'boolean' | 'url';
  display_order: number;
  value_text?: string | null;
  value_html?: string | null;
  value_json?: unknown;
  value_number?: number | null;
  value_boolean?: boolean | null;
  value_image_url?: string | null;
  value_image_alt?: string | null;
  value_image_width?: number | null;
  value_image_height?: number | null;
  notes?: string | null;
}

interface Section {
  id: string;
  key: string;
  type: string;
  display_name: string;
  display_order: number;
  is_visible: boolean;
  content_blocks: ContentBlock[];
}

function PageEditorInner({ slug }: { slug: string }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInsertAfter, setPickerInsertAfter] = useState<string | null>(null);
  const [sectionBusy, setSectionBusy] = useState(false);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const loadSections = () => {
    return apiGet<{ blocks: any[] }>('/api/content/blocks', { page: slug })
      .then((res) => setSections(groupBySection(res.blocks)))
      .catch((err) => toast.error('Could not load page content', { detail: err.message }));
  };

  useEffect(() => {
    setLoading(true);
    loadSections().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const openPicker = (afterSectionId: string | null) => {
    setPickerInsertAfter(afterSectionId);
    setPickerOpen(true);
  };

  const addSection = async (type: string) => {
    setSectionBusy(true);
    try {
      await apiPost('/api/sections', { pageSlug: slug, type, afterSectionId: pickerInsertAfter });
      toast.success('Section added');
      setPickerOpen(false);
      await loadSections();
    } catch (err: any) {
      toast.error('Could not add section', { detail: err.message });
    } finally {
      setSectionBusy(false);
    }
  };

  const deleteSection = async (s: Section) => {
    const ok = await confirm({
      title: `Delete the "${s.display_name}" section?`,
      message: (
        <>
          All content in this section will be permanently removed. Don't worry —
          a snapshot is automatically taken before every publish, so you can
          still restore this from the <a href="/admin/versions">Versions</a> tab.
        </>
      ),
      danger: true,
      confirmLabel: 'Delete section',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/sections/${s.id}`);
      toast.success('Section deleted');
      await loadSections();
    } catch (err: any) {
      toast.error('Delete failed', { detail: err.message });
    }
  };

  const moveSection = async (idx: number, dir: -1 | 1) => {
    if (!sections) return;
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setSections(reordered);
    try {
      await apiPost('/api/sections/reorder', {
        pageSlug: slug,
        orderedSectionIds: reordered.map((s) => s.id),
      });
    } catch (err: any) {
      toast.error('Reorder failed', { detail: err.message });
      await loadSections();
    }
  };

  const toggleVisibility = async (s: Section) => {
    try {
      await apiPatch(`/api/sections/${s.id}`, { is_visible: !s.is_visible });
      await loadSections();
    } catch (err: any) {
      toast.error('Could not toggle visibility', { detail: err.message });
    }
  };

  const publish = async () => {
    const ok = await confirm({
      title: 'Publish to live site?',
      message: 'This pushes every unpublished change to crookedriverranchrv.com. Updates appear within 1–2 minutes.',
      confirmLabel: 'Publish now',
    });
    if (!ok) return;
    setPublishing(true);
    try {
      const res = await apiPost<{ publishId: string }>('/api/publish');
      toast.success('Publish started', { detail: `Running in the background. ID: ${res.publishId.slice(0, 8)}…` });
    } catch (err: any) {
      toast.error('Publish failed', { detail: err.message });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
        <IconSpinner size={24} />
        <div className="text-muted mt-3">Loading page content…</div>
      </Card>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconPages size={24} />}
          title="This page has no sections yet"
          body={<>Add your first section below to start building out <code>/{slug}</code>.</>}
          action={<Button leading={<IconPlus size={16} />} onClick={() => openPicker(null)}>Add a section</Button>}
        />
        <SectionTypePicker open={pickerOpen} busy={sectionBusy} onClose={() => setPickerOpen(false)} onPick={addSection} />
      </Card>
    );
  }

  const totalFields = sections.reduce((n, s) => n + s.content_blocks.length, 0);

  return (
    <div>
      {/* Prominent banner pointing to the visual editor */}
      <div
        role="region"
        aria-label="Visual editor available"
        style={{
          background: 'linear-gradient(135deg, var(--c-brand, #c4622d) 0%, #a0481f 100%)',
          color: '#fff',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4) var(--sp-5)',
          marginBottom: 'var(--sp-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--sp-3)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flex: 1, minWidth: 260 }}>
          <IconSparkle size={22} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', lineHeight: 1.2 }}>
              Looking for the drag-and-drop visual editor?
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', opacity: 0.92, marginTop: 2 }}>
              You're in the field-based editor. Switch to the visual editor to drag sections,
              move images left/right of text, resize, and rearrange live.
            </div>
          </div>
        </div>
        <a
          href={`/admin/builder/${slug}`}
          className="btn btn-sm"
          style={{
            background: '#fff',
            color: 'var(--c-brand, #c4622d)',
            textDecoration: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <IconSparkle size={14} /> Open Visual Editor
        </a>
      </div>

      {/* Sticky action bar */}
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-3) var(--sp-4)',
        marginBottom: 'var(--sp-6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 'var(--sp-3)',
        position: 'sticky', top: 'calc(var(--topbar-h) + var(--sp-2))',
        zIndex: 20, boxShadow: 'var(--shadow-sm)',
      }}>
        <div className="text-sm">
          <a href="/admin/editor" className="text-muted">← All pages</a>
          <div style={{ marginTop: 4 }}>
            Editing <strong>/{slug}</strong>
            <span className="text-muted"> · {sections.length} section{sections.length === 1 ? '' : 's'} · {totalFields} field{totalFields === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(`/${slug === 'index' ? '' : slug}`, '_blank', 'noopener,noreferrer')}
            leading={<IconExternal size={14} />}
          >Preview</Button>
          <Button
            size="sm"
            loading={publishing}
            onClick={publish}
            leading={<IconSparkle size={14} />}
          >Publish</Button>
        </div>
      </div>

      <AddSectionDropzone onClick={() => openPicker(null)} label="Add section at top" />

      {sections.map((sec, idx) => (
        <div key={sec.id}>
          <Card style={{
            marginBottom: 'var(--sp-2)',
            opacity: sec.is_visible ? 1 : 0.6,
            borderStyle: sec.is_visible ? 'solid' : 'dashed',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--c-border)',
              paddingBottom: 'var(--sp-3)', marginBottom: 'var(--sp-4)',
              flexWrap: 'wrap', gap: 'var(--sp-3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div
                  style={{
                    color: 'var(--c-text-muted)',
                    cursor: 'grab',
                  }}
                  title="Drag to reorder (use buttons on right for now)"
                >
                  <IconGrip size={16} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>{sec.display_name}</h3>
                    {!sec.is_visible && <span className="badge badge-draft">Hidden</span>}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    {sec.type} · {sec.content_blocks.length} field{sec.content_blocks.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={idx === 0}
                  onClick={() => moveSection(idx, -1)}
                  title="Move up"
                ><IconArrowUp size={14} /></button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={idx === sections.length - 1}
                  onClick={() => moveSection(idx, 1)}
                  title="Move down"
                ><IconArrowDown size={14} /></button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => toggleVisibility(sec)}
                  title={sec.is_visible ? 'Hide from live site' : 'Show on live site'}
                >
                  {sec.is_visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
                </button>
                <button
                  type="button"
                  className="icon-btn is-danger"
                  onClick={() => deleteSection(sec)}
                  title="Delete section"
                ><IconTrash size={14} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
              {sec.content_blocks
                .slice()
                .sort((a, b) => a.display_order - b.display_order)
                .map((block) => (
                  <BlockEditorCard key={block.id} block={block} />
                ))}
            </div>
          </Card>

          <AddSectionDropzone onClick={() => openPicker(sec.id)} label="Add section below" subtle />
        </div>
      ))}

      <SectionTypePicker
        open={pickerOpen}
        busy={sectionBusy}
        onClose={() => setPickerOpen(false)}
        onPick={addSection}
      />
    </div>
  );
}

function BlockEditorCard({ block }: { block: ContentBlock }) {
  return (
    <div>
      <label className="form-label" style={{ marginBottom: 'var(--sp-2)' }}>
        {block.display_name}
        {block.notes && (
          <span className="text-xs text-muted" style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 8, fontWeight: 400 }}>
            — {block.notes}
          </span>
        )}
      </label>
      {renderBlockEditor(block)}
    </div>
  );
}

function AddSectionDropzone({ onClick, label, subtle }: { onClick: () => void; label: string; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        background: 'transparent',
        border: subtle ? '1px dashed var(--c-border-strong)' : '2px dashed var(--c-border-strong)',
        borderRadius: 'var(--r-md)',
        padding: subtle ? 'var(--sp-2)' : 'var(--sp-3)',
        marginBottom: 'var(--sp-3)',
        cursor: 'pointer',
        color: 'var(--c-text-muted)',
        fontSize: 'var(--fs-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)',
        transition: 'border-color 140ms ease, color 140ms ease, background 140ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--c-rust)';
        e.currentTarget.style.color = 'var(--c-rust)';
        e.currentTarget.style.background = 'var(--c-rust-soft)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--c-border-strong)';
        e.currentTarget.style.color = 'var(--c-text-muted)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <IconPlus size={14} /> {label}
    </button>
  );
}

function renderBlockEditor(block: ContentBlock) {
  switch (block.block_type) {
    case 'plain_text':
    case 'url':
    case 'number':
      return (
        <EditableText
          blockId={block.id}
          value={block.value_text ?? block.value_number?.toString() ?? null}
          label={block.display_name}
        />
      );
    case 'rich_text':
      return (
        <EditableRichText
          blockId={block.id}
          value={block.value_html ?? block.value_text ?? null}
          label={block.display_name}
        />
      );
    case 'image':
    case 'image_pair':
      return (
        <EditableImage
          blockId={block.id}
          currentUrl={block.value_image_url ?? null}
          currentAlt={block.value_image_alt ?? null}
          currentWidth={block.value_image_width ?? null}
          currentHeight={block.value_image_height ?? null}
          label={block.display_name}
        />
      );
    case 'json':
      return (
        <EditableJson
          blockId={block.id}
          value={block.value_json}
          label={block.display_name}
        />
      );
    case 'boolean':
      return (
        <label className="checkbox-row">
          <input type="checkbox" defaultChecked={block.value_boolean ?? false} />
          <span>{block.display_name}</span>
        </label>
      );
    default:
      return <em className="text-muted">Unsupported block type: {block.block_type}</em>;
  }
}

function groupBySection(blocks: any[]): Section[] {
  const map = new Map<string, Section>();
  for (const b of blocks) {
    const s = b.sections;
    if (!s) continue;
    if (!map.has(s.id)) {
      map.set(s.id, {
        id: s.id,
        key: s.key,
        type: s.type ?? 'two_col',
        display_name: s.display_name,
        display_order: s.display_order,
        is_visible: s.is_visible !== false,
        content_blocks: [],
      });
    }
    if (b.__empty_section) continue;
    map.get(s.id)!.content_blocks.push(b);
  }
  return Array.from(map.values()).sort((a, b) => a.display_order - b.display_order);
}

export function PageEditor({ slug }: { slug: string }) {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="edit_content_draft">
        <PageEditorInner slug={slug} />
      </AuthGuard>
    </AdminProviders>
  );
}
