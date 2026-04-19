/**
 * BuilderStylePanel — global style controls for the page builder.
 *
 * Provides: primary color, accent color, font family, and section
 * padding scale. Values are stored in the Puck root props and applied
 * as CSS custom properties on the rendered page via a <style> block.
 *
 * The panel is a collapsible sidebar that integrates alongside the
 * builder's existing panels.
 */

import { useState, useCallback, useEffect } from 'react';
import { IconClose } from './ui/Icon';
import { Button } from './ui/Button';

/** Curated list of web-safe + Google font families. */
const FONT_OPTIONS = [
  { label: 'Default (System UI)', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Cormorant Garamond (Serif)', value: "'Cormorant Garamond', serif" },
  { label: 'Playfair Display (Serif)', value: "'Playfair Display', serif" },
  { label: 'Lora (Serif)', value: "'Lora', serif" },
  { label: 'Merriweather (Serif)', value: "'Merriweather', serif" },
  { label: 'Inter (Sans)', value: "'Inter', sans-serif" },
  { label: 'DM Sans (Sans)', value: "'DM Sans', sans-serif" },
  { label: 'Open Sans (Sans)', value: "'Open Sans', sans-serif" },
  { label: 'Montserrat (Sans)', value: "'Montserrat', sans-serif" },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
];

export interface GlobalStyles {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  sectionPadding: number; // multiplier: 0.5 to 2
}

export const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  primaryColor: '#2c3e2d',
  accentColor: '#c4622d',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  sectionPadding: 1,
};

interface Props {
  styles: GlobalStyles;
  onChange: (styles: GlobalStyles) => void;
  onClose: () => void;
}

export function BuilderStylePanel({ styles, onChange, onClose }: Props) {
  const update = <K extends keyof GlobalStyles>(key: K, value: GlobalStyles[K]) => {
    onChange({ ...styles, [key]: value });
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
        <h3 className="card-title" style={{ margin: 0 }}>Global Styles</h3>
        <button className="icon-btn" onClick={onClose} title="Close style panel">
          <IconClose size={18} />
        </button>
      </div>

      {/* Primary Color */}
      <div className="form-field">
        <label className="form-label">Primary Color</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <input
            type="color"
            value={styles.primaryColor}
            onChange={(e) => update('primaryColor', e.target.value)}
            style={{ width: 40, height: 32, border: '1px solid var(--c-border)', borderRadius: 4, padding: 0, cursor: 'pointer' }}
          />
          <input
            type="text"
            className="input"
            value={styles.primaryColor}
            onChange={(e) => update('primaryColor', e.target.value)}
            placeholder="#2c3e2d"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 'var(--fs-sm)' }}
          />
        </div>
        <div className="form-hint">Used for headers, nav, footer backgrounds</div>
      </div>

      {/* Accent Color */}
      <div className="form-field">
        <label className="form-label">Accent Color</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <input
            type="color"
            value={styles.accentColor}
            onChange={(e) => update('accentColor', e.target.value)}
            style={{ width: 40, height: 32, border: '1px solid var(--c-border)', borderRadius: 4, padding: 0, cursor: 'pointer' }}
          />
          <input
            type="text"
            className="input"
            value={styles.accentColor}
            onChange={(e) => update('accentColor', e.target.value)}
            placeholder="#c4622d"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 'var(--fs-sm)' }}
          />
        </div>
        <div className="form-hint">Buttons, links, highlights</div>
      </div>

      {/* Font Family */}
      <div className="form-field">
        <label className="form-label">Font Family</label>
        <select
          className="select"
          value={styles.fontFamily}
          onChange={(e) => update('fontFamily', e.target.value)}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="form-hint">Applies to headings and body text</div>
      </div>

      {/* Section Padding Scale */}
      <div className="form-field">
        <label className="form-label">
          Section Padding Scale: {(styles.sectionPadding * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={styles.sectionPadding}
          onChange={(e) => update('sectionPadding', parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--c-muted)' }}>
          <span>Compact</span>
          <span>Normal</span>
          <span>Spacious</span>
        </div>
      </div>

      {/* Preview swatch */}
      <div
        style={{
          padding: 'var(--sp-3)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--c-border)',
          background: 'var(--c-surface-muted, #fafafa)',
        }}
      >
        <div className="text-xs text-muted" style={{ marginBottom: 'var(--sp-2)' }}>Preview</div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 4,
              background: styles.primaryColor,
            }}
            title="Primary"
          />
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 4,
              background: styles.accentColor,
            }}
            title="Accent"
          />
          <div
            style={{
              flex: 1,
              fontFamily: styles.fontFamily,
              fontSize: 'var(--fs-sm)',
              color: styles.primaryColor,
            }}
          >
            Sample heading text
          </div>
        </div>
      </div>

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ ...DEFAULT_GLOBAL_STYLES })}
      >
        Reset to Defaults
      </Button>
    </aside>
  );
}

/**
 * Generates a <style> string from global styles that can be injected
 * into the page preview. Called by the render layer.
 */
export function globalStylesCSS(gs: GlobalStyles): string {
  return `
    :root {
      --builder-primary: ${gs.primaryColor};
      --builder-accent: ${gs.accentColor};
      --builder-font: ${gs.fontFamily};
      --builder-padding-scale: ${gs.sectionPadding};
    }
  `;
}
