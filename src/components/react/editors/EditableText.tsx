/**
 * EditableText — inline editable plain text field.
 *
 * Click to enter edit mode, blur to save (or Ctrl+Enter). Shows save spinner.
 * Banned-word warning displayed inline if server rejects the value.
 */

import { useState, useRef, useEffect } from 'react';
import { apiPatch } from '../api-client';
import { useToast } from '../Toast';
import { findBannedWords } from '@lib/content';

interface Props {
  blockId: string;
  value: string | null;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  label?: string;
  onSaved?: (next: string) => void;
}

export function EditableText({ blockId, value, multiline = false, placeholder, maxLength, label, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<{ word: string; index: number }[]>([]);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('setSelectionRange' in inputRef.current) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [editing]);

  useEffect(() => {
    setWarnings(findBannedWords(draft));
  }, [draft]);

  const save = async () => {
    if (draft === value) { setEditing(false); return; }
    if (warnings.length > 0) {
      toast.error('Banned word detected', { detail: warnings.map(w => w.word).join(', ') });
      return;
    }
    setSaving(true);
    try {
      await apiPatch('/api/content/blocks', { blockId, value_text: draft });
      onSaved?.(draft);
      setEditing(false);
      toast.success(label ? `Saved: ${label}` : 'Saved');
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
        style={{
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 2,
          border: '1px dashed transparent',
          transition: 'border-color 120ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#C4622D')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      >
        {/* Display `draft` (the local edit buffer) instead of `value` so a just-saved
            edit stays visible after editing=false. The parent doesn't re-fetch on
            save, so `value` would be stale and cause the UI to revert.
            The useEffect at the top syncs draft←value on external prop changes. */}
        {draft || <span style={{ color: '#9a8b7c', fontStyle: 'italic' }}>{placeholder ?? '(empty — click to edit)'}</span>}
      </div>
    );
  }

  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div style={{ position: 'relative' }}>
      <Tag
        // @ts-expect-error — polymorphic ref
        ref={inputRef}
        type={multiline ? undefined : 'text'}
        value={draft}
        onChange={(e: any) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e: any) => {
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
          if (!multiline && e.key === 'Enter') save();
        }}
        maxLength={maxLength}
        style={{
          width: '100%',
          padding: '6px 10px',
          border: warnings.length > 0 ? '2px solid #C0392B' : '2px solid #C4622D',
          borderRadius: 3,
          fontFamily: 'inherit',
          fontSize: 'inherit',
          minHeight: multiline ? 80 : undefined,
          resize: multiline ? 'vertical' : undefined,
          background: saving ? '#f4f0e8' : 'white',
        }}
        disabled={saving}
      />
      {warnings.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: -22,
          left: 0,
          fontSize: '.75rem',
          color: '#C0392B',
        }}>
          ⚠ Banned word: {warnings.map(w => `"${w.word}"`).join(', ')}
        </div>
      )}
    </div>
  );
}
