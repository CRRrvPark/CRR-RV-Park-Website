import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconSpinner } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  leading,
  trailing,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button {...rest} disabled={disabled || loading} className={classes}>
      {loading ? <IconSpinner size={size === 'sm' ? 14 : 16} /> : leading}
      {children}
      {!loading && trailing}
    </button>
  );
}
