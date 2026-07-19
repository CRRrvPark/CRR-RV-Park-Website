/**
 * LinkPicker — compact popover UI for choosing a link target.
 *
 * Two modes: a page from this site (dropdown populated from /api/pages)
 * or a custom URL. Supports an optional #anchor and open-in-new-tab.
 *
 * Kept framework-agnostic — doesn't know about Tiptap or Puck. The caller
 * passes current state and an `onApply(href, target)` callback.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../api-client';

interface PageRow {
  id: string;
  slug: string;
  title: string;
  is_published?: boolean;
  display_order?: number | null;
}

export interface LinkPickerProps {
  /** Current link href (full URL, or internal like `/about#intro`). Empty = no link. */
  initialHref?: string;
  /** Current target attribute. */
  initialTarget?: string;
  /** Apply a new link. */
  onApply: (href: string, target: string) => void;
  /** Remove the existing link entirely. */
  onRemove: () => void;
  /** Cancel and close without changes. */
  onCancel: () => void;
  /**
   * Hide the "Open in new tab" checkbox. Use for contexts that can't persist
   * a separate target attribute (e.g. Puck string fields where the renderer
   * auto-targets external URLs).
   */
  hideTarget?: boolean;
}

type Mode = 'page' | 'custom';

export function LinkPicker({ initialHref = '', initialTarget = '', onApply, onRemove, onCancel, hideTarget = false }: LinkPickerProps) {
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const parsed = useMemo(() => parseHref(initialHref), [initialHref]);
  const [mode, setMode] = useState<Mode>(parsed.kind);
  const [pageSlug, setPageSlug] = useState(parsed.kind === 'page' ? parsed.slug : 'index');
  const [anchor, setAnchor] = useState(parsed.kind === 'page' ? parsed.anchor : '');
  const [customUrl, setCustomUrl] = useState(parsed.kind === 'custom' ? parsed.url : '');
  const [newTab, setNewTab] = useState(initialTarget === '_blank');

  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    apiGet<{ pages: PageRow[] }>('/api/pages')
      .then((res) => setPages(res.pages ?? []))
      .catch((err) => setLoadError(err.message ?? 'Could not load pages'));
  }, []);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const canApply = mode === 'custom' ? customUrl.trim().length > 0 : Boolean(pageSlug);
  const showRemove = initialHref.length > 0;

  const handleApply = () => {
    if (!canApply) return;
    let href = '';
    if (mode === 'page') {
      const slugPath = pageSlug === 'index' ? '/' : `/${pageSlug}`;
      const cleanAnchor = anchor.trim().replace(/^#+/, '');
      href = cleanAnchor ? `${slugPath}#${cleanAnchor}` : slugPath;
    } else {
      href = customUrl.trim();
    }
    onApply(href, newTab ? '_blank' : '');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleApply(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div onKeyDown={onKey} style={{ minWidth: 300, fontSize: '.85rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Link target</div>

      <label style={rowStyle}>
        <input
          type="radio"
          name="linkmode"
          checked={mode === 'page'}
          onChange={() => setMode('page')}
        />
        <span>Page on this site</span>
      </label>
      {mode === 'page' && (
        <div style={{ marginLeft: 22, marginBottom: 8 }}>
          {pages === null && !loadError && <div style={{ color: '#888' }}>Loading pages…</div>}
          {loadError && <div style={{ color: '#c33' }}>{loadError}</div>}
          {pages !== null && (
            <>
              <select
                ref={(el) => { if (mode === 'page' && !firstInputRef.current) firstInputRef.current = el; }}
                value={pageSlug}
                onChange={(e) => setPageSlug(e.target.value)}
                style={selectStyle}
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.title} {p.slug === 'index' ? '(Home)' : `(/${p.slug})`}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 4 }}>
                <label style={{ display: 'block', color: '#666', fontSize: '.75rem', marginBottom: 2 }}>
                  Anchor (optional)
                </label>
                <input
                  type="text"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  placeholder="e.g. hero, amenities"
                  style={inputStyle}
                />
              </div>
            </>
          )}
        </div>
      )}

      <label style={rowStyle}>
        <input
          type="radio"
          name="linkmode"
          checked={mode === 'custom'}
          onChange={() => setMode('custom')}
        />
        <span>Custom URL</span>
      </label>
      {mode === 'custom' && (
        <div style={{ marginLeft: 22, marginBottom: 8 }}>
          <input
            ref={(el) => { if (mode === 'custom') firstInputRef.current = el; }}
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://example.com or mailto:you@…"
            style={inputStyle}
          />
        </div>
      )}

      {!hideTarget && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 12 }}>
          <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} />
          <span>Open in new tab</span>
        </label>
      )}
      {hideTarget && <div style={{ height: 6 }} />}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {showRemove && (
          <button type="button" onClick={onRemove} style={{ ...btnStyle, color: '#c33' }}>
            Remove
          </button>
        )}
        <button type="button" onClick={onCancel} style={btnStyle}>Cancel</button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          style={{ ...btnStyle, ...btnPrimary, opacity: canApply ? 1 : 0.5, cursor: canApply ? 'pointer' : 'not-allowed' }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

/** Heuristic: if href starts with `/`, treat as internal page. Otherwise custom. */
function parseHref(href: string):
  | { kind: 'page'; slug: string; anchor: string }
  | { kind: 'custom'; url: string } {
  if (!href) return { kind: 'page', slug: 'index', anchor: '' };
  if (href.startsWith('/') && !href.startsWith('//')) {
    const [path, hash = ''] = href.split('#');
    const trimmed = path.replace(/^\/+|\/+$/g, '');
    return { kind: 'page', slug: trimmed || 'index', anchor: hash };
  }
  return { kind: 'custom', url: href };
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 4,
  cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 7px',
  border: '1px solid #d8ccb7',
  borderRadius: 3,
  fontSize: '.85rem',
  background: '#fff',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};
const btnStyle: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid #d8ccb7',
  borderRadius: 3,
  background: '#fff',
  cursor: 'pointer',
  fontSize: '.8rem',
};
const btnPrimary: React.CSSProperties = {
  background: '#c4622d',
  border: '1px solid #c4622d',
  color: '#fff',
};
