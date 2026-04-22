/**
 * ParkMapEditor — staff UI for placing a rectangle polygon on every RV site.
 *
 * Workflow:
 *   1. Paste (or type) the URL of the base map image + natural dimensions.
 *      Clicking "Save base image" upserts the active park_maps row.
 *      (Use /admin/media to upload the image first, then copy its URL.)
 *   2. Pick a site from the zone-grouped dropdown (or the "unplaced"
 *      chips at the bottom).
 *   3. Click "Start placing polygon" → click the first corner on the
 *      map → click the opposite corner → the rectangle saves via PATCH
 *      on /api/area-guide/park-sites/[id].
 *   4. Existing polygons render server-side style (read-through on load)
 *      as SVG polygons. Click one to select; "Replace" or "Delete" act
 *      on the selection.
 *
 * Rectangle-only for v1 (matches RPMS's shipped editor). Arbitrary
 * polygon support can come later without data-model changes — polygons
 * already accept N points.
 *
 * Coordinates are stored 0-1 normalised so the same polygon data works
 * across any replacement image (as long as aspect ratio matches).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useToast } from './Toast';
import { apiGet, apiPatch, api } from './api-client';
import { Button } from './ui/Button';
import { TextInput } from './ui/Field';
import { Card } from './ui/Card';
import { IconCheck, IconTrash, IconAlert, IconPlus, IconClose } from './ui/Icon';

type Status =
  | 'available' | 'camp_host' | 'staff_only'
  | 'maintenance' | 'reserved' | 'seasonal_closed';

interface ParkMap {
  id: string;
  slug: string;
  title: string;
  image_url: string;
  natural_width: number;
  natural_height: number;
  is_active: boolean;
}

interface Site {
  id: string;
  site_number: string;
  loop: string;
  site_type: string | null;
  status: Status;
  map_polygon: Array<[number, number]> | null;
}

type Point = [number, number];
type Mode = 'idle' | 'placing';

const SVG_SCALE = 1000;

export function ParkMapEditor() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="manage_area_guide">
        <Inner />
      </AuthGuard>
    </AdminProviders>
  );
}

function Inner() {
  const { toast } = useToast();

  // ---- state ----
  const [parkMap, setParkMap] = useState<ParkMap | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCode, setActiveCode] = useState<string>('');
  const [mode, setMode] = useState<Mode>('idle');
  const [inProgress, setInProgress] = useState<Point[]>([]);   // first click only; second click commits
  const [cursor, setCursor] = useState<Point>([0, 0]);

  // base-image config form (URL + dimensions)
  const [cfgImageUrl, setCfgImageUrl] = useState('');
  const [cfgWidth, setCfgWidth] = useState('');
  const [cfgHeight, setCfgHeight] = useState('');
  const [cfgSaving, setCfgSaving] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);

  // ---- load ----
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, siteRes] = await Promise.all([
        apiGet<{ parkMap: ParkMap | null }>('/api/park-map'),
        apiGet<{ sites: Site[] }>('/api/area-guide/park-sites'),
      ]);
      setParkMap(mapRes.parkMap);
      setSites(siteRes.sites);
      if (mapRes.parkMap) {
        setCfgImageUrl(mapRes.parkMap.image_url);
        setCfgWidth(String(mapRes.parkMap.natural_width));
        setCfgHeight(String(mapRes.parkMap.natural_height));
      }
    } catch (err: any) {
      toast.error('Load failed', { detail: err?.message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSite = useMemo(
    () => sites.find((s) => s.site_number === activeCode) ?? null,
    [sites, activeCode],
  );

  const byLoop = useMemo(() => {
    const m: Record<string, Site[]> = {};
    sites.forEach((s) => { (m[s.loop] ??= []).push(s); });
    for (const list of Object.values(m)) list.sort((a, b) => a.site_number.localeCompare(b.site_number));
    return m;
  }, [sites]);

  const placedCount = sites.filter((s) => Array.isArray(s.map_polygon) && s.map_polygon.length > 0).length;
  const unplacedSites = sites.filter((s) => !Array.isArray(s.map_polygon) || s.map_polygon.length === 0);

  // ---- base-image config: save ----
  const saveConfig = async () => {
    const w = Number(cfgWidth), h = Number(cfgHeight);
    if (!cfgImageUrl.trim()) { toast.error('Image URL is required'); return; }
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) { toast.error('Width + height must be positive numbers'); return; }
    setCfgSaving(true);
    try {
      const res = await api<{ parkMap: ParkMap }>('/api/park-map', {
        method: 'PUT',
        body: { image_url: cfgImageUrl.trim(), natural_width: w, natural_height: h },
      });
      setParkMap(res.parkMap);
      toast.success('Base map saved');
    } catch (err: any) { toast.error('Save failed', { detail: err?.message }); }
    finally { setCfgSaving(false); }
  };

  // ---- polygon placement ----
  const cancelPlacement = useCallback(() => {
    setMode('idle');
    setInProgress([]);
  }, []);

  const beginPlace = () => {
    if (!activeCode) { toast.error('Pick a site first'); return; }
    setMode('placing');
    setInProgress([]);
  };

  const savePolygon = async (poly: Point[]) => {
    if (!activeSite) return;
    try {
      await apiPatch(`/api/area-guide/park-sites/${activeSite.id}`, { map_polygon: poly });
      toast.success(`Saved ${activeSite.site_number}`);
      setMode('idle');
      setInProgress([]);
      // Refresh this site's map_polygon locally rather than re-fetching everything.
      setSites((prev) => prev.map((s) => s.id === activeSite.id ? { ...s, map_polygon: poly } : s));
    } catch (err: any) { toast.error('Save polygon failed', { detail: err?.message }); }
  };

  const deleteActive = async () => {
    if (!activeSite) return;
    if (!confirm(`Remove the polygon for ${activeSite.site_number}?`)) return;
    try {
      await apiPatch(`/api/area-guide/park-sites/${activeSite.id}`, { map_polygon: null });
      toast.success(`Cleared ${activeSite.site_number}`);
      setSites((prev) => prev.map((s) => s.id === activeSite.id ? { ...s, map_polygon: null } : s));
    } catch (err: any) { toast.error('Delete failed', { detail: err?.message }); }
  };

  // Escape cancels placement (global listener).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelPlacement(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelPlacement]);

  // ---- stage mouse handling ----
  const stageCoords = (e: React.MouseEvent<HTMLDivElement>): Point => {
    const el = stageRef.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return [x, y];
  };

  const onStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'placing') return;
    setCursor(stageCoords(e));
  };

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'placing') return;
    const pt = stageCoords(e);
    if (inProgress.length === 0) {
      setInProgress([pt]);
    } else {
      // Finalize — axis-aligned rectangle using the two corners.
      const [a] = inProgress;
      const x0 = Math.min(a[0], pt[0]);
      const x1 = Math.max(a[0], pt[0]);
      const y0 = Math.min(a[1], pt[1]);
      const y1 = Math.max(a[1], pt[1]);
      const poly: Point[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      savePolygon(poly);
    }
  };

  // ---- rendering ----

  if (loading) return <div>Loading…</div>;

  const hasImage = Boolean(parkMap);

  return (
    <div>
      {/* ---- Base image config ---- */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Card>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 400 }}>Base map image</h3>
              {parkMap && (
                <span style={{ fontSize: '.8rem', color: parkMap.is_active ? '#4A7C59' : 'var(--c-text-muted)' }}>
                  {parkMap.is_active ? '✓ Active' : 'Inactive'}
                </span>
              )}
            </div>
            <p style={{ fontSize: '.85rem', color: 'var(--c-text-muted)', margin: '0 0 .75rem', lineHeight: 1.55 }}>
              Upload the image at <a href="/admin/media" target="_blank" style={{ color: 'var(--c-rust, #C4622D)' }}>/admin/media</a>,
              copy its URL, then paste below. Natural width/height are the image's raw pixel dimensions — needed
              so the editor can convert your clicks into 0-1 normalised coordinates.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '.6rem', alignItems: 'end' }}>
              <TextInput label="Image URL" value={cfgImageUrl} onChange={(e) => setCfgImageUrl(e.target.value)} placeholder="https://...supabase.co/storage/v1/... or /images/..." />
              <TextInput label="Natural width (px)" type="number" value={cfgWidth} onChange={(e) => setCfgWidth(e.target.value)} />
              <TextInput label="Natural height (px)" type="number" value={cfgHeight} onChange={(e) => setCfgHeight(e.target.value)} />
              <Button onClick={saveConfig} loading={cfgSaving} leading={<IconCheck size={14} />}>
                {parkMap ? 'Update' : 'Save base image'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {!hasImage && (
        <div style={{ padding: '2rem', background: 'var(--c-surface-alt)', border: '1px dashed var(--c-border)', borderRadius: 4, textAlign: 'center', color: 'var(--c-text-muted)' }}>
          Save a base map image above to start placing polygons.
        </div>
      )}

      {hasImage && parkMap && (
        <>
          {/* ---- Toolbar ---- */}
          <div style={{ display: 'flex', gap: '.85rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '.85rem', padding: '.75rem 1rem', background: 'var(--c-surface-alt, #fafaf7)', borderRadius: 4 }}>
            <div>
              <label style={{ fontSize: '.75rem', color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>Editing</label>
              <select
                value={activeCode}
                onChange={(e) => { setActiveCode(e.target.value); cancelPlacement(); }}
                style={{ padding: '.4rem .55rem', border: '1px solid var(--c-border)', borderRadius: 3, fontSize: '.85rem', minWidth: 240 }}
              >
                <option value="">— pick a site —</option>
                {Object.keys(byLoop).sort().map((loop) => (
                  <optgroup key={loop} label={`Loop ${loop}`}>
                    {byLoop[loop].map((s) => {
                      const placed = Array.isArray(s.map_polygon) && s.map_polygon.length > 0;
                      return (
                        <option key={s.id} value={s.site_number}>
                          {placed ? '✓ ' : '  '}{s.site_number} · {s.site_type ?? 'standard'}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '.4rem', alignItems: 'end' }}>
              {activeSite && !hasPolygon(activeSite) && mode === 'idle' && (
                <Button onClick={beginPlace} leading={<IconPlus size={14} />}>Start placing polygon</Button>
              )}
              {activeSite && hasPolygon(activeSite) && mode === 'idle' && (
                <>
                  <Button onClick={beginPlace} variant="ghost">Replace polygon</Button>
                  <Button onClick={deleteActive} variant="ghost" leading={<IconTrash size={14} />}>Delete polygon</Button>
                </>
              )}
              {mode === 'placing' && (
                <Button onClick={cancelPlacement} variant="ghost" leading={<IconClose size={14} />}>Cancel (Esc)</Button>
              )}
            </div>

            {mode === 'placing' && inProgress.length === 0 && (
              <span style={{ color: 'var(--c-rust, #C4622D)', fontSize: '.85rem' }}>
                Click the <strong>first corner</strong> on the map.
              </span>
            )}
            {mode === 'placing' && inProgress.length === 1 && (
              <span style={{ color: 'var(--c-rust, #C4622D)', fontSize: '.85rem' }}>
                Click the <strong>opposite corner</strong> to save. Esc to cancel.
              </span>
            )}

            <div style={{ marginLeft: 'auto', fontSize: '.8rem', color: 'var(--c-text-muted)' }}>
              {placedCount} of {sites.length} sites placed
              {unplacedSites.length > 0 && (
                <span style={{ color: 'var(--c-warn, #b07a14)', marginLeft: '.5rem' }}>
                  <IconAlert size={12} style={{ verticalAlign: '-2px' }} /> {unplacedSites.length} unplaced
                </span>
              )}
            </div>
          </div>

          {/* ---- Stage (image + overlay) ---- */}
          <div
            ref={stageRef}
            onMouseMove={onStageMouseMove}
            onClick={onStageClick}
            style={{
              position: 'relative',
              width: '100%',
              background: '#e5ddce',
              border: '1px solid var(--c-border)',
              borderRadius: 4,
              overflow: 'hidden',
              cursor: mode === 'placing' ? 'crosshair' : 'default',
              userSelect: 'none',
            }}
          >
            <img src={parkMap.image_url} alt="Park base map" style={{ display: 'block', width: '100%', height: 'auto' }} />
            <svg
              viewBox={`0 0 ${SVG_SCALE} ${SVG_SCALE}`}
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              {/* Existing polygons */}
              {sites.filter(hasPolygon).map((s) => {
                const poly = s.map_polygon as Point[];
                const pts = poly.map(([x, y]) => `${(x * SVG_SCALE).toFixed(1)},${(y * SVG_SCALE).toFixed(1)}`).join(' ');
                const isActive = s.site_number === activeCode;
                return (
                  <g key={s.id}>
                    <polygon
                      points={pts}
                      onClick={(e) => { e.stopPropagation(); setActiveCode(s.site_number); }}
                      style={{
                        fill: isActive ? 'rgba(196, 98, 45, 0.5)' : 'rgba(196, 98, 45, 0.22)',
                        stroke: isActive ? 'var(--c-rust, #C4622D)' : 'rgba(196, 98, 45, 0.7)',
                        strokeWidth: isActive ? 2.5 : 1.2,
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                      }}
                    />
                  </g>
                );
              })}
              {/* In-progress placement preview */}
              {mode === 'placing' && inProgress.length === 1 && (
                <rect
                  x={Math.min(inProgress[0][0], cursor[0]) * SVG_SCALE}
                  y={Math.min(inProgress[0][1], cursor[1]) * SVG_SCALE}
                  width={Math.abs(cursor[0] - inProgress[0][0]) * SVG_SCALE}
                  height={Math.abs(cursor[1] - inProgress[0][1]) * SVG_SCALE}
                  style={{ fill: 'rgba(74, 124, 89, 0.35)', stroke: '#4A7C59', strokeWidth: 2, strokeDasharray: '4 2' }}
                />
              )}
              {/* Crosshair */}
              {mode === 'placing' && (
                <>
                  <line x1={cursor[0] * SVG_SCALE} y1={0} x2={cursor[0] * SVG_SCALE} y2={SVG_SCALE}
                        style={{ stroke: 'rgba(196, 98, 45, 0.55)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <line x1={0} y1={cursor[1] * SVG_SCALE} x2={SVG_SCALE} y2={cursor[1] * SVG_SCALE}
                        style={{ stroke: 'rgba(196, 98, 45, 0.55)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                </>
              )}
            </svg>
          </div>

          {/* ---- Unplaced sites chips ---- */}
          {unplacedSites.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '.8rem 1rem', background: 'var(--c-surface-alt, #fafaf7)', borderRadius: 4 }}>
              <div style={{ fontSize: '.82rem', color: 'var(--c-text-muted)', marginBottom: '.4rem' }}>
                <strong>Unplaced ({unplacedSites.length}):</strong> click a chip to select + begin placing.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem' }}>
                {unplacedSites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setActiveCode(s.site_number); setMode('placing'); setInProgress([]); }}
                    style={{
                      padding: '.2rem .6rem',
                      background: '#fff',
                      border: '1px solid var(--c-border)',
                      borderRadius: 999,
                      fontSize: '.8rem',
                      cursor: 'pointer',
                    }}
                  >{s.site_number}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function hasPolygon(s: Site): boolean {
  return Array.isArray(s.map_polygon) && s.map_polygon.length > 0;
}
