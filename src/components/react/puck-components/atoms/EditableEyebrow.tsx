/**
 * EditableEyebrow — block-level short-label atom for the V4 visual editor.
 *
 * Covers the small-caps elements that live above headlines: hero eyebrow
 * ("Central Oregon"), section labels above H2s ("Our Sites"), spec tags.
 * Plain text in a single element — no rich formatting — so the atom stays
 * predictable and byte-safe for the HTML-identical migration.
 *
 * `tag` lets the same atom cover `<div class="hero-eyebrow">` and
 * `<span class="section-label">` without needing two separate component
 * definitions.
 *
 * Not in the handoff's explicit Session 1 "4 atoms" list, but required
 * because the Hero has 5 distinct element types in hero-content (eyebrow,
 * headline, sub, 2x CTAs). The Scope section of the handoff does list
 * "Sub-headline / section label / eyebrow" as an atom, so this fits.
 */

import type { ComponentConfig } from '@puckeditor/core';
import { createElement } from 'react';

export interface EditableEyebrowProps {
  text?: string;
  tag?: 'div' | 'span' | 'p';
  className?: string;
}

export const EditableEyebrow: ComponentConfig = {
  label: 'Eyebrow / Label',
  defaultProps: {
    text: 'Eyebrow text',
    tag: 'div',
    className: 'hero-eyebrow',
  },
  fields: {
    text: { type: 'text', label: 'Text' },
    tag: {
      type: 'select',
      label: 'HTML tag',
      options: [
        { label: 'div', value: 'div' },
        { label: 'span', value: 'span' },
        { label: 'p', value: 'p' },
      ],
    },
    className: { type: 'text', label: 'CSS class' },
  },
  render: ({ text, tag, className, puck }: any) =>
    createElement(
      tag || 'div',
      { ref: puck?.dragRef, className: className || undefined },
      text
    ),
};
