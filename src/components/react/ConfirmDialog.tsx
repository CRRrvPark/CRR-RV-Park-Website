/**
 * ConfirmDialog — programmatic confirm() replacement with proper styling +
 * keyboard handling. Built on the admin design system.
 *
 * Usage:
 *   const { confirm } = useConfirm();
 *   const ok = await confirm({ title: 'Delete?', message: '...', danger: true });
 *   if (ok) { ... }
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ConfirmModal } from './ui/Modal';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOpts(options);
      setResolver(() => resolve);
    });
  }, []);

  const resolve = (ok: boolean) => {
    if (resolver) resolver(ok);
    setOpts(null);
    setResolver(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        open={!!opts}
        title={opts?.title ?? ''}
        message={opts?.message}
        confirmLabel={opts?.confirmLabel}
        cancelLabel={opts?.cancelLabel}
        danger={opts?.danger}
        onConfirm={() => resolve(true)}
        onCancel={() => resolve(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
