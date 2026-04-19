/**
 * ParkSiteMap — interactive visual map of the 109 RV sites.
 *
 * Data shape: each site has map_position_x/y as a percentage (0–100) of
 * the map image, so the component works across any image size. Click a
 * site → modal with specs, photo, and a "Book this site" button that
 * deep-links to Firefly (if firefly_deep_link is set on the row) or
 * to the generic Firefly property page.
 *
 * This is a pure visual layer — it assumes a background image served at
 * `mapImageUrl` (admin-uploaded via the Media Library). If no image is
 * configured, we render a clean grid fallback so the component still
 * works for early content.
 */

import { useMemo, useState } from 'react';

export interface ParkSite {
  id: string;
  site_number: string;
  loop: string;
  length_feet: number | null;
  width_feet: number | null;
  pull_through: boolean;
  amp_service: number | null;
  site_type: string | null;
  nightly_rate: number | null;
  hero_image_url: string | null;
  description: string | null;
  features: string[];
  map_position_x: number | null;
  map_position_y: number | null;
  firefly_deep_link: string | null;
  is_available: boolean;
}

export interface ParkSiteMapProps {
  sites: ParkSite[];
  mapImageUrl?: string | null;
  fallbackFireflyUrl?: string;
}

const LOOP_COLORS: Record<string, string> = {
  A: '#C4622D',
  B: '#4A7C59',
  C: '#D4A853',
  D: '#6B5B95',
};

export function ParkSiteMap({ sites, mapImageUrl, fallbackFireflyUrl = 'https://app.fireflyreservations.com/reserve/property/CROOKEDRIVERRANCHRVPARK' }: ParkSiteMapProps) {
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [loopFilter, setLoopFilter] = useState<string | 'all'>('all');

  const visibleSites = useMemo(() => {
    if (loopFilter === 'all') return sites;
    return sites.filter((s) => s.loop === loopFilter);
  }, [sites, loopFilter]);

  const activeSite = useMemo(
    () => sites.find((s) => s.id === activeSiteId) ?? null,
    [sites, activeSiteId],
  );

  const loops = useMemo(() => {
    const set = new Set<string>();
    sites.forEach((s) => set.add(s.loop));
    return Array.from(set).sort();
  }, [sites]);

  return (
    <div className="park-site-map">
      <div className="psm-filter-row">
        <button
          type="button"
          onClick={() => setLoopFilter('all')}
          className={`psm-filter-btn${loopFilter === 'all' ? ' is-active' : ''}`}
        >All loops</button>
        {loops.map((loop) => (
          <button
            key={loop}
            type="button"
            onClick={() => setLoopFilter(loop)}
            className={`psm-filter-btn${loopFilter === loop ? ' is-active' : ''}`}
            style={loopFilter === loop ? { background: LOOP_COLORS[loop] ?? 'var(--rust)', borderColor: LOOP_COLORS[loop] ?? 'var(--rust)' } : undefined}
          >Loop {loop}</button>
        ))}
      </div>

      <div className="psm-canvas">
        {mapImageUrl ? (
          <img src={mapImageUrl} alt="Map of Crooked River Ranch RV Park sites" className="psm-bg-image" />
        ) : (
          <div className="psm-bg-fallback">
            <div>
              <strong>Upload a park map image</strong> at <code>/admin/site-map</code> to replace this placeholder.
            </div>
          </div>
        )}

        {visibleSites.map((site) => {
          const x = site.map_position_x ?? 50;
          const y = site.map_position_y ?? 50;
          const color = LOOP_COLORS[site.loop] ?? '#C4622D';
          return (
            <button
              key={site.id}
              type="button"
              className={`psm-pin${site.is_available ? '' : ' is-unavailable'}`}
              style={{ left: `${x}%`, top: `${y}%`, background: color, opacity: site.is_available ? 1 : 0.35 }}
              onClick={() => setActiveSiteId(site.id)}
              aria-label={`Site ${site.site_number}${!site.is_available ? ' (not available)' : ''}`}
              title={`${site.site_number} · ${site.site_type ?? 'Standard'}`}
            >
              <span className="psm-pin-label">{site.site_number.replace(/^[A-Z]-?/, '')}</span>
            </button>
          );
        })}
      </div>

      <div className="psm-legend">
        <span className="psm-legend-label">Legend:</span>
        {loops.map((loop) => (
          <span key={loop} className="psm-legend-item">
            <span className="psm-legend-dot" style={{ background: LOOP_COLORS[loop] ?? 'var(--rust)' }} />
            Loop {loop}
          </span>
        ))}
        <span className="psm-legend-item">
          <span className="psm-legend-dot" style={{ background: 'var(--muted,#999)', opacity: 0.35 }} />
          Unavailable
        </span>
      </div>

      {activeSite && (
        <SiteDetailModal
          site={activeSite}
          onClose={() => setActiveSiteId(null)}
          fallbackFireflyUrl={fallbackFireflyUrl}
        />
      )}

      <style>{`
        .park-site-map {
          width: 100%;
        }
        .psm-filter-row {
          display: flex;
          gap: .5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .psm-filter-btn {
          background: #fff;
          border: 1px solid #e8e3d8;
          color: var(--text, #1f1712);
          padding: .5rem 1rem;
          border-radius: 999px;
          font-size: .85rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 160ms ease;
        }
        .psm-filter-btn:hover { border-color: var(--rust, #C4622D); }
        .psm-filter-btn.is-active {
          background: var(--rust, #C4622D);
          color: #fff;
          border-color: var(--rust, #C4622D);
        }
        .psm-canvas {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          border: 1px solid #e8e3d8;
          border-radius: 4px;
          overflow: hidden;
          background: linear-gradient(135deg, #f5efe3, #e8d8b3);
        }
        .psm-bg-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.85;
        }
        .psm-bg-fallback {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 2rem;
          text-align: center;
          color: var(--muted, #665040);
          font-size: .95rem;
        }
        .psm-bg-fallback code {
          background: #fff;
          padding: .15rem .4rem;
          border-radius: 2px;
        }
        .psm-pin {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid #fff;
          color: #fff;
          font-size: .72rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: grid;
          place-items: center;
          box-shadow: 0 2px 6px rgba(0, 0, 0, .3);
          transition: transform 120ms ease, box-shadow 120ms ease;
          padding: 0;
        }
        .psm-pin:hover,
        .psm-pin:focus-visible {
          transform: translate(-50%, -50%) scale(1.15);
          box-shadow: 0 6px 14px rgba(0, 0, 0, .4);
          outline: none;
          z-index: 2;
        }
        .psm-pin.is-unavailable { cursor: default; }
        .psm-pin-label {
          line-height: 1;
        }
        .psm-legend {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-top: 1rem;
          font-size: .85rem;
          color: var(--muted, #665040);
        }
        .psm-legend-label { font-weight: 500; color: var(--text, #1f1712); }
        .psm-legend-item {
          display: inline-flex;
          align-items: center;
          gap: .4rem;
        }
        .psm-legend-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, .9);
          display: inline-block;
        }
      `}</style>
    </div>
  );
}

