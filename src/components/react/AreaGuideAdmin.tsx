/**
 * AreaGuideAdmin — single tabbed admin for trails, things-to-do, local
 * places, and park sites.
 *
 * Consolidates four CRUD UIs into one screen to match the "area guide"
 * mental model. Each tab lists records in a table and opens a side panel
 * for create/edit/delete.
 *
 * Data is loaded on tab-switch (lazy) so the initial render is fast even
 * with 60+ things-to-do and 109 park_sites in the DB.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';
import { Button } from './ui/Button';
import { TextInput } from './ui/Field';
import { Card } from './ui/Card';
import { IconPlus, IconTrash, IconClose, IconCheck, IconAlert } from './ui/Icon';
import { RichTextEditor } from './editors/RichTextEditor';

type Tab = 'trails' | 'things' | 'places' | 'sites';

export function AreaGuideAdmin() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_area_guide">
        <AreaGuideAdminInner />
      </AuthGuard>
    </AdminProviders>
  );
}

function AreaGuideAdminInner() {
  const [tab, setTab] = useState<Tab>('trails');

  return (
    <div>
      <GoogleMapsSetupCard />
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <TabButton active={tab === 'trails'} onClick={() => setTab('trails')}>🥾 Trails</TabButton>
        <TabButton active={tab === 'things'} onClick={() => setTab('things')}>✨ Things to Do</TabButton>
        <TabButton active={tab === 'places'} onClick={() => setTab('places')}>📍 Local Places</TabButton>
        <TabButton active={tab === 'sites'} onClick={() => setTab('sites')}>🏕 Park Sites</TabButton>
      </div>
      {tab === 'trails' && <TrailsPanel />}
      {tab === 'things' && <ThingsPanel />}
      {tab === 'places' && <PlacesPanel />}
      {tab === 'sites' && <SitesPanel />}
    </div>
  );
}

/**
 * Quick-access card linking to the Google Cloud Console screens the owner
 * needs to configure their Maps API key. Surfaced here because the trails,
 * things-to-do, and places pages all rely on the key and there's nowhere
 * else in the admin to get to these URLs.
 */
function GoogleMapsSetupCard() {
  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem 1.15rem',
        background: '#f5efe3',
        border: '1px solid #e5dcc4',
        borderRadius: 6,
        display: 'flex',
        gap: '.9rem',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ fontSize: '1.25rem', lineHeight: 1, marginTop: 2 }}>🗺️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#1f1712' }}>
          Google Maps setup
        </div>
        <div style={{ fontSize: '.85rem', color: '#4a3f38', lineHeight: 1.55, marginBottom: '.5rem' }}>
          Trails, Things to Do, and Local Places all render on a Google Map. If you're seeing a
          blank map or a "can't load" error, your API key needs configuration in Google Cloud
          Console:
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '.82rem', color: '#4a3f38', lineHeight: 1.7 }}>
          <li>
            <a
              href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#C4622D', fontWeight: 500 }}
            >
              Enable the Maps JavaScript API
            </a>{' '}
            on your Google Cloud project.
          </li>
          <li>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#C4622D', fontWeight: 500 }}
            >
              Manage your API key
            </a>{' '}
            — under "Application restrictions → HTTP referrers," allow{' '}
            <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>https://www.crookedriverranchrv.com/*</code>{' '}
            and{' '}
            <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>https://crookedriverranchrv.com/*</code>.
          </li>
          <li>
            <a
              href="https://console.cloud.google.com/billing"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#C4622D', fontWeight: 500 }}
            >
              Confirm billing is enabled
            </a>{' '}
            — Google requires a billing account on file even for the free tier.
          </li>
          <li>
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#C4622D', fontWeight: 500 }}
            >
              Open Google Cloud Console home →
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
      style={{ fontSize: '.9rem' }}
    >{children}</button>
  );
}

// ---- Trails ---------------------------------------------------------------

interface Trail {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  distance_miles: number | null;
  elevation_gain_feet: number | null;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert' | null;
  pet_friendly: boolean;
  kid_friendly: boolean;
  hazards: string[];
  hero_image_url: string | null;
  trailhead_lat: number | null;
  trailhead_lng: number | null;
  parking_info: string | null;
  season: string | null;
  drive_time_from_park: string | null;
  external_link: string | null;
  is_on_property: boolean;
  is_published: boolean;
  display_order: number;
}

function TrailsPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Trail | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ trails: Trail[] }>('/api/area-guide/trails');
      setRows(res.trails);
    } catch (err: any) { toast.error('Failed to load trails', { detail: err?.message ?? 'Check that migrations ran and you are signed in.' }); }
    finally { setLoading(false); }
    // `toast` omitted from deps on purpose — with a memoized Toast provider
    // it's stable, but defensively keeping deps empty means re-renders never
    // re-fire the load and re-toast the same error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDelete = async (row: Trail) => {
    const ok = await confirm({ title: `Delete ${row.name}?`, message: 'This cannot be undone.', danger: true });
    if (!ok) return;
    try {
      await apiDelete(`/api/area-guide/trails/${row.id}`);
      toast.success('Deleted');
      load();
    } catch (err: any) { toast.error('Delete failed', { detail: err?.message }); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: 400, margin: 0 }}>Trails</h2>
        <Button onClick={() => setCreating(true)} leading={<IconPlus size={14} />}>Add trail</Button>
      </div>
      {loading ? <div>Loading…</div> : (
        <Card>
          {rows.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-muted)' }}>
              No trails yet. Seed data ships with a handful; run the migrations if you expected to see them.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--c-border)' }}>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Name</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Type</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Distance</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Difficulty</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Status</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <td style={{ padding: '.7rem .8rem' }}>
                      <button onClick={() => setEditing(r)} className="btn btn-ghost btn-sm" style={{ padding: 0, textAlign: 'left' }}>
                        <strong>{r.name}</strong>
                      </button>
                      <div style={{ fontSize: '.75rem', color: 'var(--c-text-muted)' }}>/{r.slug}</div>
                    </td>
                    <td style={{ padding: '.7rem .8rem' }}>{r.is_on_property ? 'On-property' : 'Nearby'}</td>
                    <td style={{ padding: '.7rem .8rem' }}>{r.distance_miles ? `${r.distance_miles} mi` : '—'}</td>
                    <td style={{ padding: '.7rem .8rem', textTransform: 'capitalize' }}>{r.difficulty ?? '—'}</td>
                    <td style={{ padding: '.7rem .8rem' }}>
                      {r.is_published ? <span style={{ color: '#4A7C59' }}>Published</span> : <span style={{ color: 'var(--c-text-muted)' }}>Draft</span>}
                    </td>
                    <td style={{ padding: '.7rem .8rem', textAlign: 'right' }}>
                      <button onClick={() => onDelete(r)} className="icon-btn" title="Delete" aria-label={`Delete ${r.name}`}>
                        <IconTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
      {(editing || creating) && (
        <RecordDrawer
          title={creating ? 'New trail' : `Edit ${editing?.name ?? ''}`}
          onClose={() => { setEditing(null); setCreating(false); }}
        >
          <TrailForm
            initial={editing ?? undefined}
            onSaved={() => { setEditing(null); setCreating(false); load(); }}
          />
        </RecordDrawer>
      )}
    </>
  );
}

