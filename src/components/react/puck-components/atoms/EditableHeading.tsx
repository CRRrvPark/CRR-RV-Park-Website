/**
 * EditableHeading — block-level heading atom for the V4 visual editor.
 *
 * Each heading on a page is its own Puck component: one click in the canvas
 * opens the right panel with just this atom's fields (text, level, italic,
 * optional line-break italic segment, className hook).
 *
 * The `line2Italic` field preserves the HeroSection two-line pattern
 * (`{line1}<br/><em>{line2}</em>`) inside a single `<h1>` so the migrated
 * hero output remains byte-identical to the legacy flat-prop renderer.
 *
 * `className` keeps the section-specific CSS hook (e.g. `hero-hl`, `st`)
 * so downstream CSS does not need to change.
 */

import type { ComponentConfig } from '@puckeditor/core';
import { createElement } from 'react';

export interface EditableHeadingProps {
  text?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  italic?: boolean;
  line2Italic?: string;
  className?: string;
}

export const EditableHeading: ComponentConfig = {
  label: 'Heading',
  defaultProps: {
    text: 'Heading',
    level: 2,
    italic: false,
    line2Italic: '',
    className: '',
  },
  fields: {
    text: { type: 'text', label: 'Text' },
    level: {
      type: 'select',
      label: 'Level',
      options: [
        { label: 'H1', value: 1 },
        { label: 'H2', value: 2 },
        { label: 'H3', value: 3 },
        { label: 'H4', value: 4 },
        { label: 'H5', value: 5 },
        { label: 'H6', value: 6 },
      ],
    },
    italic: {
      type: 'radio',
      label: 'Italic (whole heading)',
      options: [
        { label: 'No', value: false },
        { label: 'Yes', value: true },
      ],
    },
    line2Italic: { type: 'text', label: 'Italic line 2 (optional — hero two-line pattern)' },
    className: { type: 'text', label: 'CSS class (leave blank for default)' },
  },
  render: ({ text, level, italic, line2Italic, className, puck }: any) => {
    const tag = `h${level || 2}`;
    const body = italic && !line2Italic
      ? createElement('em', null, text)
      : (line2Italic
        ? createElement('span', null, text, createElement('br'), createElement('em', null, line2Italic))
        : text);
    return createElement(
      tag,
      { ref: puck?.dragRef, className: className || undefined },
      body
    );
  },
};