function SiteDetailModal({ site, onClose, fallbackFireflyUrl }: { site: ParkSite; onClose: () => void; fallbackFireflyUrl: string }) {
  const bookHref = site.firefly_deep_link || fallbackFireflyUrl;
  const isExternal = /^https?:/i.test(bookHref);
  const color = LOOP_COLORS[site.loop] ?? '#C4622D';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`site-modal-title-${site.id}`}
      className="psm-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="psm-modal">
        <button type="button" onClick={onClose} aria-label="Close" className="psm-modal-close">&times;</button>

        {site.hero_image_url && (
          <div className="psm-modal-visual">
            <img src={site.hero_image_url} alt={`Site ${site.site_number}`} />
          </div>
        )}

        <div className="psm-modal-body">
          <div className="psm-modal-eyebrow" style={{ color }}>Loop {site.loop}</div>
          <h3 id={`site-modal-title-${site.id}`} className="psm-modal-title">Site {site.site_number}</h3>

          <div className="psm-modal-specs">
            {site.site_type && <div><span>Type</span><strong>{site.site_type}</strong></div>}
            {(site.length_feet || site.width_feet) && (
              <div><span>Dimensions</span><strong>{site.length_feet ? `${site.length_feet}' L` : '—'}{site.length_feet && site.width_feet ? ' × ' : ''}{site.width_feet ? `${site.width_feet}' W` : ''}</strong></div>
            )}
            <div><span>Access</span><strong>{site.pull_through ? 'Pull-through' : 'Back-in'}</strong></div>
            {site.amp_service && <div><span>Amp service</span><strong>{site.amp_service}-amp</strong></div>}
            {site.nightly_rate && <div><span>Rate</span><strong>${site.nightly_rate.toFixed(2)}/night</strong></div>}
          </div>

          {site.features.length > 0 && (
            <div className="psm-modal-features">
              {site.features.map((f) => (
                <span key={f} className="psm-modal-feature">{f}</span>
              ))}
            </div>
          )}

          {site.description && <p className="psm-modal-desc">{site.description}</p>}

          {site.is_available ? (
            <a
              href={bookHref}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="psm-modal-book"
            >
              Book this site &rarr;
            </a>
          ) : (
            <div className="psm-modal-unavailable">
              This site is currently unavailable.
              <a href={fallbackFireflyUrl} target="_blank" rel="noopener noreferrer">See other available dates &rarr;</a>
            </div>
          )}

          {!site.firefly_deep_link && (
            <p className="psm-modal-note">
              You'll select this site on the next screen.
            </p>
          )}
        </div>
      </div>

      <style>{`
        .psm-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(8, 6, 3, 0.7);
          display: grid;
          place-items: center;
          z-index: 1000;
          padding: 1rem;
          backdrop-filter: blur(4px);
        }
        .psm-modal {
          background: #fff;
          border-radius: 6px;
          max-width: 520px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 40px 80px rgba(0, 0, 0, .5);
        }
        .psm-modal-close {
          position: absolute;
          top: .5rem;
          right: .75rem;
          background: rgba(255, 255, 255, .9);
          border: 1px solid #e8e3d8;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 1.4rem;
          cursor: pointer;
          display: grid;
          place-items: center;
          z-index: 2;
          line-height: 1;
          color: var(--text, #1f1712);
        }
        .psm-modal-visual {
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #f5efe3, #e8d8b3);
          overflow: hidden;
        }
        .psm-modal-visual img { width: 100%; height: 100%; object-fit: cover; }
        .psm-modal-body { padding: 1.5rem 1.75rem 2rem; }
        .psm-modal-eyebrow {
          font-size: .72rem;
          text-transform: uppercase;
          letter-spacing: .16em;
          font-weight: 500;
          margin-bottom: .3rem;
        }
        .psm-modal-title {
          font-family: var(--serif, Georgia, serif);
          font-size: 1.8rem;
          margin: 0 0 1rem;
          color: var(--text, #1f1712);
        }
        .psm-modal-specs {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: .8rem;
          margin-bottom: 1rem;
        }
        .psm-modal-specs > div {
          padding: .7rem .85rem;
          background: #fafaf7;
          border-radius: 3px;
        }
        .psm-modal-specs span {
          display: block;
          font-size: .68rem;
          text-transform: uppercase;
          letter-spacing: .14em;
          color: var(--muted, #665040);
          margin-bottom: .2rem;
        }
        .psm-modal-specs strong {
          font-family: var(--serif, Georgia, serif);
          font-weight: 400;
          font-size: 1.05rem;
          color: var(--text, #1f1712);
        }
        .psm-modal-features {
          display: flex;
          flex-wrap: wrap;
          gap: .4rem;
          margin-bottom: 1rem;
        }
        .psm-modal-feature {
          background: #fff;
          border: 1px solid #e8e3d8;
          padding: .22rem .6rem;
          border-radius: 999px;
          font-size: .78rem;
          color: var(--text, #1f1712);
        }
        .psm-modal-desc {
          color: var(--muted, #665040);
          font-size: .9rem;
          line-height: 1.55;
          margin: 0 0 1.25rem;
        }
        .psm-modal-book {
          display: block;
          background: var(--rust, #C4622D);
          color: #fff;
          text-align: center;
          padding: .85rem 1.2rem;
          border-radius: 3px;
          text-decoration: none;
          font-size: .95rem;
          letter-spacing: .04em;
          transition: background 160ms ease;
        }
        .psm-modal-book:hover { background: #a14d1f; }
        .psm-modal-unavailable {
          background: #fafaf7;
          border-left: 3px solid var(--muted);
          padding: 1rem 1.1rem;
          border-radius: 3px;
          font-size: .88rem;
          color: var(--muted);
          line-height: 1.5;
        }
        .psm-modal-unavailable a {
          display: block;
          margin-top: .5rem;
          color: var(--rust, #C4622D);
          text-decoration: none;
        }
        .psm-modal-note {
          text-align: center;
          font-size: .75rem;
          color: var(--muted, #665040);
          margin: .75rem 0 0;
        }
      `}</style>
    </div>
  );
}
