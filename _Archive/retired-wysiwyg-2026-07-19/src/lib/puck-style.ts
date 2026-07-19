/**
 * Reusable Puck style fields — margin, padding, background, text color,
 * border, corner radius, and shadow — plus a helper to turn those prop
 * values into a React style object.
 *
 * Spread `styleFields` into any component's `fields` and spread
 * `STYLE_DEFAULTS` into `defaultProps`, then wrap the component's output
 * in a <div> (or existing outer element) with `style={computeStyle(props)}`.
 *
 * Designed so that a value of 0/empty means "use the component's own
 * default" rather than forcing every block to a zero-padding layout.
 */

import type { Field } from '@puckeditor/core';
import type { CSSProperties } from 'react';

export interface StyleProps {
  sectionId?: string;
  bgColor?: string;
  textColor?: string;
  marginTop?: number;
  marginBottom?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingX?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  shadow?: 'none' | 'soft' | 'medium' | 'strong';
}

export const STYLE_DEFAULTS: Required<StyleProps> = {
  sectionId: '',
  bgColor: '',
  textColor: '',
  marginTop: 0,
  marginBottom: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingX: 0,
  borderWidth: 0,
  borderColor: '#d8ccb7',
  borderRadius: 0,
  shadow: 'none',
};

export const styleFields: Record<keyof StyleProps, Field> = {
  sectionId: { type: 'text', label: 'Section ID (for #anchor links — leave blank if none)' },
  bgColor: { type: 'text', label: 'Background color (hex / rgba, blank = none)' },
  textColor: { type: 'text', label: 'Text color (hex, blank = inherit)' },
  marginTop: { type: 'number', label: 'Margin top (px)', min: 0, max: 400 },
  marginBottom: { type: 'number', label: 'Margin bottom (px)', min: 0, max: 400 },
  paddingTop: { type: 'number', label: 'Padding top (px, 0 = default)', min: 0, max: 400 },
  paddingBottom: { type: 'number', label: 'Padding bottom (px, 0 = default)', min: 0, max: 400 },
  paddingX: { type: 'number', label: 'Padding left/right (px, 0 = default)', min: 0, max: 400 },
  borderWidth: { type: 'number', label: 'Border width (px)', min: 0, max: 20 },
  borderColor: { type: 'text', label: 'Border color (hex)' },
  borderRadius: { type: 'number', label: 'Corner radius (px)', min: 0, max: 400 },
  shadow: {
    type: 'select',
    label: 'Shadow',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Soft', value: 'soft' },
      { label: 'Medium', value: 'medium' },
      { label: 'Strong', value: 'strong' },
    ],
  },
};

const SHADOW_MAP = {
  none: 'none',
  soft: '0 1px 3px rgba(0,0,0,.08)',
  medium: '0 4px 14px rgba(0,0,0,.12)',
  strong: '0 18px 40px rgba(0,0,0,.22)',
} as const;

/**
 * Turn a StyleProps object into a React CSSProperties patch. Empty / zero
 * values are left out so the block's own defaults still apply.
 */
export function computeStyle(p: StyleProps): CSSProperties {
  const out: CSSProperties = {};
  if (p.marginTop) out.marginTop = p.marginTop;
  if (p.marginBottom) out.marginBottom = p.marginBottom;
  if (p.paddingTop) out.paddingTop = p.paddingTop;
  if (p.paddingBottom) out.paddingBottom = p.paddingBottom;
  if (p.paddingX) { out.paddingLeft = p.paddingX; out.paddingRight = p.paddingX; }
  if (p.bgColor) out.background = p.bgColor;
  if (p.textColor) out.color = p.textColor;
  if (p.borderWidth) out.border = `${p.borderWidth}px solid ${p.borderColor || '#d8ccb7'}`;
  if (p.borderRadius) out.borderRadius = p.borderRadius;
  if (p.shadow && p.shadow !== 'none') out.boxShadow = SHADOW_MAP[p.shadow];
  return out;
}
