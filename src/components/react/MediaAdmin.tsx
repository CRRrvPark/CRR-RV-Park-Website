/**
 * MediaAdmin — media library management.
 *
 * Displays every synced image in a thumbnail grid. Non-technical users
 * can drag & drop new files onto the upload zone; behind the scenes those
 * files are sent to the Zoho Drive folder (or, when offline, queued).
 *
 * Clicking a tile opens a detail drawer with edit + delete + variant URLs.
 */

import { useEffect, useMemo, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';
import { can } from '@lib/rbac';
import { useAuth } from './AuthContext';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TextInput, TextArea } from './ui/Field';
import { EmptyState } from './ui/EmptyState';
import { MediaUploader, type UploadedMedia } from './MediaUploader';
import {
  IconSearch, IconMedia, IconDownload, IconTrash,
  IconExternal, IconSpinner, IconCheck, IconAlert,
} from './ui/Icon';

interface Media {
  id: string;
  zoho_resource_id: string | null;
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
  last_synced_at: string | null;
  is_active: boolean;
}

interface SyncStatus {
  driveSync: { status: string; started_at: string; items_added: number; items_updated: number; error_message: string | null; error_class?: string | null } | null;
  driveLastSuccess: { started_at: string; items_added: number; items_updated: number } | null;
  connected: boolean;
  mediaFolderId: string | null;
}

const ERROR_CLASS_LABEL: Record<string, string> = {
  auth: 'Authentication failed — reconnect Zoho in Settings',
  timeout: 'Zoho timed out — usually transient, try again',
  rate_limit: 'Zoho rate-limited us — wait a few minutes and retry',
  config: 'Configuration problem — check ZOHO_WORKDRIVE_MEDIA_FOLDER_ID',
  validation: 'Some files were rejected — see details below',
  other: 'Sync failed — see details below',
};

interface PeekItem {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  extn: string;
  size: number;
  modifiedAt: string;
  isImage: boolean;
}

interface PeekResult {
  folderId: string;
  rawCount: number;
  imagesCount: number;
  foldersCount: number;
  fetchError: string | null;
  items: PeekItem[];
  mediaTableCount: number;
  hint?: string;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '11px', letterSpacing: '.04em', textTransform: 'uppercase' };
const td: React.CSSProperties = { padding: '6px 10px', verticalAlign: 'top' };

