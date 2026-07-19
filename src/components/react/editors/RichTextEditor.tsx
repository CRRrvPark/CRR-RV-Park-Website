/**
 * Lightweight HTML field for operational area-guide records.
 *
 * The retired page WYSIWYG used Tiptap. Operational records still need a
 * description field, so this deliberately uses a transparent textarea:
 * plain text is valid, and trusted staff may enter limited HTML when needed.
 */

interface Props {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  placeholder?: string;
  minHeight?: number;
  id?: string;
}

export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder = 'Enter a clear description. Basic HTML is allowed.',
  minHeight = 160,
  id,
}: Props) {
  return (
    <label htmlFor={id} style={{ display: 'grid', gap: 8 }}>
      {label && <span className="field-label">{label}</span>}
      <textarea
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          minHeight,
          width: '100%',
          resize: 'vertical',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--c-surface)',
          color: 'var(--c-text)',
          padding: 'var(--sp-3)',
          font: 'inherit',
          lineHeight: 1.55,
        }}
      />
      <small className="text-muted">Direct field—no visual-editor formatting layer.</small>
    </label>
  );
}
