/**
 * PagesAdmin — lists every page on the site and lets editors create,
 * publish/unpublish, delete, and edit settings.
 *
 * Non-technical readers: "draft" means not on the live site yet. "Published"
 * means it's live. The home page can never be unpublished.
 */

import { useEffect, useMemo, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';
import { can } from '@lib/rbac';
import { Button } from './ui/Button';
import { Card, CardHeader } from './ui/Card';
import { Modal } from './ui/Modal';
import { TextInput, TextArea, Field } from './ui/Field';
import { EmptyState } from './ui/EmptyState';
import {
  IconPlus, IconEdit, IconTrash, IconEye, IconEyeOff, IconExternal,
  IconPages, IconLock, IconSearch, IconGlobe, IconSpinner, IconSparkle,
} from './ui/Icon';

interface Page {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  og_image: string | null;
  hero_preload: string | null;
  canonical_url: string | null;
  is_draft: boolean;
  is_protected: boolean;
  show_in_main_nav: boolean;
  nav_order: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

function PagesAdminInner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [pages, setPages] = useState<Page[] | null>(null);
  const [editing, setEditing] = useState<Page | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const load = () =>
    apiGet<{ pages: Page[] }>('/api/pages')
      .then((r) => setPages(r.pages))
      .catch((err) => toast.error('Could not load pages', { detail: err.message }));

  useEffect(() => { load(); }, []);

  const togglePublish = async (p: Page) => {
    if (p.slug === 'index' && !p.is_draft) {
      toast.warning('The home page can\'t be unpublished — it must always be live.');
      return;
    }
    try {
      await apiPatch(`/api/pages/${p.id}`, { is_draft: !p.is_draft });
      toast.success(p.is_draft ? 'Page published' : 'Moved to drafts');
      load();
    } catch (err: any) {
      toast.error('Could not change publish state', { detail: err.message });
    }
  };

  const removePage = async (p: Page) => {
    if (p.is_protected) {
      toast.warning(`"${p.title}" is a protected page and can't be deleted.`);
      return;
    }
    const ok = await confirm({
      title: `Delete "${p.title}"?`,
      message: (
        <>
          The page at <code>/{p.slug}</code> will be permanently removed, along
          with all its sections and content. This can only be undone by
          restoring a snapshot.
        </>
      ),
      danger: true,
      confirmLabel: 'Delete page',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/pages/${p.id}`);
      toast.success('Page deleted');
      load();
    } catch (err: any) {
      toast.error('Delete failed', { detail: err.message });
    }
  };

  const canEdit = can(user?.role, 'edit_content_direct');
  const canDelete = user?.role === 'owner';

  const filtered = useMemo(() => {
    if (!pages) return null;
    const q = query.trim().toLowerCase();
    return pages.filter((p) => {
      if (filter === 'published' && p.is_draft) return false;
      if (filter === 'draft' && !p.is_draft) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
  }, [pages, query, filter]);

  if (pages === null) {
    return (
      <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
        <IconSpinner size={24} />
        <div className="text-muted mt-3">Loading pages…</div>
      </Card>
    );
  }

  const counts = {
    all: pages.length,
    published: pages.filter((p) => !p.is_draft).length,
    draft: pages.filter((p) => p.is_draft).length,
  };

  return (
    <div>
      {/* Visual Editor banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #c4622d 0%, #a0481f 100%)',
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
              Click any page below to open it in the Visual Editor
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', opacity: 0.92, marginTop: 2 }}>
              Drag sections to reorder, resize and reposition images, add new sections from the
              left palette — all visually, no forms.
            </div>
          </div>
        </div>
        <a
          href="/admin/builder/index"
          className="btn btn-sm"
          style={{
            background: '#fff',
            color: '#c4622d',
            textDecoration: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <IconSparkle size={14} /> Open Home in Builder
        </a>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <IconSearch
            size={16}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-muted)', pointerEvents: 'none' }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or URL…"
            className="input"
            style={{ paddingLeft: '2.4rem' }}
          />
        </div>
        <div role="tablist" className="tabs" style={{ margin: 0, border: 'none' }}>
          {(['all', 'published', 'draft'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              onClick={() => setFilter(k)}
              className={`tab ${filter === k ? 'active' : ''}`}
              style={{ paddingTop: 'var(--sp-2)', paddingBottom: 'var(--sp-2)' }}
            >
              {k === 'all' ? 'All' : k === 'published' ? 'Published' : 'Drafts'}
              <span className="badge" style={{ marginLeft: 8 }}>{counts[k]}</span>
            </button>
          ))}
        </div>
        {canEdit && (
          <Button leading={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New page
          </Button>
        )}
      </div>

      {/* List */}
      {filtered && filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={<IconPages size={24} />}
            title={query ? 'No pages match your search' : 'No pages yet'}
            body={
              query
                ? <>Try a different search term or clear the filter.</>
                : <>Create your first page to start building out the site.</>
            }
            action={canEdit && !query ? (
              <Button leading={<IconPlus size={16} />} onClick={() => setCreating(true)}>Create a page</Button>
            ) : null}
          />
        </Card>
      )}

      {filtered && filtered.length > 0 && (
        <Card tight>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map((p, i) => (
              <PageRow
                key={p.id}
                page={p}
                onEdit={() => setEditing(p)}
                onTogglePublish={() => togglePublish(p)}
                onDelete={() => removePage(p)}
                canEdit={canEdit}
                canDelete={canDelete}
                first={i === 0}
              />
            ))}
          </ul>
        </Card>
      )}

      {(creating || editing) && (
        <PageDialog
          page={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function PageRow({
  page, onEdit, onTogglePublish, onDelete, canEdit, canDelete, first,
}: {
  page: Page;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
  first: boolean;
}) {
  return (
    <li style={{
      borderTop: first ? 'none' : '1px solid var(--c-border)',
      padding: 'var(--sp-4)',
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      flexWrap: 'wrap',
    }}>
      <a
        href={`/admin/builder/${page.slug}`}
        style={{ flex: 1, color: 'inherit', minWidth: 200 }}
        title="Open in visual editor (drag, drop, resize)"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, fontSize: 'var(--fs-lg)', fontFamily: 'var(--font-serif)' }}>
            {page.title}
          </span>
          {page.is_draft ? (
            <span className="badge badge-draft"><span className="badge-dot" /> Draft</span>
          ) : (
            <span className="badge badge-success"><span className="badge-dot" /> Live</span>
          )}
          {page.is_protected && (
            <span className="badge" title="Core page — cannot be deleted"><IconLock size={10} /> protected</span>
          )}
          {page.show_in_main_nav && (
            <span className="badge badge-info"><IconGlobe size={10} /> in nav</span>
          )}
        </div>
        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
          /{page.slug} · updated {new Date(page.updated_at).toLocaleDateString()}
          {page.meta_description && <> · {truncate(page.meta_description, 80)}</>}
        </div>
      </a>

      <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
        {!page.is_draft && (
          <a
            href={`/${page.slug === 'index' ? '' : page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn"
            title="View on live site"
          ><IconExternal size={15} /></a>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onTogglePublish}
            className="icon-btn"
            title={page.is_draft ? 'Publish this page' : 'Move to draft'}
          >
            {page.is_draft ? <IconEye size={15} /> : <IconEyeOff size={15} />}
          </button>
        )}
        {canEdit && (
          <button type="button" onClick={onEdit} className="icon-btn" title="Page settings">
            <IconEdit size={15} />
          </button>
        )}
        <a
          href={`/admin/builder/${page.slug}`}
          className="btn btn-primary btn-sm"
          title="Open visual editor — drag, drop, resize images, rearrange sections"
        ><IconSparkle size={12} /> Edit</a>
        <a
          href={`/admin/editor/${page.slug}`}
          className="btn btn-ghost btn-sm"
          title="Advanced: edit page fields directly (legacy)"
        >Fields</a>
        {canDelete && !page.is_protected && (
          <button
            type="button"
            onClick={onDelete}
            className="icon-btn is-danger"
            title="Delete page"
          ><IconTrash size={15} /></button>
        )}
      </div>
    </li>
  );
}

function PageDialog({ page, onClose, onSaved }: {
  page: Page | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = page === null;
  const { toast } = useToast();
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [title, setTitle] = useState(page?.title ?? '');
  const [meta, setMeta] = useState(page?.meta_description ?? '');
  const [ogImage, setOgImage] = useState(page?.og_image ?? '');
  const [heroPreload, setHeroPreload] = useState(page?.hero_preload ?? '');
  const [showInNav, setShowInNav] = useState(page?.show_in_main_nav ?? false);
  const [navOrder, setNavOrder] = useState<string>(page?.nav_order != null ? String(page.nav_order) : '');
  const [saving, setSaving] = useState(false);

  const slugize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  const submit = async () => {
    if (!title.trim()) { toast.warning('Title is required'); return; }
    if (isCreate && !slug.trim()) { toast.warning('URL is required'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        meta_description: meta || null,
        og_image: ogImage || null,
        hero_preload: heroPreload || null,
        show_in_main_nav: showInNav,
        nav_order: navOrder ? Number(navOrder) : null,
      };
      if (isCreate) {
        await apiPost('/api/pages', { ...payload, slug });
        toast.success(`New page created as draft`, { detail: `Visit it at /${slug}` });
      } else {
        await apiPatch(`/api/pages/${page!.id}`, payload);
        toast.success('Page settings saved');
      }
      onSaved();
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={isCreate ? 'Create new page' : 'Page settings'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button loading={saving} onClick={submit}>
            {isCreate ? 'Create page' : 'Save settings'}
          </Button>
        </>
      }
    >
      <TextInput
        label="Title"
        required
        hint="Shown in browser tabs and search results."
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (isCreate && !slug) setSlug(slugize(e.target.value));
        }}
      />

      {isCreate ? (
        <TextInput
          label="URL"
          required
          hint={<>Lowercase letters, numbers, and hyphens. Full URL: <code>/{slug || '…'}</code></>}
          value={slug}
          onChange={(e) => setSlug(slugize(e.target.value))}
          placeholder="my-new-page"
          maxLength={60}
        />
      ) : (
        <Field label="URL" hint="Slug can't change after creation.">
          <div className="input" style={{ background: 'var(--c-surface-muted)', color: 'var(--c-text-muted)' }}>
            /{slug}
          </div>
        </Field>
      )}

      <TextArea
        label="Meta description"
        hint="Shown in search engine results. Aim for ~155 characters."
        value={meta ?? ''}
        onChange={(e) => setMeta(e.target.value)}
        maxLength={300}
      />

      <TextInput
        label="Social share image"
        hint="URL to an image shown when this page is shared on social media."
        value={ogImage ?? ''}
        onChange={(e) => setOgImage(e.target.value)}
        placeholder="https://www.crookedriverranchrv.com/images/hero.jpg"
      />

      <TextInput
        label="Hero image preload"
        hint="For performance — the first image visitors see. Use a .webp path."
        value={heroPreload ?? ''}
        onChange={(e) => setHeroPreload(e.target.value)}
        placeholder="/images/hero.webp"
      />

      <Field label="Navigation">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showInNav}
            onChange={(e) => setShowInNav(e.target.checked)}
          />
          <span>Show in main site navigation</span>
        </label>
      </Field>

      {showInNav && (
        <TextInput
          label="Nav order"
          hint="Lower numbers appear first. Leave blank to go at the end."
          type="number"
          value={navOrder}
          onChange={(e) => setNavOrder(e.target.value)}
          placeholder="50"
        />
      )}

      {isCreate && (
        <div className="alert alert-info" style={{ marginTop: 'var(--sp-4)' }}>
          <div>
            <div className="alert-title">Your new page starts as a draft</div>
            <div className="alert-body">
              After creating, you'll add sections and content. When ready, click
              the <IconEye size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> toggle
              or use the big "Publish" button on the dashboard.
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

export function PagesAdmin() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_content">
        <PagesAdminInner />
      </AuthGuard>
    </AdminProviders>
  );
}
