/**
 * EditableButton — block-level link/button atom for the V4 visual editor.
 *
 * Every CTA on the page is its own atom: one click opens label + URL +
 * variant fields. The `variant` maps to existing public-site CSS classes:
 *   primary   → `btn-p`  (hero, section CTAs)
 *   secondary → `btn-g`  (hero secondary, etc.)
 *   ghost     → `btn-o`  (optional ghost variant)
 *   custom    → pass-through: use `className` instead
 *
 * URL field uses the shared LinkPicker (same UX as V3.1 field-level pickers).
 *
 * `openInNewTab` is opt-in (default false) — the legacy hero renderer never
 * emitted target/rel on CTAs, so migrated data must stay that way to keep
 * HTML byte-identical. Editors can flip the flag per-button if desired.
 */

import type { ComponentConfig } from '@puckeditor/core';
import { linkPickerField } from '../fields/LinkPickerField';

export interface EditableButtonProps {
  label?: string;
  url?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'custom';
  className?: string;
  openInNewTab?: boolean;
}

const VARIANT_CLASS: Record<string, string> = {
  primary: 'btn-p',
  secondary: 'btn-g',
  ghost: 'btn-o',
};

export const EditableButton: ComponentConfig = {
  label: 'Button / Link',
  defaultProps: {
    label: 'Click me',
    url: '#',
    variant: 'primary',
    className: '',
    openInNewTab: false,
  },
  fields: {
    label: { type: 'text', label: 'Label' },
    url: linkPickerField('URL'),
    variant: {
      type: 'select',
      label: 'Variant',
      options: [
        { label: 'Primary (btn-p)', value: 'primary' },
        { label: 'Secondary (btn-g)', value: 'secondary' },
        { label: 'Ghost (btn-o)', value: 'ghost' },
        { label: 'Custom className', value: 'custom' },
      ],
    },
    className: { type: 'text', label: 'Custom CSS class (only used when Variant = Custom)' },
    openInNewTab: {
      type: 'radio',
      label: 'Open in new tab',
      options: [
        { label: 'No', value: false },
        { label: 'Yes', value: true },
      ],
    },
  },
  render: ({ label, url, variant, className, openInNewTab, puck }: any) => {
    const cls = variant === 'custom'
      ? (className || undefined)
      : (VARIANT_CLASS[variant as string] || 'btn-p');
    return (
      <a
        ref={puck?.dragRef}
        className={cls}
        href={url || '#'}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
      >
        {label}
      </a>
    );
  },
};
