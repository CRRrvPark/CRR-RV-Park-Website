/**
 * EditableImage — image block with Media Library picker.
 *
 * Clicking the image opens a modal with the current media library (synced
 * from Zoho Drive). Picking replaces the image URL, width, height, alt.
 */

import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '../api-client';
import { useToast } from '../Toast';
import { Spinner } from '../Spinner';

interface MediaItem {
  id: string;
  filename: string;
  display_name?: string;
  alt_text?: string;
  public_url_jpg?: string;
  public_url_webp?: string;
  public_url_mobile_webp?: string;
  width?: number;
  height?: number;
}

interface Props {
  blockId: string;
  currentUrl: string | null;
  currentAlt: string | null;
  currentWidth: number | null;
  currentHeight: number | null;
  label?: string;
  onSaved?: (next: { url: string; alt: string; width: number; height: number }) => void;
}

export function EditableImage({ blockId, currentUrl, currentAlt, label, onSaved }: Props) {
  const [picking, setPicking] = useState(false);
  const [library, setLibrary] = useState<MediaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!picking) return;
    setLoading(true);
    apiGet<{ media: MediaItem[] }>('/api/media', { q: query })
      .then((res) => setLibrary(res.media))
      .catch((err) => toast.error('Could not load media library', { detail: err.message }))
      .finally(() => setLoading(false));
  }, [picking, query]);

  const pick = async (item: MediaItem) => {
    const url = item.public_url_jpg ?? item.public_url_webp ?? '';
    // SECURITY: defense in depth — reject dangerous URL schemes before sending
    // to the server. Server also validates.
    if (url && !(url.startsWith('/') || /^https?:\/\//i.test(url))) {
      toast.error('Invalid image URL — only relative paths or https URLs allowed');
      return;
    }
    setSaving(true);
    try {
      await apiPatch('/api/content/blocks', {
        blockId,
        value_image_url: url,
        value_image_alt: item.alt_text ?? item.display_name ?? item.filename,
        value_image_width: item.width,
        value_image_height: item.height,
      });
      onSaved?.({
        url,
        alt: item.alt_text ?? item.display_name ?? item.filename,
        width: item.width ?? 0,
        height: item.height ?? 0,
      });
      setPicking(false);
      toast.success(label ? `Image updated: ${label}` : 'Image updated');
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setPicking(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') setPicking(true); }}
        style={{
          position: 'relative',
          cursor: 'pointer',
          display: 'inline-block',
          border: '2px dashed transparent',
          borderRadius: 3,
          transition: 'border-color 120ms',
          opacity: saving ? 0.5 : 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#C4622D')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={currentAlt ?? ''}
            style={{ display: 'block', maxWidth: '100%' }}
          />
        ) : (
          <div style={{
            padding: '2rem',
            background: '#f4f0e8',
            color: '#665040',
            textAlign: 'center',
            minWidth: 200,
          }}>
            Click to add an image
          </div>
        )}
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(30,16,8,0.85)',
          color: 'white',
          fontSize: '.7rem',
          padding: '2px 6px',
          borderRadius: 2,
          pointerEvents: 'none',
        }}>Click to change</div>
      </div>

      {picking && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setPicking(false); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            zIndex: 9998,
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: 6,
            padding: '1.5rem',
            maxWidth: 900,
            width: '100%',
            maxHeight: '85vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>Media Library</h2>
              <button type="button" onClick={() => setPicking(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <input
              type="text"
              placeholder="Search by filename…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: '100%', padding: '.6rem', border: '1px solid #d4cdbe', borderRadius: 3, marginBottom: '1rem' }}
            />
            {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner /></div>}
            {!loading && library && library.length === 0 && (
              <p style={{ color: '#665040', textAlign: 'center', padding: '2rem' }}>
                No images yet. Add images to your Zoho WorkDrive folder; they'll sync within 15 minutes.
              </p>
            )}
            {!loading && library && library.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))',
                gap: '.8rem',
              }}>
                {library.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pick(item)}
                    style={{
                      background: 'transparent',
                      border: '2px solid transparent',
                      borderRadius: 4,
                      padding: 4,
                      cursor: 'pointer',
                      transition: 'border-color 120ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#C4622D')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                  >
                    <img
                      src={item.public_url_mobile_webp ?? item.public_url_jpg ?? ''}
                      alt={item.alt_text ?? item.filename}
                      style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 3, display: 'block' }}
                    />
                    <div style={{ fontSize: '.75rem', marginTop: 4, color: '#3a2820', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.display_name ?? item.filename}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
