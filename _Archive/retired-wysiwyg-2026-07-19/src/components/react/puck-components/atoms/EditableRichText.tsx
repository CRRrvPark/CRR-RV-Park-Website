/**
 * EditableRichText — block-level rich-text atom for the V4 visual editor.
 *
 * Wraps the existing Tiptap-powered rich text editor (richTextField).
 * Used for paragraphs, subtitles, intros — any HTML content that an editor
 * should be able to click once and edit.
 *
 * `className` preserves the section-specific wrapper hook (e.g. `hero-sub`,
 * `section-body`) so migrated data produces byte-identical HTML.
 *
 * The renderer uses `dangerouslySetInnerHTML`; editor output HTML is stored
 * verbatim and emitted inside a `<div class={className}>`. Strip/escape is
 * already handled upstream in the RichTextEditor (Tiptap) — the same
 * sanitization contract as the V3 richTextField sections rely on.
 */

import type { ComponentConfig } from '@puckeditor/core';
import { richTextField } from '../fields/RichTextField';

export interface EditableRichTextProps {
  html?: string;
  className?: string;
}

export const EditableRichText: ComponentConfig = {
  label: 'Rich Text',
  defaultProps: {
    html: '<p>Type here…</p>',
    className: '',
  },
  fields: {
    html: richTextField('Content'),
    className: { type: 'text', label: 'CSS class (leave blank for default)' },
  },
  render: ({ html, className, puck }: any) => (
    <div
      ref={puck?.dragRef}
      className={className || undefined}
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  ),
};