function MediaAdminInner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Media[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Media | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [peek, setPeek] = useState<PeekResult | null>(null);

  const peekWorkDrive = async () => {
    setPeeking(true);
    try {
      const res = await apiGet<PeekResult>('/api/zoho/workdrive-peek');
      setPeek(res);
    } catch (err: any) {
      toast.error('Peek failed', { detail: err.message });
    } finally {
      setPeeking(false);
    }
  };

  const load = async () => {
    try {
      const res = await apiGet<{ media: Media[] }>('/api/media', { q: query });
      setItems(res.media);
    } catch (err: any) {
      toast.error('Could not load media', { detail: err.message });
    }
  };
  const loadStatus = () => apiGet<SyncStatus>('/api/zoho/status').then(setSyncStatus).catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); loadStatus(); }, [query]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await apiPost<any>('/api/zoho/drive-sync');
      const total = res.total ?? 0;
      const added = res.added ?? 0;
      const updated = res.updated ?? 0;
      const skippedFolders = res.skippedFolders ?? 0;
      const skippedNotImage = res.skippedNotImage ?? 0;
      const detail = `Zoho returned ${total} item(s): +${added} added, ${updated} updated, ` +
        `${skippedFolders} folder(s), ${skippedNotImage} non-image(s)`;
      if (total > 0 && added === 0 && updated === 0 && skippedNotImage === total) {
        toast.warning('Sync ran but recognized nothing as images', {
          detail: `${total} file(s) came back from Zoho but none matched an image type/extension. ` +
            `Check the folder contents or see function logs for a response sample.`,
        });
      } else {
        toast.success('Sync finished', { detail });
      }
      load(); loadStatus();
    } catch (err: any) {
      toast.error('Sync failed', { detail: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const deleteItem = async (m: Media) => {
    const ok = await confirm({
      title: `Delete ${m.display_name ?? m.filename}?`,
      message: 'The image will be removed from the library. If it is still used on any page, deletion will be blocked until you replace those references.',
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/media/${m.id}`);
      toast.success('Deleted');
      setSelected(null);
      load();
    } catch (err: any) {
      if (err.status === 409) toast.warning(err.message);
      else toast.error('Delete failed', { detail: err.message });
    }
  };

  const saveEdits = async (id: string, patch: Partial<Media>) => {
    try {
      await apiPatch(`/api/media/${id}`, patch);
      toast.success('Saved');
      load();
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    }
  };

  const canEdit = can(user?.role, 'upload_media');
  const canDelete = can(user?.role, 'delete_media');

  const count = items?.length ?? 0;

  return (
    <div>
      {/* Status strip */}
      <Card tight style={{
        marginBottom: 'var(--sp-4)',
        background: syncStatus?.connected ? 'var(--c-success-soft)' : 'var(--c-warning-soft)',
        borderColor: syncStatus?.connected ? '#B8DFC6' : '#EBD59A',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {syncStatus?.connected ? (
              <><IconCheck size={14} style={{ color: 'var(--c-success)' }} />
              <span className="text-sm">
                <strong>Zoho Drive connected.</strong>{' '}
                {syncStatus.driveSync
                  ? (
                    <>
                      Last sync {new Date(syncStatus.driveSync.started_at).toLocaleString()}
                      {syncStatus.driveSync.status === 'failed' && (
                        <>{' '}&mdash; <span style={{ color: 'var(--c-danger)' }}>failed</span></>
                      )}.
                      {syncStatus.driveSync.status === 'failed' && syncStatus.driveLastSuccess && (
                        <>{' '}<span className="text-muted">Last success {new Date(syncStatus.driveLastSuccess.started_at).toLocaleString()}.</span></>
                      )}
                      {syncStatus.driveSync.status === 'failed' && syncStatus.driveSync.error_class && (
                        <>{' '}<span style={{ color: 'var(--c-warning)' }}>{ERROR_CLASS_LABEL[syncStatus.driveSync.error_class] ?? ERROR_CLASS_LABEL.other}</span></>
                      )}
                    </>
                  )
                  : <>No sync runs yet.</>}
              </span></>
            ) : (
              <><IconAlert size={14} style={{ color: 'var(--c-warning)' }} />
              <span className="text-sm">
                <strong>Zoho not connected.</strong>{' '}
                <a href="/admin/settings">Connect in Settings →</a>
              </span></>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                loading={peeking}
                disabled={!syncStatus?.connected}
                onClick={peekWorkDrive}
                title="Ask Zoho what's in the folder right now, without syncing"
              >Peek</Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                loading={syncing}
                disabled={!syncStatus?.connected}
                onClick={syncNow}
                leading={<IconDownload size={14} />}
              >Sync now</Button>
            )}
          </div>
        </div>
      </Card>

      {/* WorkDrive peek results — visible when diagnostic button has been pressed */}
      {peek && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>WorkDrive folder diagnostic</div>
              <div className="text-xs text-muted">
                Folder <code>{peek.folderId}</code> — {peek.rawCount} item{peek.rawCount === 1 ? '' : 's'} returned, {peek.imagesCount} classified as image{peek.imagesCount === 1 ? '' : 's'}, {peek.foldersCount} folder{peek.foldersCount === 1 ? '' : 's'}. <code>media</code> table holds {peek.mediaTableCount} row{peek.mediaTableCount === 1 ? '' : 's'}.
              </div>
            </div>
            <button className="icon-btn" onClick={() => setPeek(null)} title="Dismiss">&times;</button>
          </div>

          {peek.hint && (
            <div className="alert" style={{ background: 'var(--c-info-soft)', borderColor: 'var(--c-info)', marginBottom: 'var(--sp-3)' }}>
              <IconAlert size={16} />
              <div><div className="alert-body">{peek.hint}</div></div>
            </div>
          )}
          {peek.fetchError && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--sp-3)' }}>
              <IconAlert size={16} />
              <div><div className="alert-title">Zoho API error</div><div className="alert-body">{peek.fetchError}</div></div>
            </div>
          )}

          {peek.items && peek.items.length > 0 && (
            <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)' }}>
              <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--c-surface-muted)' }}>
                  <tr>
                    <th style={th}>Name</th>
                    <th style={th}>type</th>
                    <th style={th}>mime_type</th>
                    <th style={th}>extn</th>
                    <th style={th}>isImage?</th>
                  </tr>
                </thead>
                <tbody>
                  {peek.items.map((it) => (
                    <tr key={it.id} style={{ borderTop: '1px solid var(--c-border)' }}>
                      <td style={td}>{it.name}</td>
                      <td style={td}><code>{it.type || '—'}</code></td>
                      <td style={td}><code>{it.mimeType || '—'}</code></td>
                      <td style={td}><code>{it.extn || '—'}</code></td>
                      <td style={{ ...td, color: it.isImage ? 'var(--c-success)' : 'var(--c-danger)' }}>
                        {it.isImage ? 'yes' : 'no'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <IconSearch size={16} style={searchIconStyle} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by filename or name…"
            className="input"
            style={{ paddingLeft: '2.4rem' }}
          />
        </div>
        <span className="text-sm text-muted">{count} image{count === 1 ? '' : 's'}</span>
      </div>

      {canEdit && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <div style={{ fontWeight: 600 }}>Upload new photos</div>
            <div className="text-xs text-muted">
              Files land in the library immediately — no sync required.
              {syncStatus?.connected && (
                <> Zoho WorkDrive sync still works as a backup for batch uploads from your phone or drive.</>
              )}
            </div>
          </div>
          <MediaUploader
            onUploaded={(m: UploadedMedia) => {
              toast.success(`Uploaded ${m.display_name ?? m.filename}`);
              load();
            }}
          />
        </Card>
      )}

      {items === null && (
        <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
          <IconSpinner size={24} /> <div className="text-muted mt-3">Loading media…</div>
        </Card>
      )}
      {items && items.length === 0 && (
        <Card>
          <EmptyState
            icon={<IconMedia size={24} />}
            title={query ? 'No matches' : 'No photos yet'}
            body={
              query
                ? 'Try a different search term.'
                : canEdit
                  ? 'Drop photos into the uploader above — they\'ll appear here once processing finishes.'
                  : 'Ask an editor or owner to upload photos.'
            }
            action={syncStatus?.connected && canEdit ? (
              <Button loading={syncing} onClick={syncNow} leading={<IconDownload size={16} />}>Or sync from Zoho</Button>
            ) : null}
          />
        </Card>
      )}

      {items && items.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 'var(--sp-3)',
        }}>
          {items.map((m) => (
            <MediaTile key={m.id} media={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}

      {selected && (
        <MediaDetail
          media={selected}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setSelected(null)}
          onSave={(patch) => saveEdits(selected.id, patch)}
          onDelete={() => deleteItem(selected)}
        />
      )}
    </div>
  );
}

function MediaTile({ media, onClick }: { media: Media; onClick: () => void }) {
  const src = media.public_url_mobile_webp ?? media.public_url_jpg ?? '';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        padding: 6,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 4,
        transition: 'border-color 140ms, box-shadow 140ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--c-rust)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4/3',
        overflow: 'hidden',
        borderRadius: 'var(--r-sm)',
        background: 'var(--c-surface-muted)',
      }}>
        {src ? (
          <img
            src={src}
            alt={media.alt_text ?? media.filename}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--c-text-dim)' }}>
            <IconMedia size={24} />
          </div>
        )}
      </div>
      <div className="truncate text-sm" style={{ fontWeight: 500 }}>
        {media.display_name ?? media.filename}
      </div>
      <div className="text-xs text-muted">
        {media.width && media.height ? `${media.width}×${media.height}` : 'size unknown'} · {fmtBytes(media.byte_size)}
      </div>
    </button>
  );
}

function MediaDetail({ media, canEdit, canDelete, onClose, onSave, onDelete }: {
  media: Media;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Media>) => void;
  onDelete: () => void;
}) {
  const [alt, setAlt] = useState(media.alt_text ?? '');
  const [caption, setCaption] = useState(media.caption ?? '');
  const [displayName, setDisplayName] = useState(media.display_name ?? media.filename);

  return (
    <Modal
      open
      onClose={onClose}
      title={media.display_name ?? media.filename}
      size="lg"
      footer={
        <>
          {canDelete && (
            <Button variant="danger" leading={<IconTrash size={14} />} onClick={onDelete}>Delete</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canEdit && (
            <Button onClick={() => onSave({ alt_text: alt, caption, display_name: displayName })}>Save changes</Button>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 1fr)', gap: 'var(--sp-4)' }}>
        <div style={{ background: 'var(--c-surface-muted)', padding: 'var(--sp-3)', borderRadius: 'var(--r-md)' }}>
          {(media.public_url_jpg || media.public_url_webp) ? (
            <img
              src={media.public_url_jpg ?? media.public_url_webp ?? ''}
              alt={media.alt_text ?? ''}
              style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-sm)', display: 'block' }}
            />
          ) : (
            <div className="text-muted" style={{ textAlign: 'center', padding: 'var(--sp-10)' }}>
              No preview available
            </div>
          )}
        </div>
        <div>
          {canEdit ? (
            <>
              <TextInput label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <TextInput
                label="Alt text"
                hint="Describes the image for screen readers & SEO. Required for accessibility."
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
              <TextArea label="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              <Detail label="Alt text" value={media.alt_text ?? '—'} />
              <Detail label="Caption" value={media.caption ?? '—'} />
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
            <div className="card-eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>File details</div>
            <div className="text-sm" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px var(--sp-3)' }}>
              <span className="text-muted">Filename</span><span>{media.filename}</span>
              <span className="text-muted">Dimensions</span><span>{media.width ?? '?'}×{media.height ?? '?'}</span>
              <span className="text-muted">Size</span><span>{fmtBytes(media.byte_size)}</span>
              <span className="text-muted">MIME</span><span>{media.mime_type}</span>
              {media.last_synced_at && (
                <>
                  <span className="text-muted">Last synced</span>
                  <span>{new Date(media.last_synced_at).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: 'var(--sp-3)' }}>
            <div className="card-eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>Copy a URL</div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {media.public_url_jpg && <UrlPill url={media.public_url_jpg} label="JPG" />}
              {media.public_url_webp && <UrlPill url={media.public_url_webp} label="WebP" />}
              {media.public_url_mobile_webp && <UrlPill url={media.public_url_mobile_webp} label="Mobile" />}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function UrlPill({ url, label }: { url: string; label: string }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(`${label} URL copied`);
        } catch {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      {label}
      <IconExternal size={12} />
    </button>
  );
}

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--c-text-muted)',
  pointerEvents: 'none',
};

function fmtBytes(b: number): string {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaAdmin() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_media">
        <MediaAdminInner />
      </AuthGuard>
    </AdminProviders>
  );
}
