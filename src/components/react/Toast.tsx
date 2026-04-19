/**
 * Toast — lightweight notification system built on the admin design system.
 *
 *   <ToastProvider>
 *     <App />
 *   </ToastProvider>
 *
 *   const { toast } = useToast();
 *   toast.success('Saved');
 *   toast.error('Failed to save', { detail: err.message });
 *
 * Toasts auto-dismiss after 5s (success/info) or 8s (error/warning).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconClose, IconCheck, IconAlert, IconHelp } from './ui/Icon';

type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
}

interface ToastApi {
  success: (message: string, opts?: { detail?: string }) => void;
  error: (message: string, opts?: { detail?: string }) => void;
  warning: (message: string, opts?: { detail?: string }) => void;
  info: (message: string, opts?: { detail?: string }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<{ toast: ToastApi } | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((x) => x.id !== id));
    const t = timeoutsRef.current.get(id);
    if (t) { clearTimeout(t); timeoutsRef.current.delete(id); }
  }, []);

  const add = useCallback((kind: ToastKind, message: string, detail?: string) => {
    const id = nextId++;
    setItems((cur) => [...cur, { id, kind, message, detail }]);
    const duration = kind === 'error' || kind === 'warning' ? 8000 : 5000;
    timeoutsRef.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [dismiss]);

  // Memoize so the identity is stable across renders — otherwise consumers
  // that put `toast` in a useCallback/useEffect dep array loop forever.
  const toast: ToastApi = useMemo(() => ({
    success: (m, o) => add('success', m, o?.detail),
    error: (m, o) => add('error', m, o?.detail),
    warning: (m, o) => add('warning', m, o?.detail),
    info: (m, o) => add('info', m, o?.detail),
    dismiss,
  }), [add, dismiss]);

  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);

  const ctxValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="toast-stack">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`toast ${t.kind === 'success' ? 'is-success' : t.kind === 'error' ? 'is-error' : t.kind === 'warning' ? 'is-warning' : ''}`}
            onClick={() => dismiss(t.id)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
              <span style={{ color: iconColorFor(t.kind), marginTop: 2 }}>
                {t.kind === 'success' ? <IconCheck size={16} /> :
                 t.kind === 'error' ? <IconAlert size={16} /> :
                 t.kind === 'warning' ? <IconAlert size={16} /> :
                 <IconHelp size={16} />}
              </span>
              <div style={{ flex: 1 }}>
                <div className="toast-title">{t.message}</div>
                {t.detail && <div className="toast-body">{t.detail}</div>}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                aria-label="Dismiss notification"
                className="icon-btn"
                style={{ width: 24, height: 24, color: 'var(--c-text-muted)' }}
              ><IconClose size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): { toast: ToastApi } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function iconColorFor(kind: ToastKind): string {
  switch (kind) {
    case 'success': return 'var(--c-success)';
    case 'error': return 'var(--c-danger)';
    case 'warning': return 'var(--c-warning)';
    case 'info': return 'var(--c-info)';
  }
}
