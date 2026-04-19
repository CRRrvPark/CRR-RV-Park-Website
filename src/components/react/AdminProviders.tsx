/**
 * AdminProviders — composes all the context providers the admin UI needs.
 *
 * Every React island in the admin should wrap its content in this component.
 */

import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          {children}
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
