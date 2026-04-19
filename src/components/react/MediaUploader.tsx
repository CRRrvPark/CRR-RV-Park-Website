/**
 * MediaUploader — drag/drop + file-picker UI that POSTs to /api/media/upload.
 *
 * Two visual variants:
 *   - "zone"   — full-width drop target used in `/admin/media`
 *   - "button" — compact "Upload new" button used in MediaPickerModal
 *
 * Uses XMLHttpRequest for per-file upload progress (the Fetch API doesn't
 * expose upload progress events). The Supabase JWT is attached as a
 * Bearer token to match the rest of /api/*.
 */

import { useRef, useState, useCallback } from 'react';
import { browserClient } from '@lib/supabase';

export interface UploadedMedia {
  id: string;
  filename: string;
  display_name: string | null;
  alt_text: string | null;
  caption: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  public_url_jpg: string | null;
  public_url_webp: string | null;
  public_url_mobile_webp: string | null;
}

interface Props {
  onUploaded: (media: UploadedMedia) => void;
  variant?: 'zone' | 'button';
  /** Accept attribute for the hidden input. Defaults to any image. */
  accept?: string;
  /** If true, clicking a single file auto-closes the parent modal after upload. */
  singleShot?: boolean;
  /** Optional label override for the button variant. */
  buttonLabel?: string;
}

type ItemStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: ItemStatus;
  error?: string;
  xhr?: XMLHttpRequest;
}

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/heic';
const MAX_BYTES = 10 * 1024 * 1024;

export function MediaUploader({
  onUploaded,
  variant = 'zone',
  accept = DEFAULT_ACCEPT,
  singleShot = false,
  buttonLabel = 'Upload new',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragDepth, setDragDepth] = useState(0);

  const openPicker = () => inputRef.current?.click();

  const startUpload = useCallback(async (file: File, itemId: string) => {
    let token: string | undefined;
    try {
      const { data } = await browserClient().auth.getSession();
      token = data.session?.access_token;
    } catch {
      // proceed — endpoint will return 401 and we'll surface it
    }

    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, xhr, status: 'uploading' } : it));

    xhr.open('POST', '/api/media/upload');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, progress: pct } : it));
    };

    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON; leave null */ }

      if (xhr.status >= 200 && xhr.status < 300 && body?.media) {
        setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, status: 'done', progress: 100 } : it));
        onUploaded(body.media as UploadedMedia);
      } else {
        const msg = body?.error || `Upload failed (HTTP ${xhr.status})`;
        setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, status: 'error', error: msg } : it));
      }
    };

    xhr.onerror = () => {
      setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, status: 'error', error: 'Network error — could not reach the server.' } : it));
    };
    xhr.onabort = () => {
      setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, status: 'cancelled' } : it));
    };

    xhr.send(form);
  }, [onUploaded]);

  const enqueue = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const next: UploadItem[] = [];
    const rejected: string[] = [];

    for (const f of files) {
      if (f.size > MAX_BYTES) {
        rejected.push(`${f.name} — too large (${fmtBytes(f.size)}, max ${fmtBytes(MAX_BYTES)})`);
        continue;
      }
      if (f.type && !accept.split(',').map(s => s.trim()).includes(f.type)) {
        rejected.push(`${f.name} — ${f.type || 'unknown type'} not allowed`);
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        progress: 0,
        status: 'queued',
      });
    }

    if (rejected.length) {
      // Surface rejections as phantom items so the UI shows the reason.
      for (const r of rejected) {
        next.unshift({
          id: `r-${Math.random().toString(36).slice(2, 8)}`,
          file: new File([], r.split(' — ')[0]),
          progress: 0,
          status: 'error',
          error: r.split(' — ')[1] ?? 'rejected',
        });
      }
    }

    if (next.length === 0) return;
    setItems((prev) => [...prev, ...next]);
    for (const it of next) {
      if (it.status === 'queued') startUpload(it.file, it.id);
    }
  }, [accept, startUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth(0);
    if (e.dataTransfer?.files?.length) enqueue(e.dataTransfer.files);
  }, [enqueue]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); setDragDepth((d) => d + 1); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragDepth((d) => Math.max(0, d - 1)); };

  const clearDone = () => setItems((prev) => prev.filter((it) => it.status !== 'done' && it.status !== 'cancelled'));
  const cancel = (id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      it?.xhr?.abort();
      return prev;
    });
  };

  const dropping = dragDepth > 0;

  if (variant === 'button') {
    return (
      <>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openPicker}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span aria-hidden>＋</span> {buttonLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={!singleShot}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) enqueue(e.target.files);
            e.target.value = '';
          }}
        />
        {items.length > 0 && (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <UploadList items={items} onCancel={cancel} onClearDone={clearDone} />
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <div
        onClick={openPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker(); }}
        style={{
          border: `2px dashed ${dropping ? 'var(--c-rust, #c4622d)' : 'var(--c-border, #e5e5e5)'}`,
          borderRadius: 'var(--r-md, 8px)',
          padding: 'var(--sp-6, 1.5rem)',
          background: dropping ? 'rgba(196, 98, 45, 0.06)' : 'var(--c-surface-muted, #fafafa)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 140ms, background 140ms',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Drag photos here or <span style={{ color: 'var(--c-rust, #c4622d)', textDecoration: 'underline' }}>click to browse</span>
        </div>
        <div className="text-xs text-muted">
          JPG, PNG, WebP, GIF, AVIF, HEIC &middot; up to {fmtBytes(MAX_BYTES)} each &middot; variants generated automatically
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) enqueue(e.target.files);
          e.target.value = '';
        }}
      />
      {items.length > 0 && (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <UploadList items={items} onCancel={cancel} onClearDone={clearDone} />
        </div>
      )}
    </div>
  );
}

