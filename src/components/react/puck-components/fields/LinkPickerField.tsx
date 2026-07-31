/**
 * LinkPickerField — Puck custom field wrapping the LinkPicker popover.
 *
 * Replaces plain `type: 'text'` URL inputs on Puck component fields. Editors
 * get the same flow as the rich text link button: pick a page from this site,
 * add an optional #anchor, or enter a custom URL, including a remove action.
 *
 * The stored value is a plain href string (same shape as the old text field),
 * so no renderer changes are required. External URLs continue to
 * auto-open in a new tab via the existing startsWith('http') convention in
 * the site renderers. The target checkbox is hidden here because there's no
 * separate column to persist it.
 *
 * Usage in a Puck component config:
 *   ctaUrl: linkPickerField('CTA button URL')
 */

import { useState, useRef, useEffect } from 'react';
import type { CustomField } from '@puckeditor/core';
import { LinkPicker } from '../../editors/LinkPicker';

interface FieldProps {
  field: { label?: string };
  value: string;
  onChange: (value: string) => void;
}

function prettyHref(href: string): string {
  if (!href) return 'Not set';
  if (href.length <= 48) return href;
  return href.slice(0, 45) + '…';
}

function PuckLinkPickerField({ field, value, onChange }: FieldProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const href = value ?? '';

  // Close when clicking outside the field container.
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ marginBottom: '.5rem' }}>
      {field.label && (
        <div style={{ fontSize: '.78rem', color: '#444', marginBottom: 4, fontWeight: 500 }}>
          {field.label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div
          title={href || 'No link set'}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '5px 8px',
            border: '1px solid #d8ccb7',
            borderRadius: 3,
            fontSize: '.82rem',
            background: href ? '#fff' : '#faf6ec',
            color: href ? '#222' : '#888',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {prettyHref(href)}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: '5px 10px',
            border: '1px solid #d8ccb7',
            borderRadius: 3,
            background: open ? '#c4622d' : '#fff',
            color: open ? '#fff' : '#333',
            cursor: 'pointer',
            fontSize: '.78rem',
            whiteSpace: 'nowrap',
          }}
        >
          {href ? 'Change' : 'Set link'}
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 6,
            padding: 10,
            border: '1px solid #d8ccb7',
            borderRadius: 4,
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,.08)',
          }}
        >
          <LinkPicker
            initialHref={href}
            hideTarget
            onApply={(newHref) => {
              onChange(newHref);
              setOpen(false);
            }}
            onRemove={() => {
              onChange('');
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export function linkPickerField(label?: string): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: PuckLinkPickerField as any,
  };
}
