/**
 * MediaPickerModal — a modal overlay showing the media library grid.
 *
 * Fetches from GET /api/media, displays thumbnails in a grid, and lets
 * the user search by filename. Clicking a thumbnail calls onSelect with
 * the public URL (prefers WebP, falls back to JPG).
 */

import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@components/react/api-client';
import { MediaUploader, type UploadedMedia } from '@components/react/MediaUploader';

interface MediaItem {
  id: string;
  filename: string;
  display_name: string | null;
  alt_text: string | null;
  public_url_jpg: string | null;
  public_url_webp: string | null;
  public_url_mobile_webp: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, item: MediaItem) => void;
}

export function MediaPickerModal({ open, onClose, onSelect }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    apiGet<{ media: MediaItem[] }>('/api/media')
      .then((res) => setMedia(res.media ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return media;
    const q = search.toLowerCase();
    return media.filter(
      (m) =>
        m.filename?.toLowerCase().includes(q) ||
        m.display_name?.toLowerCase().includes(q) ||
        m.alt_text?.toLowerCase().includes(q),
    );
  }, [media, search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (item: MediaItem) => {
    const url = item.public_url_webp || item.public_url_jpg || '';
    onSelect(url, item);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Media Library"
    >
      <div className="modal" style={{ maxWidth: 860, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Media Library</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Search bar + upload */}
        <div style={{ padding: '0 var(--sp-4, 1rem)', paddingBottom: 'var(--sp-3, 0.75rem)', display: 'flex', gap: 'var(--sp-2, 0.5rem)', alignItems: 'center' }}>
          <input
            type="search"
            className="input"
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{ flex: 1 }}
          />
          <MediaUploader
            variant="button"
            buttonLabel="Upload new"
            onUploaded={(m: UploadedMedia) => {
              const url = m.public_url_webp || m.public_url_jpg || '';
              if (!url) return;
              onSelect(url, m as any);
              onClose();
            }}
          />
        </div>

        {/* Grid */}
        <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: '0 var(--sp-4, 1rem) var(--sp-4, 1rem)' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--c-muted, #888)' }}>
              Loading media...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--c-danger, #dc2626)' }}>
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--c-muted, #888)' }}>
              {search ? 'No media matching your search.' : 'No media uploaded yet.'}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 'var(--sp-3, 0.75rem)',
              }}
            >
              {filtered.map((item) => {
                const thumb = item.public_url_mobile_webp || item.public_url_webp || item.public_url_jpg || '';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid var(--c-border, #e5e5e5)',
                      borderRadius: 'var(--r-md, 6px)',
                      overflow: 'hidden',
                      background: 'var(--c-surface, #fff)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      padding: 0,
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-accent, #c4622d)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px rgba(196,98,45,.15)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border, #e5e5e5)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '4/3',
                        background: '#f5f0e6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.alt_text || item.display_name || item.filename}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: 28, opacity: 0.3 }}>&#128444;</span>
                      )}
                    </div>
                    <div
                      style={{
                        padding: '0.35rem 0.5rem',
                        fontSize: 'var(--fs-xs, 0.75rem)',
                        color: 'var(--c-text, #333)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.display_name || item.filename}
                    </div>
                    {item.width && item.height && (
                      <div
                        style={{
                          padding: '0 0.5rem 0.35rem',
                          fontSize: '0.65rem',
                          color: 'var(--c-muted, #888)',
                        }}
                      >
                        {item.width}&times;{item.height}
                        {item.byte_size ? ` | ${formatSize(item.byte_size)}` : ''}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
