/**
 * SectionTypePicker — modal for picking a section type to add to a page.
 *
 * Sections are grouped by category for browsability.
 */

import { SECTION_TYPES, CATEGORY_LABELS, type SectionType } from '@lib/section-types';
import { Modal } from './ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (type: string) => void;
  busy?: boolean;
}

export function SectionTypePicker({ open, onClose, onPick, busy }: Props) {
  const grouped: Record<string, SectionType[]> = {};
  for (const t of SECTION_TYPES) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }
  const orderedCategories = Object.keys(CATEGORY_LABELS).filter((c) => grouped[c]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Add a section"
      size="lg"
    >
      <p className="text-muted text-sm" style={{ marginTop: 0, marginBottom: 'var(--sp-4)' }}>
        Pick a section template. It'll be added with placeholder content that
        you can edit afterwards.
      </p>

      {orderedCategories.map((cat) => (
        <div key={cat} style={{ marginBottom: 'var(--sp-6)' }}>
          <div className="card-eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>
            {CATEGORY_LABELS[cat]}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 'var(--sp-2)',
          }}>
            {grouped[cat].map((t) => (
              <button
                key={t.type}
                type="button"
                disabled={busy}
                onClick={() => onPick(t.type)}
                style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  padding: 'var(--sp-3) var(--sp-4)',
                  cursor: busy ? 'wait' : 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 120ms, background 120ms, transform 120ms',
                }}
                onMouseEnter={(e) => {
                  if (!busy) {
                    e.currentTarget.style.borderColor = 'var(--c-rust)';
                    e.currentTarget.style.background = 'var(--c-rust-soft)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!busy) {
                    e.currentTarget.style.borderColor = 'var(--c-border)';
                    e.currentTarget.style.background = 'var(--c-surface)';
                  }
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--sp-1)' }}>{t.icon}</div>
                <div style={{ fontWeight: 500, fontSize: 'var(--fs-md)' }}>{t.name}</div>
                <div className="text-xs text-muted" style={{ marginTop: 4, lineHeight: 1.45 }}>
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}
