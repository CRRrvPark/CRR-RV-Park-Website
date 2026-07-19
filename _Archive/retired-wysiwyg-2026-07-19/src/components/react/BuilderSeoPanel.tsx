/**
 * BuilderSeoPanel — collapsible side panel for page-level SEO metadata.
 *
 * Fields: Page Title, Meta Description (with character counter),
 * OG Image (using MediaPicker), Canonical URL.
 *
 * Saves via PATCH /api/pages/{id} with the SEO fields.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from './api-client';
import { MediaPickerModal } from './puck-components/fields/MediaPickerModal';
import { IconClose, IconSpinner, IconCheck } from './ui/Icon';
import { Button } from './ui/Button';

interface SeoData {
  title: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
}

interface Props {
  pageId: string;
  slug: string;
  initialTitle?: string;
  initialMetaDescription?: string | null;
  initialOgImage?: string | null;
  onClose: () => void;
}

export function BuilderSeoPanel({
  pageId,
  slug,
  initialTitle = '',
  initialMetaDescription = '',
  initialOgImage = '',
  onClose,
}: Props) {
  const [seo, setSeo] = useState<SeoData>({
    title: initialTitle,
    metaDescription: initialMetaDescription || '',
    ogImage: initialOgImage || '',
    canonicalUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const descLen = seo.metaDescription.length;
  const descColor =
    descLen === 0 ? 'var(--c-muted, #888)' :
    descLen <= 155 ? 'var(--c-success, #22c55e)' :
    'var(--c-warning, #f59e0b)';

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiPatch(`/api/pages/${pageId}`, {
        title: seo.title,
        meta_description: seo.metaDescription || null,
        og_image: seo.ogImage || null,
        canonical_url: seo.canonicalUrl || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [pageId, seo]);

  const update = (key: keyof SeoData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSeo((prev) => ({ ...prev, [key]: e.target.value }));
    setSaved(false);
  };

  return (
    <aside
      style={{
        width: 320,
        borderLeft: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        overflow: 'auto',
        padding: 'var(--sp-4)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="card-title" style={{ margin: 0 }}>SEO Settings</h3>
        <button className="icon-btn" onClick={onClose} title="Close SEO panel">
          <IconClose size={18} />
        </button>
      </div>

      {/* Page Title */}
      <div className="form-field">
        <label className="form-label">Page Title</label>
        <input
          type="text"
          className="input"
          value={seo.title}
          onChange={update('title')}
          placeholder="Page title for browser tab & search results"
        />
        <div className="form-hint">{seo.title.length}/60 recommended</div>
      </div>

      {/* Meta Description */}
      <div className="form-field">
        <label className="form-label">Meta Description</label>
        <textarea
          className="textarea"
          rows={3}
          value={seo.metaDescription}
          onChange={update('metaDescription')}
          placeholder="Describe this page for search engines..."
        />
        <div className="form-hint" style={{ color: descColor }}>
          {descLen}/155 recommended
        </div>
      </div>

      {/* OG Image */}
      <div className="form-field">
        <label className="form-label">OG Image (Social Preview)</label>
        {seo.ogImage ? (
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--r-md, 6px)',
              overflow: 'hidden',
              border: '1px solid var(--c-border)',
              marginBottom: '0.5rem',
            }}
          >
            <img
              src={seo.ogImage}
              alt="OG preview"
              style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
            />
            <button
              type="button"
              onClick={() => setSeo((s) => ({ ...s, ogImage: '' }))}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0,0,0,.6)',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &times;
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowMediaPicker(true)}
          style={{ width: '100%' }}
        >
          {seo.ogImage ? 'Change Image' : 'Choose OG Image'}
        </button>
      </div>

      {/* Canonical URL */}
      <div className="form-field">
        <label className="form-label">Canonical URL</label>
        <input
          type="url"
          className="input"
          value={seo.canonicalUrl}
          onChange={update('canonicalUrl')}
          placeholder={`https://crookedriverranchrvpark.com/${slug}`}
        />
        <div className="form-hint">Leave blank to use the page URL</div>
      </div>

      {/* Save */}
      {error && (
        <div style={{ color: 'var(--c-danger)', fontSize: 'var(--fs-sm)' }}>{error}</div>
      )}

      <Button onClick={handleSave} loading={saving} block>
        {saved ? (
          <><IconCheck size={14} /> Saved</>
        ) : (
          'Save SEO Settings'
        )}
      </Button>

      {/* Media picker modal */}
      <MediaPickerModal
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(url) => {
          setSeo((s) => ({ ...s, ogImage: url }));
          setSaved(false);
        }}
      />
    </aside>
  );
}