function UploadList({ items, onCancel, onClearDone }: {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onClearDone: () => void;
}) {
  const hasDone = items.some((it) => it.status === 'done' || it.status === 'cancelled');
  return (
    <div style={{ border: '1px solid var(--c-border, #e5e5e5)', borderRadius: 'var(--r-sm, 4px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--c-surface-muted, #fafafa)', fontSize: 'var(--fs-xs, 0.75rem)' }}>
        <span>{items.length} file{items.length === 1 ? '' : 's'}</span>
        {hasDone && (
          <button type="button" className="btn-link" onClick={onClearDone} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--c-text-muted, #666)', cursor: 'pointer', fontSize: 'inherit' }}>
            Clear finished
          </button>
        )}
      </div>
      {items.map((it) => (
        <UploadRow key={it.id} item={it} onCancel={() => onCancel(it.id)} />
      ))}
    </div>
  );
}

function UploadRow({ item, onCancel }: { item: UploadItem; onCancel: () => void }) {
  const color = item.status === 'error' ? 'var(--c-danger, #dc2626)'
    : item.status === 'done' ? 'var(--c-success, #2b8a3e)'
    : 'var(--c-text, #333)';
  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--c-border, #e5e5e5)', fontSize: 'var(--fs-xs, 0.75rem)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color }}>{item.file.name}</span>
          {item.status === 'uploading' && <span className="text-muted"> — {item.progress}%</span>}
          {item.status === 'done' && <span style={{ color }}> — done</span>}
          {item.status === 'error' && <span style={{ color }}> — {item.error}</span>}
          {item.status === 'cancelled' && <span className="text-muted"> — cancelled</span>}
        </div>
        {item.status === 'uploading' && (
          <button type="button" onClick={onCancel} className="btn-link" style={{ background: 'none', border: 'none', color: 'var(--c-text-muted, #666)', cursor: 'pointer', fontSize: 'inherit' }}>
            Cancel
          </button>
        )}
      </div>
      {(item.status === 'uploading' || item.status === 'queued') && (
        <div style={{ marginTop: 4, height: 3, background: 'var(--c-surface-muted, #eee)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${item.progress}%`, background: 'var(--c-rust, #c4622d)', transition: 'width 120ms linear' }} />
        </div>
      )}
    </div>
  );
}

function fmtBytes(b: number): string {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
