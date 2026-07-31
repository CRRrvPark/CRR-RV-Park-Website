/**
 * EditableRichText — Tiptap-powered rich text editor.
 *
 * Click to enter edit mode; a static inline toolbar appears with
 * bold / italic / link / bullet list. Click outside to save.
 * Banned-word warning shown below editor.
 *
 * NOTE: Uses a static toolbar (rendered in normal React tree) rather than
 * Tiptap's BubbleMenu. BubbleMenu uses tippy.js which manages DOM nodes
 * outside React's control; unmounting BubbleMenu on state transitions can
 * cause "Node.removeChild: The node to be removed is not a child of this
 * node" DOMExceptions that unmount the parent component via error boundary.
 */

import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { apiPatch } from '../api-client';
import { useToast } from '../Toast';
import { findBannedWords } from '@lib/content';

interface Props {
  blockId: string;
  value: string | null;
  label?: string;
  onSaved?: (next: string) => void;
}

export function EditableRichText({ blockId, value, label, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<{ word: string; index: number }[]>([]);
  const { toast } = useToast();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,    // we control headings at the section level, not inside blocks
        codeBlock: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value ?? '',
    editable: editing,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setWarnings(findBannedWords(text));
    },
  });

  // Sync external value changes only when the `value` prop itself changes
  // (e.g. initial load, another editor saved via real-time). Do NOT reset on
  // editing-state transitions — that would revert the user's just-saved edit,
  // because the parent component doesn't re-fetch after save, so `value` is
  // stale while `editor.getHTML()` holds the fresh content.
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    // Tiptap normalizes empty content to "<p></p>"; treat those as equivalent
    const incoming = value ?? '';
    const normalized = incoming === '' ? '<p></p>' : incoming;
    if (normalized !== currentHtml) {
      editor.commands.setContent(incoming, false);
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editing);
  }, [editing, editor]);

  const save = async () => {
    if (!editor) return;
    // Tiptap always wraps edited content in <p>...</p>. For single-paragraph
    // content, strip the wrapper so the saved HTML inserts cleanly into any
    // rendering context (including existing <p class="..."> containers on
    // the public page). render-time pickHtml() has the same safeguard for
    // legacy data that was saved before this stripping logic was added.
    let next = editor.getHTML();
    const singleP = next.match(/^\s*<p>([\s\S]*?)<\/p>\s*$/);
    if (singleP && !/<p\b/i.test(singleP[1])) next = singleP[1];

    if (next === value) { setEditing(false); return; }
    if (warnings.length > 0) {
      toast.error('Banned word detected', { detail: warnings.map(w => w.word).join(', ') });
      return;
    }
    setSaving(true);
    try {
      await apiPatch('/api/content/blocks', { blockId, value_html: next });
      onSaved?.(next);
      setEditing(false);
      toast.success(label ? `Saved: ${label}` : 'Saved');
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        save();
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [editing, editor]);

  const outerStyle: React.CSSProperties = {
    position: 'relative',
    padding: 6,
    border: editing
      ? (warnings.length > 0 ? '2px solid #C0392B' : '2px solid #C4622D')
      : '1px dashed transparent',
    borderRadius: 3,
    cursor: editing ? 'text' : 'pointer',
    background: saving ? '#f4f0e8' : 'transparent',
    transition: 'border-color 120ms',
  };

  return (
    <div
      ref={wrapperRef}
      style={outerStyle}
      onClick={() => { if (!editing) setEditing(true); }}
      onMouseEnter={(e) => { if (!editing) e.currentTarget.style.borderColor = '#C4622D'; }}
      onMouseLeave={(e) => { if (!editing) e.currentTarget.style.borderColor = 'transparent'; }}
    >
      {editor && editing && (
        <div style={{
          display: 'flex',
          gap: 4,
          background: '#1E1008',
          padding: 4,
          borderRadius: 4,
          marginBottom: 6,
          width: 'fit-content',
        }}>
          <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
          <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarButton>
          <ToolbarButton active={editor.isActive('link')} onClick={() => {
            const prev = editor.getAttributes('link').href;
            const url = window.prompt('Link URL', prev ?? '');
            if (url === null) return;
            if (url === '') editor.chain().focus().unsetLink().run();
            else editor.chain().focus().setLink({ href: url }).run();
          }}>🔗</ToolbarButton>
          <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
      {warnings.length > 0 && (
        <div style={{ fontSize: '.75rem', color: '#C0392B', marginTop: 4 }}>
          ⚠ Banned word: {warnings.map(w => `"${w.word}"`).join(', ')}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        background: active ? '#C4622D' : 'transparent',
        color: 'white',
        border: 'none',
        padding: '4px 8px',
        borderRadius: 2,
        cursor: 'pointer',
        minWidth: 28,
        fontSize: 13,
        fontWeight: 600,
      }}
    >{children}</button>
  );
}
