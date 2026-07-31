/**
 * MediaPickerField — a custom Puck field component for selecting images.
 *
 * Shows a thumbnail preview of the current image with a "Browse" button
 * that opens the MediaPickerModal. Also includes a text input fallback
 * for pasting URLs directly.
 *
 * Usage in Puck config:
 *   backgroundImageUrl: {
 *     type: 'custom',
 *     label: 'Background image',
 *     render: MediaPickerField,
 *   }
 */

import { useState } from 'react';
import { MediaPickerModal } from './MediaPickerModal';

interface FieldProps {
  field: { label?: string };
  value: string;
  onChange: (value: string) => void;
  name: string;
  id: string;
}

export function MediaPickerField({ field, value, onChange }: FieldProps) {
  const [showModal, setShowModal] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Thumbnail preview */}
      {value ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 'var(--r-md, 6px)',
            overflow: 'hidden',
            border: '1px solid var(--c-border, #e5e5e5)',
            background: '#f5f0e6',
          }}
        >
          <img
            src={value}
            alt="Selected image"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            title="Remove image"
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,.6)',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 'var(--r-md, 6px)',
            border: '2px dashed var(--c-border, #e5e5e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--c-muted, #888)',
            fontSize: 'var(--fs-sm, 0.875rem)',
            background: 'var(--c-surface-muted, #fafafa)',
          }}
        >
          No image selected
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowModal(true)}
          style={{ flex: 1, fontSize: 'var(--fs-xs, 0.75rem)' }}
        >
          Browse Media
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowUrlInput(!showUrlInput)}
          style={{ fontSize: 'var(--fs-xs, 0.75rem)' }}
        >
          {showUrlInput ? 'Hide URL' : 'Paste URL'}
        </button>
      </div>

      {/* URL text input fallback */}
      {showUrlInput && (
        <input
          type="text"
          className="input"
          placeholder="https://..."
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: 'var(--fs-xs, 0.75rem)' }}
        />
      )}

      {/* Modal */}
      <MediaPickerModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSelect={(url) => {
          onChange(url);
          setShowUrlInput(false);
        }}
      />
    </div>
  );
}
