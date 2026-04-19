/**
 * CommandPalette — Cmd/Ctrl+K launcher for jumping between admin pages.
 *
 * Fuzzy-matches the label + hint, Arrow keys to navigate, Enter to activate.
 * Items come from the AdminShell so they're always role-filtered.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconSearch } from './ui/Icon';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

export function CommandPalette({ open, onClose, items }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      (i.hint?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[active];
        if (item) { item.action(); onClose(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-label="Command palette"
      style={{ alignItems: 'flex-start', paddingTop: '8vh' }}
    >
      <div
        className="modal"
        style={{
          maxWidth: 560,
          background: 'var(--c-surface)',
          maxHeight: '70vh',
        }}
      >
        <div style={{
          padding: 'var(--sp-3) var(--sp-4)',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
        }}>
          <IconSearch size={16} />
          <input
            ref={inputRef}
            className="input"
            style={{ border: 'none', padding: 0, boxShadow: 'none', fontSize: 'var(--fs-lg)' }}
            placeholder="Type to jump to a page or action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 'var(--sp-2)' }}>
          {filtered.length === 0 && (
            <div className="text-muted" style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>
              No matches for <strong>{query}</strong>
            </div>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { item.action(); onClose(); }}
              onMouseEnter={() => setActive(i)}
              className="btn btn-ghost"
              style={{
                width: '100%', justifyContent: 'flex-start', gap: 'var(--sp-3)',
                padding: 'var(--sp-3) var(--sp-4)',
                background: active === i ? 'var(--c-surface-muted)' : 'transparent',
                fontWeight: 400,
              }}
            >
              {item.icon && <span className="text-muted">{item.icon}</span>}
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span>{item.label}</span>
                {item.hint && <span className="text-xs text-muted">{item.hint}</span>}
              </span>
            </button>
          ))}
        </div>
        <div style={{
          padding: 'var(--sp-2) var(--sp-4)',
          borderTop: '1px solid var(--c-border)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--c-text-muted)',
          display: 'flex', gap: 'var(--sp-4)',
          background: 'var(--c-surface-alt)',
        }}>
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