function TrailForm({ initial, onSaved }: { initial?: Trail; onSaved: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    slug: initial?.slug ?? '',
    name: initial?.name ?? '',
    summary: initial?.summary ?? '',
    description: initial?.description ?? '',
    distance_miles: initial?.distance_miles ?? '',
    elevation_gain_feet: initial?.elevation_gain_feet ?? '',
    difficulty: initial?.difficulty ?? '',
    pet_friendly: initial?.pet_friendly ?? false,
    kid_friendly: initial?.kid_friendly ?? false,
    hazards: (initial?.hazards ?? []).join(', '),
    hero_image_url: initial?.hero_image_url ?? '',
    trailhead_lat: initial?.trailhead_lat ?? '',
    trailhead_lng: initial?.trailhead_lng ?? '',
    parking_info: initial?.parking_info ?? '',
    season: initial?.season ?? '',
    drive_time_from_park: initial?.drive_time_from_park ?? '',
    external_link: initial?.external_link ?? '',
    is_on_property: initial?.is_on_property ?? false,
    is_published: initial?.is_published ?? true,
    display_order: initial?.display_order ?? 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        slug: f.slug,
        name: f.name,
        summary: f.summary || null,
        description: f.description || null,
        distance_miles: f.distance_miles === '' ? null : Number(f.distance_miles),
        elevation_gain_feet: f.elevation_gain_feet === '' ? null : Number(f.elevation_gain_feet),
        difficulty: f.difficulty || null,
        pet_friendly: f.pet_friendly,
        kid_friendly: f.kid_friendly,
        hazards: f.hazards ? f.hazards.split(',').map((s) => s.trim()).filter(Boolean) : [],
        hero_image_url: f.hero_image_url || null,
        trailhead_lat: f.trailhead_lat === '' ? null : Number(f.trailhead_lat),
        trailhead_lng: f.trailhead_lng === '' ? null : Number(f.trailhead_lng),
        parking_info: f.parking_info || null,
        season: f.season || null,
        drive_time_from_park: f.drive_time_from_park || null,
        external_link: f.external_link || null,
        is_on_property: f.is_on_property,
        is_published: f.is_published,
        display_order: Number(f.display_order) || 0,
      };
      if (initial?.id) {
        await apiPatch(`/api/area-guide/trails/${initial.id}`, payload);
      } else {
        await apiPost('/api/area-guide/trails', payload);
      }
      toast.success('Saved');
      onSaved();
    } catch (err: any) { toast.error('Save failed', { detail: err?.message }); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
      <TextInput label="Slug (URL path)" required value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="my-trail" />
      <TextInput label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <TextInput label="One-line summary (for cards)" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      <RichTextEditor label="Description" value={f.description} onChange={(html) => setF({ ...f, description: html })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
        <TextInput label="Distance (miles)" type="number" step="0.1" value={String(f.distance_miles)} onChange={(e) => setF({ ...f, distance_miles: e.target.value })} />
        <TextInput label="Elevation gain (ft)" type="number" value={String(f.elevation_gain_feet)} onChange={(e) => setF({ ...f, elevation_gain_feet: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="form-label">Difficulty</label>
        <select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value as any })} className="input">
          <option value="">— not set —</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
      </div>
      <TextInput label="Hazards (comma-separated, e.g. 'steep_dropoff, loose_rock')" value={f.hazards} onChange={(e) => setF({ ...f, hazards: e.target.value })} />
      <TextInput label="Hero image URL" value={f.hero_image_url} onChange={(e) => setF({ ...f, hero_image_url: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
        <TextInput label="Trailhead lat" type="number" step="0.0000001" value={String(f.trailhead_lat)} onChange={(e) => setF({ ...f, trailhead_lat: e.target.value })} />
        <TextInput label="Trailhead lng" type="number" step="0.0000001" value={String(f.trailhead_lng)} onChange={(e) => setF({ ...f, trailhead_lng: e.target.value })} />
      </div>
      <TextInput label="Parking info" value={f.parking_info} onChange={(e) => setF({ ...f, parking_info: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
        <TextInput label="Season" value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} placeholder="Year-round" />
        <TextInput label="Drive time from park" value={f.drive_time_from_park} onChange={(e) => setF({ ...f, drive_time_from_park: e.target.value })} placeholder="15 min" />
      </div>
      <TextInput label="External link (e.g. AllTrails)" value={f.external_link} onChange={(e) => setF({ ...f, external_link: e.target.value })} />
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <label><input type="checkbox" checked={f.is_on_property} onChange={(e) => setF({ ...f, is_on_property: e.target.checked })} /> On-property</label>
        <label><input type="checkbox" checked={f.pet_friendly} onChange={(e) => setF({ ...f, pet_friendly: e.target.checked })} /> Pet-friendly</label>
        <label><input type="checkbox" checked={f.kid_friendly} onChange={(e) => setF({ ...f, kid_friendly: e.target.checked })} /> Kid-friendly</label>
        <label><input type="checkbox" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} /> Published</label>
      </div>
      <TextInput label="Display order" type="number" value={String(f.display_order)} onChange={(e) => setF({ ...f, display_order: Number(e.target.value) })} />
      <Button type="submit" loading={submitting} leading={<IconCheck size={14} />}>Save</Button>
    </form>
  );
}

// ---- Things to Do (compact — similar pattern, less field detail) ----------

interface Thing {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  personas: string[];
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  distance_from_park: string | null;
  hero_image_url: string | null;
  icon: string | null;
  external_link: string | null;
  is_published: boolean;
  display_order: number;
}

function ThingsPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<Thing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Thing | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await apiGet<{ things: Thing[] }>('/api/area-guide/things')).things); }
    catch (err: any) { toast.error('Failed to load things', { detail: err?.message ?? 'Check that migrations ran and you are signed in.' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: 400, margin: 0 }}>Things to Do</h2>
        <Button onClick={() => setCreating(true)} leading={<IconPlus size={14} />}>Add activity</Button>
      </div>
      {loading ? <div>Loading…</div> : (
        <Card>
          {rows.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-muted)' }}>
              No activities yet. The seed migration adds 60 — run migrations if you expected to see them.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--c-border)' }}>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Title</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Category</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Distance</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Status</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <td style={{ padding: '.7rem .8rem' }}>
                      <button onClick={() => setEditing(r)} className="btn btn-ghost btn-sm" style={{ padding: 0, textAlign: 'left' }}>
                        <strong>{r.icon ? `${r.icon} ` : ''}{r.title}</strong>
                      </button>
                      <div style={{ fontSize: '.75rem', color: 'var(--c-text-muted)' }}>/{r.slug}</div>
                    </td>
                    <td style={{ padding: '.7rem .8rem', textTransform: 'capitalize' }}>{r.category.replace('_', ' ')}</td>
                    <td style={{ padding: '.7rem .8rem' }}>{r.distance_from_park ?? '—'}</td>
                    <td style={{ padding: '.7rem .8rem' }}>
                      {r.is_published ? <span style={{ color: '#4A7C59' }}>Published</span> : <span style={{ color: 'var(--c-text-muted)' }}>Draft</span>}
                    </td>
                    <td style={{ padding: '.7rem .8rem', textAlign: 'right' }}>
                      <button onClick={async () => {
                        const ok = await confirm({ title: `Delete ${r.title}?`, message: 'This cannot be undone.', danger: true });
                        if (!ok) return;
                        try { await apiDelete(`/api/area-guide/things/${r.id}`); toast.success('Deleted'); load(); }
                        catch (err: any) { toast.error('Delete failed', { detail: err?.message }); }
                      }} className="icon-btn" aria-label={`Delete ${r.title}`}><IconTrash size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
      {(editing || creating) && (
        <RecordDrawer title={creating ? 'New activity' : `Edit ${editing?.title ?? ''}`} onClose={() => { setEditing(null); setCreating(false); }}>
          <ThingForm initial={editing ?? undefined} onSaved={() => { setEditing(null); setCreating(false); load(); }} />
        </RecordDrawer>
      )}
    </>
  );
}

function ThingForm({ initial, onSaved }: { initial?: Thing; onSaved: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    slug: initial?.slug ?? '',
    title: initial?.title ?? '',
    summary: initial?.summary ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 'families',
    personas: (initial?.personas ?? []).join(','),
    location_name: initial?.location_name ?? '',
    lat: initial?.lat ?? '',
    lng: initial?.lng ?? '',
    distance_from_park: initial?.distance_from_park ?? '',
    hero_image_url: initial?.hero_image_url ?? '',
    icon: initial?.icon ?? '',
    external_link: initial?.external_link ?? '',
    is_published: initial?.is_published ?? true,
    display_order: initial?.display_order ?? 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        slug: f.slug,
        title: f.title,
        summary: f.summary || null,
        description: f.description || null,
        category: f.category,
        personas: f.personas ? f.personas.split(',').map((s) => s.trim()).filter(Boolean) : [],
        location_name: f.location_name || null,
        lat: f.lat === '' ? null : Number(f.lat),
        lng: f.lng === '' ? null : Number(f.lng),
        distance_from_park: f.distance_from_park || null,
        hero_image_url: f.hero_image_url || null,
        icon: f.icon || null,
        external_link: f.external_link || null,
        is_published: f.is_published,
        display_order: Number(f.display_order) || 0,
      };
      if (initial?.id) await apiPatch(`/api/area-guide/things/${initial.id}`, payload);
      else await apiPost('/api/area-guide/things', payload);
      toast.success('Saved');
      onSaved();
    } catch (err: any) { toast.error('Save failed', { detail: err?.message }); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
      <TextInput label="Slug" required value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
      <TextInput label="Title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <TextInput label="Summary (one line)" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      <RichTextEditor label="Description" value={f.description} onChange={(html) => setF({ ...f, description: html })} />
      <div className="form-field">
        <label className="form-label">Primary category</label>
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input">
          <option value="families">Families</option>
          <option value="active">Active</option>
          <option value="rvers">RVers</option>
          <option value="dogs">Dogs</option>
          <option value="day_trippers">Day Trippers</option>
          <option value="winter">Winter</option>
          <option value="food_community">Food &amp; Community</option>
        </select>
      </div>
      <TextInput label="Also shows under (comma-sep personas, e.g. 'active,families')" value={f.personas} onChange={(e) => setF({ ...f, personas: e.target.value })} />
      <TextInput label="Location name" value={f.location_name} onChange={(e) => setF({ ...f, location_name: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
        <TextInput label="Lat" type="number" step="0.0000001" value={String(f.lat)} onChange={(e) => setF({ ...f, lat: e.target.value })} />
        <TextInput label="Lng" type="number" step="0.0000001" value={String(f.lng)} onChange={(e) => setF({ ...f, lng: e.target.value })} />
      </div>
      <TextInput label="Distance from park (text, e.g. '15 min drive')" value={f.distance_from_park} onChange={(e) => setF({ ...f, distance_from_park: e.target.value })} />
      <TextInput label="Icon (emoji)" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} />
      <TextInput label="Hero image URL" value={f.hero_image_url} onChange={(e) => setF({ ...f, hero_image_url: e.target.value })} />
      <TextInput label="External link" value={f.external_link} onChange={(e) => setF({ ...f, external_link: e.target.value })} />
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <label><input type="checkbox" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} /> Published</label>
      </div>
      <TextInput label="Display order" type="number" value={String(f.display_order)} onChange={(e) => setF({ ...f, display_order: Number(e.target.value) })} />
      <Button type="submit" loading={submitting} leading={<IconCheck size={14} />}>Save</Button>
    </form>
  );
}

// ---- Places --------------------------------------------------------------

interface Place {
  id: string;
  slug: string | null;
  name_override: string | null;
  google_place_id: string;
  category: string;
  our_description: string | null;
  featured: boolean;
  is_published: boolean;
  cached_at: string | null;
  cached_data: any;
  display_order: number;
}

function PlacesPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Place | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await apiGet<{ places: Place[] }>('/api/area-guide/places')).places); }
    catch (err: any) { toast.error('Failed to load places', { detail: err?.message ?? 'Check that migrations ran and you are signed in.' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async (p: Place) => {
    try {
      await apiPost(`/api/places/${p.id}`, {});
      toast.success('Refreshed from Google');
      load();
    } catch (err: any) { toast.error('Refresh failed', { detail: err?.message }); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: 400, margin: 0 }}>Local Places</h2>
        <Button onClick={() => setCreating(true)} leading={<IconPlus size={14} />}>Add place</Button>
      </div>
      <div style={{ marginBottom: '1rem', padding: '1rem 1.25rem', background: 'var(--c-surface-alt, #fafaf7)', borderLeft: '3px solid var(--c-rust, #C4622D)', borderRadius: '3px', fontSize: '.85rem' }}>
        <strong>Adding a place:</strong> click <em>+ Add place</em>, type the business name into the search field,
        and pick it from the dropdown — we look up the Google <code>place_id</code> for you. You&apos;ll only need
        the raw place_id field if the search can&apos;t find it.<br />
        <strong style={{ color: 'var(--c-rust, #C4622D)' }}>Refresh isn&apos;t pulling Google data?</strong>{' '}
        It means <code>GOOGLE_MAPS_SERVER_KEY</code> isn&apos;t configured (or the Places API (New) isn&apos;t
        enabled on your Google Cloud project). The Refresh toast now tells you which. See{' '}
        <code>AREA-GUIDE-SETUP.md</code> §2.
      </div>
      {loading ? <div>Loading…</div> : (
        <Card>
          {rows.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-muted)' }}>
              No places yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--c-border)' }}>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Name</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Category</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}>Google data</th>
                  <th style={{ padding: '.65rem .8rem', fontSize: '.8rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <td style={{ padding: '.7rem .8rem' }}>
                      <button onClick={() => setEditing(p)} className="btn btn-ghost btn-sm" style={{ padding: 0, textAlign: 'left' }}>
                        <strong>{p.cached_data?.displayName?.text || p.name_override || '(Unnamed)'}</strong>
                      </button>
                      {p.google_place_id.startsWith('TODO_') && (
                        <span style={{ marginLeft: '.5rem', color: '#C4622D', fontSize: '.75rem' }}>
                          <IconAlert size={12} style={{ verticalAlign: '-2px' }} /> needs real place_id
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '.7rem .8rem', textTransform: 'capitalize' }}>{p.category}</td>
                    <td style={{ padding: '.7rem .8rem', fontSize: '.8rem', color: 'var(--c-text-muted)' }}>
                      {p.cached_at ? `Cached ${new Date(p.cached_at).toLocaleString()}` : 'Not fetched yet'}
                    </td>
                    <td style={{ padding: '.7rem .8rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => refresh(p)} className="btn btn-ghost btn-sm" disabled={p.google_place_id.startsWith('TODO_')}>Refresh</button>
                      <button onClick={async () => {
                        const ok = await confirm({ title: `Delete place?`, message: 'This cannot be undone.', danger: true });
                        if (!ok) return;
                        try { await apiDelete(`/api/area-guide/places/${p.id}`); toast.success('Deleted'); load(); }
                        catch (err: any) { toast.error('Delete failed', { detail: err?.message }); }
                      }} className="icon-btn" aria-label="Delete"><IconTrash size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
      {(editing || creating) && (
        <RecordDrawer title={creating ? 'New place' : 'Edit place'} onClose={() => { setEditing(null); setCreating(false); }}>
          <PlaceForm initial={editing ?? undefined} onSaved={() => { setEditing(null); setCreating(false); load(); }} />
        </RecordDrawer>
      )}
    </>
  );
}

function PlaceForm({ initial, onSaved }: { initial?: Place; onSaved: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    slug: initial?.slug ?? '',
    name_override: initial?.name_override ?? '',
    google_place_id: initial?.google_place_id ?? '',
    category: initial?.category ?? 'restaurant',
    our_description: initial?.our_description ?? '',
    featured: initial?.featured ?? false,
    is_published: initial?.is_published ?? true,
    display_order: initial?.display_order ?? 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...f, slug: f.slug || null, name_override: f.name_override || null, our_description: f.our_description || null };
      if (initial?.id) await apiPatch(`/api/area-guide/places/${initial.id}`, payload);
      else await apiPost('/api/area-guide/places', payload);
      toast.success('Saved');
      onSaved();
    } catch (err: any) { toast.error('Save failed', { detail: err?.message }); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
      <PlaceSearchField
        currentId={f.google_place_id}
        onPick={(pick) => setF({
          ...f,
          google_place_id: pick.place_id,
          // Only auto-fill name_override if the admin hasn't typed their own.
          name_override: f.name_override || pick.name,
        })}
      />
      <TextInput label="Name override (optional — Google's name is used by default)" value={f.name_override} onChange={(e) => setF({ ...f, name_override: e.target.value })} />
      <div className="form-field">
        <label className="form-label">Category</label>
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input">
          <option value="restaurant">Restaurant</option>
          <option value="brewery">Brewery</option>
          <option value="coffee">Coffee</option>
          <option value="shop">Shop</option>
          <option value="attraction">Attraction</option>
          <option value="other">Other</option>
        </select>
      </div>
      <TextInput label="Slug (optional, for custom URL)" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
      <RichTextEditor label="Our description (optional — replaces Google's editorial summary)" value={f.our_description} onChange={(html) => setF({ ...f, our_description: html })} />
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <label><input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} /> Featured (Editor's pick)</label>
        <label><input type="checkbox" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} /> Published</label>
      </div>
      <TextInput label="Display order" type="number" value={String(f.display_order)} onChange={(e) => setF({ ...f, display_order: Number(e.target.value) })} />
      <Button type="submit" loading={submitting} leading={<IconCheck size={14} />}>Save</Button>
    </form>
  );
}

// ---- Place search helper -------------------------------------------------

interface LookupCandidate {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
}

/**
 * Search-first place_id picker. Replaces the raw place_id text input.
 *
 * Editors type a business name, a debounced call hits
 * /api/places/lookup?q=... (which proxies to Google Places Text Search),
 * results render as a dropdown, click picks the place_id. Falls back to
 * a manual "paste a place_id" input if the user already has one in hand
 * or the search API isn't configured (GOOGLE_MAPS_SERVER_KEY missing).
 *
 * Error states are routed through the search result area, not a toast —
 * the user is looking right at this input when searching, so an inline
 * "GOOGLE_MAPS_SERVER_KEY is not set" message is more actionable than a
 * toast in the corner.
 */
function PlaceSearchField({
  currentId,
  onPick,
}: {
  currentId: string;
  onPick: (pick: LookupCandidate) => void;
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<LookupCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  // Debounced search — 350ms after typing stops.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCandidates([]);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await apiGet<{ candidates: LookupCandidate[]; reason?: string; detail?: string }>(
          `/api/places/lookup?q=${encodeURIComponent(q)}`,
        );
        if (res.reason && res.detail) {
          setError(res.detail);
          setCandidates([]);
        } else {
          setCandidates(res.candidates);
        }
      } catch (err: any) {
        setError(err?.message || 'Search failed');
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const hasId = Boolean(currentId && !currentId.startsWith('TODO_'));

  return (
    <div className="form-field">
      <label className="form-label">Google Place</label>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'stretch' }}>
        <input
          type="search"
          className="input"
          placeholder="Search: &quot;Smith Rock State Park&quot;, &quot;Deschutes Brewery&quot;…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowManual((v) => !v)}
          style={{ whiteSpace: 'nowrap' }}
        >
          {showManual ? 'Use search' : 'Paste place_id'}
        </button>
      </div>

      {showManual ? (
        <div style={{ marginTop: '.5rem' }}>
          <TextInput
            label=""
            value={currentId}
            onChange={(e) => onPick({ place_id: e.target.value, name: '', address: '' })}
            placeholder="ChIJ..."
            hint="Only needed if Google's search can't find the place (rare)."
          />
        </div>
      ) : (
        <div style={{ marginTop: '.4rem', fontSize: '.8rem', color: 'var(--c-muted, #665040)' }}>
          {hasId && !query && (
            <span>
              ✓ Place linked (<code style={{ fontSize: '.75rem' }}>{currentId}</code>). Type above to replace it.
            </span>
          )}
          {searching && <span>Searching…</span>}
          {error && (
            <div
              style={{
                marginTop: '.5rem',
                padding: '.6rem .8rem',
                background: '#fdf2e4',
                border: '1px solid #e8c696',
                borderRadius: 4,
                color: '#7a4a10',
                fontSize: '.82rem',
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
          {!searching && !error && candidates.length > 0 && (
            <ul
              style={{
                marginTop: '.5rem',
                padding: 0,
                listStyle: 'none',
                border: '1px solid #e5dcc4',
                borderRadius: 4,
                maxHeight: 280,
                overflowY: 'auto',
                background: '#fff',
              }}
            >
              {candidates.map((c) => {
                const isCurrent = c.place_id === currentId;
                return (
                  <li key={c.place_id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(c);
                        setQuery('');
                        setCandidates([]);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '.65rem .85rem',
                        background: isCurrent ? '#fdf2e4' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #f0ead9',
                        cursor: 'pointer',
                        display: 'block',
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#1f1712', fontSize: '.9rem' }}>
                        {c.name}
                        {isCurrent && <span style={{ marginLeft: '.5rem', fontSize: '.7rem', color: '#C4622D' }}>· current</span>}
                      </div>
                      <div style={{ fontSize: '.78rem', color: '#665040', marginTop: 2 }}>
                        {c.address}
                        {typeof c.rating === 'number' && (
                          <span style={{ marginLeft: '.6rem' }}>
                            ★ {c.rating.toFixed(1)}
                            {c.userRatingCount ? ` (${c.userRatingCount})` : ''}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!searching && !error && query.trim().length >= 2 && candidates.length === 0 && (
            <span>No matches. Try a different search term.</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Park Sites ----------------------------------------------------------

interface Site {
  id: string;
  site_number: string;
  loop: string;
  length_feet: number | null;
  width_feet: number | null;
  pull_through: boolean;
  amp_service: number | null;
  site_type: string | null;
  nightly_rate: number | null;
  map_position_x: number | null;
  map_position_y: number | null;
  firefly_deep_link: string | null;
  is_available: boolean;
  is_published: boolean;
  // V4 fields (migration 016 + Phase 3.3 admin extensions)
  status: 'available' | 'camp_host' | 'staff_only' | 'maintenance' | 'reserved' | 'seasonal_closed';
  status_note: string | null;
  hero_image_url: string | null;
  gallery_image_urls: string[];
  description: string | null;
  features: string[];
}

const STATUS_OPTIONS: { value: Site['status']; label: string }[] = [
  { value: 'available',       label: 'Available (bookable)' },
  { value: 'staff_only',      label: 'Staff booking only (shows phone CTA)' },
  { value: 'camp_host',       label: 'Camp Host (permanent, non-bookable)' },
  { value: 'maintenance',     label: 'Maintenance (temporary)' },
  { value: 'reserved',        label: 'Reserved (annual / group hold)' },
  { value: 'seasonal_closed', label: 'Seasonal closed' },
];

function SitesPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Site | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await apiGet<{ sites: Site[] }>('/api/area-guide/park-sites')).sites); }
    catch (err: any) { toast.error('Failed to load sites', { detail: err?.message ?? 'Check that migrations ran and you are signed in.' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byLoop = useMemo(() => {
    const m: Record<string, Site[]> = {};
    rows.forEach((s) => { (m[s.loop] ??= []).push(s); });
    return m;
  }, [rows]);

  const removeSite = async (s: Site) => {
    const ok = await confirm({
      title: `Delete ${s.site_number}?`,
      message: `Permanently remove site ${s.site_number} (loop ${s.loop}). This also removes any polygon placement and photos attached to it. Cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/area-guide/park-sites/${s.id}`);
      toast.success(`Deleted ${s.site_number}`);
      setRows((prev) => prev.filter((r) => r.id !== s.id));
    } catch (err: any) { toast.error('Delete failed', { detail: err?.message }); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: 400, margin: 0 }}>Park Sites</h2>
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
          <div style={{ fontSize: '.85rem', color: 'var(--c-text-muted)' }}>{rows.length} sites across {Object.keys(byLoop).length} loops</div>
          <Button onClick={() => setCreating(true)} leading={<IconPlus size={14} />}>New site</Button>
        </div>
      </div>
      <div style={{ marginBottom: '1rem', padding: '1rem 1.25rem', background: 'var(--c-surface-alt, #fafaf7)', borderLeft: '3px solid var(--c-rust, #C4622D)', borderRadius: '3px', fontSize: '.85rem' }}>
        <strong>Polygon editor:</strong> the new interactive park map on <code>/park-map</code> uses per-site polygons
        you draw on the base image. Open the{' '}
        <a href="/admin/park-map" style={{ color: 'var(--c-rust, #C4622D)', fontWeight: 500 }}>Park Map Editor</a>{' '}
        to upload the base image and place a rectangle for each site. Status, photos, description, and features for each site are edited below.
      </div>
      {loading ? <div>Loading…</div> : Object.keys(byLoop).sort().map((loop) => (
        <div key={loop} style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 400, margin: '0 0 .8rem', color: 'var(--c-text)' }}>Loop {loop} ({byLoop[loop].length} sites)</h3>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--c-border)' }}>
                  <th style={{ padding: '.55rem .7rem', fontSize: '.78rem' }}>Site</th>
                  <th style={{ padding: '.55rem .7rem', fontSize: '.78rem' }}>Type</th>
                  <th style={{ padding: '.55rem .7rem', fontSize: '.78rem' }}>Dim</th>
                  <th style={{ padding: '.55rem .7rem', fontSize: '.78rem' }}>Amp</th>
                  <th style={{ padding: '.55rem .7rem', fontSize: '.78rem' }}>Rate</th>
                  <th style={{ padding: '.55rem .7rem', fontSize: '.78rem' }}>Map pos</th>
                  <th style={{ padding: '.55rem .7rem', fontSize: '.78rem' }}>Book link</th>
                </tr>
              </thead>
              <tbody>
                {byLoop[loop].map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <td style={{ padding: '.55rem .7rem' }}>
                      <button onClick={() => setEditing(s)} className="btn btn-ghost btn-sm" style={{ padding: 0 }}>
                        <strong>{s.site_number}</strong>
                      </button>
                    </td>
                    <td style={{ padding: '.55rem .7rem', fontSize: '.85rem' }}>{s.site_type ?? '—'}</td>
                    <td style={{ padding: '.55rem .7rem', fontSize: '.85rem' }}>{s.length_feet ? `${s.length_feet}×${s.width_feet ?? '?'}` : '—'}</td>
                    <td style={{ padding: '.55rem .7rem', fontSize: '.85rem' }}>{s.amp_service ?? '—'}</td>
                    <td style={{ padding: '.55rem .7rem', fontSize: '.85rem' }}>{s.nightly_rate ? `$${s.nightly_rate}` : '—'}</td>
                    <td style={{ padding: '.55rem .7rem', fontSize: '.75rem', color: 'var(--c-text-muted)' }}>
                      {s.map_position_x?.toFixed(1)},{s.map_position_y?.toFixed(1)}
                    </td>
                    <td style={{ padding: '.55rem .7rem', fontSize: '.75rem', color: s.firefly_deep_link ? '#4A7C59' : 'var(--c-text-muted)' }}>
                      {s.firefly_deep_link ? '✓ Deep link' : 'Generic'}
                    </td>
                    <td style={{ padding: '.55rem .4rem', textAlign: 'right' }}>
                      <button
                        onClick={() => removeSite(s)}
                        className="btn btn-ghost btn-sm"
                        title={`Delete ${s.site_number}`}
                        style={{ color: 'var(--c-danger, #b43c3c)', padding: '.25rem .4rem' }}
                      >
                        <IconTrash size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ))}
      {editing && (
        <RecordDrawer title={`Edit site ${editing.site_number}`} onClose={() => setEditing(null)}>
          <SiteForm initial={editing} onSaved={() => { setEditing(null); load(); }} />
        </RecordDrawer>
      )}
      {creating && (
        <RecordDrawer title="Add new site" onClose={() => setCreating(false)}>
          <NewSiteForm onSaved={() => { setCreating(false); load(); }} />
        </RecordDrawer>
      )}
    </>
  );
}

function SiteForm({ initial, onSaved }: { initial: Site; onSaved: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    site_type: initial.site_type ?? '',
    length_feet: initial.length_feet ?? '',
    width_feet: initial.width_feet ?? '',
    pull_through: initial.pull_through,
    amp_service: initial.amp_service ?? '',
    nightly_rate: initial.nightly_rate ?? '',
    map_position_x: initial.map_position_x ?? 0,
    map_position_y: initial.map_position_y ?? 0,
    firefly_deep_link: initial.firefly_deep_link ?? '',
    is_available: initial.is_available,
    is_published: initial.is_published,
    // V4 — status + content (Phase 3.3)
    status: (initial.status ?? 'available') as Site['status'],
    status_note: initial.status_note ?? '',
    hero_image_url: initial.hero_image_url ?? '',
    gallery_image_urls: initial.gallery_image_urls ?? [],
    description: initial.description ?? '',
    features: (initial.features ?? []).join(', '),
  });
  const [submitting, setSubmitting] = useState(false);

  const addGalleryImage = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (f.gallery_image_urls.includes(trimmed)) return;  // dedupe
    setF({ ...f, gallery_image_urls: [...f.gallery_image_urls, trimmed] });
  };
  const removeGalleryImage = (url: string) => {
    setF({ ...f, gallery_image_urls: f.gallery_image_urls.filter((u) => u !== url) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const featuresList = f.features
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        site_type: f.site_type || null,
        length_feet: f.length_feet === '' ? null : Number(f.length_feet),
        width_feet: f.width_feet === '' ? null : Number(f.width_feet),
        pull_through: f.pull_through,
        amp_service: f.amp_service === '' ? null : Number(f.amp_service),
        nightly_rate: f.nightly_rate === '' ? null : Number(f.nightly_rate),
        map_position_x: Number(f.map_position_x),
        map_position_y: Number(f.map_position_y),
        firefly_deep_link: f.firefly_deep_link || null,
        is_available: f.is_available,
        is_published: f.is_published,
        status: f.status,
        status_note: f.status_note.trim() || null,
        hero_image_url: f.hero_image_url || null,
        gallery_image_urls: f.gallery_image_urls,
        description: f.description.trim() || null,
        features: featuresList,
      };
      await apiPatch(`/api/area-guide/park-sites/${initial.id}`, payload);
      toast.success('Saved');
      onSaved();
    } catch (err: any) { toast.error('Save failed', { detail: err?.message }); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
      <div style={{ padding: '.6rem .85rem', background: 'var(--c-surface-alt)', borderRadius: '3px', fontSize: '.85rem' }}>
        Site <strong>{initial.site_number}</strong> · Loop {initial.loop}
      </div>

      <div>
        <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '.82rem' }}>Status</label>
        <select
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value as Site['status'] })}
          style={{ width: '100%', padding: '.5rem .6rem', border: '1px solid var(--c-border)', borderRadius: 3, background: '#fff', fontSize: '.88rem' }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <TextInput
        label="Status note (optional — shown in popup and detail page)"
        value={f.status_note}
        onChange={(e) => setF({ ...f, status_note: e.target.value })}
        placeholder='e.g. "Under repair through May 15"'
      />

      <TextInput label="Site type" value={f.site_type} onChange={(e) => setF({ ...f, site_type: e.target.value })} placeholder="standard, premium, …" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
        <TextInput label="Length (ft)" type="number" value={String(f.length_feet)} onChange={(e) => setF({ ...f, length_feet: e.target.value })} />
        <TextInput label="Width (ft)" type="number" value={String(f.width_feet)} onChange={(e) => setF({ ...f, width_feet: e.target.value })} />
      </div>
      <label><input type="checkbox" checked={f.pull_through} onChange={(e) => setF({ ...f, pull_through: e.target.checked })} /> Pull-through</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
        <TextInput label="Amp service" type="number" value={String(f.amp_service)} onChange={(e) => setF({ ...f, amp_service: e.target.value })} />
        <TextInput label="Nightly rate ($)" type="number" step="0.01" value={String(f.nightly_rate)} onChange={(e) => setF({ ...f, nightly_rate: e.target.value })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
        <TextInput label="Map X (%)" type="number" step="0.1" value={String(f.map_position_x)} onChange={(e) => setF({ ...f, map_position_x: Number(e.target.value) })} />
        <TextInput label="Map Y (%)" type="number" step="0.1" value={String(f.map_position_y)} onChange={(e) => setF({ ...f, map_position_y: Number(e.target.value) })} />
      </div>
      <TextInput label="Firefly deep link (optional, per-site)" value={f.firefly_deep_link} onChange={(e) => setF({ ...f, firefly_deep_link: e.target.value })} placeholder="https://app.fireflyreservations.com/..." />

      {/* ---- Content: hero, gallery, description, features ------------- */}
      <div style={{ padding: '.85rem 1rem', background: 'var(--c-surface-alt, #fafaf7)', borderLeft: '2px solid var(--c-rust, #C4622D)', borderRadius: '3px', fontSize: '.82rem', color: 'var(--c-text-muted)' }}>
        Content below appears on <code>/sites/{initial.site_number}</code> — the detail page linked from the park map's popover "Site info" link.
      </div>
      <TextInput
        label="Hero photo URL"
        value={f.hero_image_url}
        onChange={(e) => setF({ ...f, hero_image_url: e.target.value })}
        placeholder="https://…supabase.co/storage/v1/… or /images/…"
        hint="Paste a URL from the Media Library (/admin/media) or any public image URL."
      />
      <div>
        <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '.82rem' }}>Gallery photos</label>
        {f.gallery_image_urls.length > 0 && (
          <ul style={{ margin: '0 0 .5rem', padding: 0, listStyle: 'none', display: 'grid', gap: '.3rem' }}>
            {f.gallery_image_urls.map((u) => (
              <li key={u} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.78rem' }}>
                <code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '.3rem .5rem', background: '#fff', border: '1px solid var(--c-border)', borderRadius: 2 }}>{u}</code>
                <button type="button" onClick={() => removeGalleryImage(u)} className="btn btn-ghost btn-sm" title="Remove">
                  <IconTrash size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input
            type="url"
            placeholder="Paste gallery image URL, then press Add"
            style={{ flex: 1, padding: '.45rem .6rem', border: '1px solid var(--c-border)', borderRadius: 3, fontSize: '.82rem' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addGalleryImage((e.currentTarget as HTMLInputElement).value);
                (e.currentTarget as HTMLInputElement).value = '';
              }
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
              addGalleryImage(input.value);
              input.value = '';
            }}
          >
            <IconPlus size={12} /> Add
          </button>
        </div>
      </div>
      <div>
        <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '.82rem' }}>Description (shown on detail page)</label>
        <RichTextEditor
          value={f.description}
          onChange={(html: string) => setF({ ...f, description: html })}
          minHeight={120}
        />
      </div>
      <TextInput
        label="Features (comma-separated)"
        value={f.features}
        onChange={(e) => setF({ ...f, features: e.target.value })}
        placeholder="e.g. full hookup, shade, back-in, patio"
        hint="Shown as chips on the detail page."
      />

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <label><input type="checkbox" checked={f.is_available} onChange={(e) => setF({ ...f, is_available: e.target.checked })} /> Available (legacy flag)</label>
        <label><input type="checkbox" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} /> Published</label>
      </div>
      <Button type="submit" loading={submitting} leading={<IconCheck size={14} />}>Save</Button>
    </form>
  );
}

function NewSiteForm({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [site_number, setSiteNumber] = useState('');
  const [loop, setLoop] = useState('A');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = site_number.trim();
    if (!code) { toast.error('Site number required'); return; }
    if (!loop.trim()) { toast.error('Loop required'); return; }
    setSubmitting(true);
    try {
      await apiPost('/api/area-guide/park-sites', {
        site_number: code,
        loop: loop.trim(),
        pull_through: false,
        is_available: true,
        is_published: true,
        status: 'available',
        gallery_image_urls: [],
        features: [],
      });
      toast.success(`Added ${code}`);
      onSaved();
    } catch (err: any) {
      toast.error('Create failed', { detail: err?.message });
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
      <div style={{ padding: '.85rem 1rem', background: 'var(--c-surface-alt, #fafaf7)', borderLeft: '2px solid var(--c-rust, #C4622D)', borderRadius: 3, fontSize: '.82rem', color: 'var(--c-text-muted)' }}>
        Creates a minimal record with status = available. Open the site after creating to fill in length,
        amp service, description, photos, and polygon placement.
      </div>
      <TextInput
        label="Site number (e.g. A16, D43, DC5)"
        required
        value={site_number}
        onChange={(e) => setSiteNumber(e.target.value)}
        placeholder="A16"
        hint="Must be unique across all park_sites. Convention is letter prefix + number (no dash, no zero-padding)."
      />
      <TextInput
        label="Loop"
        required
        value={loop}
        onChange={(e) => setLoop(e.target.value)}
        placeholder="A, B, C, D, DC, T, G"
        hint="One of: A, B, C, D, DC, T, G."
      />
      <Button type="submit" loading={submitting} leading={<IconPlus size={14} />}>Create site</Button>
    </form>
  );
}

// ---- Shared drawer -------------------------------------------------------

function RecordDrawer({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rd-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 900, display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 'min(520px, 96vw)', height: '100%', background: 'var(--c-surface, #fff)', overflowY: 'auto', padding: '1.5rem 1.75rem 2rem', boxShadow: '-12px 0 40px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
          <h3 id="rd-title" style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '1.4rem' }}>{title}</h3>
          <button onClick={onClose} className="icon-btn" aria-label="Close"><IconClose size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
