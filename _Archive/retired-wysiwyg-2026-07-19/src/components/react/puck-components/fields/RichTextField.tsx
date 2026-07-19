/**
 * RichTextField — Puck custom-field adapter around the shared RichTextEditor.
 *
 * Replaces Puck's built-in `type: 'richtext'` (which only supports B/I/link)
 * with the full Tiptap-powered editor: fonts, colors, sizes, alignment,
 * headings, lists, quotes, highlight, emoji, case transforms, and more.
 *
 * Usage in a Puck component config:
 *   body: richTextField('Body text')
 */

import type { CustomField } from '@puckeditor/core';
import { RichTextEditor } from '../../editors/RichTextEditor';

interface RTFProps {
  field: { label?: string };
  value: string;
  onChange: (value: string) => void;
  name: string;
  id: string;
}

function PuckRichTextField({ field, value, onChange, id }: RTFProps) {
  return (
    <RichTextEditor
      id={id}
      label={field.label}
      value={value ?? ''}
      onChange={onChange}
      minHeight={140}
    />
  );
}

export function richTextField(label?: string): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: PuckRichTextField as any,
  };
}
