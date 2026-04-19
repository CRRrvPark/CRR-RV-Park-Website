/**
 * RichTextEditor — controlled Tiptap-based rich text editor for admin forms.
 *
 * Unlike EditableRichText (inline click-to-edit against /api/content/blocks),
 * this is a standard form field: pass `value` + `onChange`, get an always-
 * visible toolbar. Serializes as HTML.
 *
 * Toolbar covers bold/italic/underline/strikethrough, H2/H3, bullet & ordered
 * lists, blockquote, horizontal rule, link, text color, highlight, text-align,
 * font family, font size, and an emoji picker. "Clear formatting" strips all
 * marks from the current selection.
 */

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { LinkPicker } from './LinkPicker';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';

// ---- Custom FontSize extension (Tiptap core doesn't ship one) -------------

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [
      {
        types: (this.options as any).types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize?.replace(/['"]/g, '') || null,
            renderHTML: (attrs: { fontSize?: string | null }) =>
              !attrs.fontSize ? {} : { style: `font-size: ${attrs.fontSize}` },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

// ---- Palette / option constants -------------------------------------------

const COLORS = [
  '#000000', '#1E1008', '#4A4A4A', '#8E8E8E', '#C0C0C0', '#FFFFFF',
  '#C4622D', '#D4A853', '#4A7C59', '#2E6B8F', '#6A3E8C', '#C0392B',
];

const HIGHLIGHTS = ['#FFF59D', '#F8BBD0', '#C5E1A5', '#B3E5FC', '#FFE0B2', '#D1C4E9'];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Serif (brand)', value: 'var(--serif)' },
  { label: 'Sans (brand)', value: 'var(--sans)' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Courier', value: '"Courier New", monospace' },
];

const FONT_SIZES = [
  { label: 'Default', value: '' },
  { label: 'Small', value: '0.85rem' },
  { label: 'Normal', value: '1rem' },
  { label: 'Large', value: '1.25rem' },
  { label: 'X-Large', value: '1.5rem' },
  { label: 'Huge', value: '2rem' },
];

const EMOJIS = [
  '😀', '😂', '😍', '🤔', '👍', '👏', '🙌', '🎉', '🔥', '⭐', '❤️', '✅',
  '🏕', '🥾', '🏞', '🌲', '🌄', '🌊', '☀️', '🌙', '🐾', '🐕', '🦌', '🦅',
  '🚐', '🛻', '🎣', '🚴', '🎸', '🍺', '☕', '🍔', '📍', '🗺', '📞', '📧',
];

// ---- Component -------------------------------------------------------------

interface Props {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  placeholder?: string;
  minHeight?: number;
  id?: string;
}

export function RichTextEditor({ value, onChange, label, minHeight = 160, id }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [openPanel, setOpenPanel] = useState<null | 'color' | 'highlight' | 'emoji' | 'link'>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontFamily,
      FontSize,
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // Tiptap serialises empty content as "<p></p>". Save empty string in
      // that case so DB rows stay NULL-clean and renderers can skip them.
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Keep the editor in sync when the parent resets the value (e.g. form load)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '<p></p>';
    if (incoming !== current) editor.commands.setContent(value || '', false);
  }, [value, editor]);

  // Close any open popover on outside click
  useEffect(() => {
    if (!openPanel) return;
    const h = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [openPanel]);

  if (!editor) return null;

  const transformCase = (fn: (s: string) => string) => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, '\n');
    editor.chain().focus().insertContentAt({ from, to }, fn(text)).run();
  };

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
      {label && <label style={{ fontSize: '.78rem', letterSpacing: '.05em', color: 'var(--c-text-muted, #6b6b6b)' }}>{label}</label>}

      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        style={{
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'center',
          rowGap: 4,
          padding: 6,
          background: '#f5f1ea',
          border: '1px solid #d8ccb7',
          borderTopLeftRadius: 4, borderTopRightRadius: 4,
          borderBottom: 'none',
          position: 'relative',
        }}
      >
        <ToolGroup>
          <TB active={editor.isActive('bold')} title="Bold (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}>
            <strong>B</strong>
          </TB>
          <TB active={editor.isActive('italic')} title="Italic (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <em>I</em>
          </TB>
          <TB active={editor.isActive('underline')} title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <span style={{ textDecoration: 'underline' }}>U</span>
          </TB>
          <TB active={editor.isActive('strike')} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </TB>
        </ToolGroup>

        <ToolGroup>
          <TB active={editor.isActive('heading', { level: 2 })} title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</TB>
          <TB active={editor.isActive('heading', { level: 3 })} title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</TB>
        </ToolGroup>

        <ToolGroup>
          <TB active={editor.isActive('bulletList')} title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>•</TB>
          <TB active={editor.isActive('orderedList')} title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</TB>
          <TB active={editor.isActive('blockquote')} title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</TB>
          <TB title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</TB>
        </ToolGroup>

        <ToolGroup>
          <TB active={editor.isActive({ textAlign: 'left' })} title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignIcon side="left" />
          </TB>
          <TB active={editor.isActive({ textAlign: 'center' })} title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignIcon side="center" />
          </TB>
          <TB active={editor.isActive({ textAlign: 'right' })} title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignIcon side="right" />
          </TB>
        </ToolGroup>

        <ToolGroup>
          <select
            aria-label="Font family"
            value={editor.getAttributes('textStyle').fontFamily ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) editor.chain().focus().unsetFontFamily().run();
              else editor.chain().focus().setFontFamily(v).run();
            }}
            style={selectStyle}
          >
            {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
          <select
            aria-label="Font size"
            value={editor.getAttributes('textStyle').fontSize ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) (editor.chain().focus() as any).unsetFontSize().run();
              else (editor.chain().focus() as any).setFontSize(v).run();
            }}
            style={selectStyle}
          >
            {FONT_SIZES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
        </ToolGroup>

        <ToolGroup>
          <TB
            title="Text color"
            onClick={() => setOpenPanel(openPanel === 'color' ? null : 'color')}
            widthPx={32}
          >
            <ColorSwatchIcon mode="color" color={editor.getAttributes('textStyle').color || '#000000'} />
          </TB>
          <TB
            title="Highlight"
            onClick={() => setOpenPanel(openPanel === 'highlight' ? null : 'highlight')}
            widthPx={32}
          >
            <ColorSwatchIcon mode="highlight" color={editor.getAttributes('highlight').color || '#FFF59D'} />
          </TB>
          <TB
            active={editor.isActive('link')}
            title="Link"
            onClick={() => setOpenPanel(openPanel === 'link' ? null : 'link')}
          >🔗</TB>
          <TB title="Emoji" onClick={() => setOpenPanel(openPanel === 'emoji' ? null : 'emoji')}>😀</TB>
        </ToolGroup>

        <ToolGroup>
          <TB title="UPPERCASE" onClick={() => transformCase((s) => s.toUpperCase())}>AA</TB>
          <TB title="lowercase" onClick={() => transformCase((s) => s.toLowerCase())}>aa</TB>
          <TB title="Title Case" onClick={() => transformCase((s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()))}>Aa</TB>
        </ToolGroup>

        <ToolGroup>
          <TB title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>⌫</TB>
        </ToolGroup>

        {/* Popovers */}
        {openPanel === 'color' && (
          <Popover onClose={() => setOpenPanel(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { editor.chain().focus().setColor(c).run(); setOpenPanel(null); }}
                  aria-label={`Color ${c}`}
                  style={{ width: 22, height: 22, background: c, border: '1px solid #ccc', cursor: 'pointer' }}
                />
              ))}
            </div>
            <button type="button" onClick={() => { editor.chain().focus().unsetColor().run(); setOpenPanel(null); }} style={clearLinkStyle}>Clear color</button>
          </Popover>
        )}
        {openPanel === 'highlight' && (
          <Popover onClose={() => setOpenPanel(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
              {HIGHLIGHTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setOpenPanel(null); }}
                  aria-label={`Highlight ${c}`}
                  style={{ width: 22, height: 22, background: c, border: '1px solid #ccc', cursor: 'pointer' }}
                />
              ))}
            </div>
            <button type="button" onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpenPanel(null); }} style={clearLinkStyle}>Clear highlight</button>
          </Popover>
        )}
        {openPanel === 'emoji' && (
          <Popover onClose={() => setOpenPanel(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, maxWidth: 240 }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { editor.chain().focus().insertContent(e).run(); setOpenPanel(null); }}
                  style={{ background: 'transparent', border: 'none', padding: '2px 4px', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                >{e}</button>
              ))}
            </div>
          </Popover>
        )}
        {openPanel === 'link' && (
          <Popover onClose={() => setOpenPanel(null)}>
            <LinkPicker
              initialHref={editor.getAttributes('link').href ?? ''}
              initialTarget={editor.getAttributes('link').target ?? ''}
              onApply={(href, target) => {
                const attrs: Record<string, string> = { href };
                if (target) attrs.target = target;
                editor.chain().focus().extendMarkRange('link').setLink(attrs as any).run();
                setOpenPanel(null);
              }}
              onRemove={() => {
                editor.chain().focus().unsetLink().run();
                setOpenPanel(null);
              }}
              onCancel={() => setOpenPanel(null)}
            />
          </Popover>
        )}
      </div>

      {/* Content */}
      <div
        id={id}
        style={{
          border: '1px solid #d8ccb7',
          borderTop: 'none',
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          padding: '.7rem .9rem',
          minHeight,
          background: '#fff',
          fontSize: '.95rem',
          lineHeight: 1.55,
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Scoped styles for the editor surface */}
      <style>{`
        .ProseMirror { outline: none; min-height: ${minHeight - 24}px; }
        .ProseMirror p { margin: 0 0 .6rem; }
        .ProseMirror p:last-child { margin-bottom: 0; }
        .ProseMirror h2 { font-family: var(--serif, Georgia, serif); font-size: 1.4rem; margin: .4rem 0 .4rem; }
        .ProseMirror h3 { font-family: var(--serif, Georgia, serif); font-size: 1.15rem; margin: .4rem 0 .4rem; }
        .ProseMirror ul, .ProseMirror ol { margin: 0 0 .6rem 1.25rem; padding: 0; }
        .ProseMirror blockquote { border-left: 3px solid #c4622d; padding: .15rem 0 .15rem .8rem; color: #555; margin: 0 0 .6rem; }
        .ProseMirror hr { border: 0; border-top: 1px solid #d8ccb7; margin: .8rem 0; }
        .ProseMirror a { color: #c4622d; text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ---- Toolbar helpers -------------------------------------------------------

function ToolGroup({ children }: { children: React.ReactNode }) {
  // Separator is a subtle vertical rule to the right — visible when the group
  // sits mid-row, harmless when it wraps to a new line.
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      padding: '0 4px 0 0',
      marginRight: 4,
      borderRight: '1px solid #e7dec8',
    }}>{children}</div>
  );
}

function TB({
  children, active, title, onClick, widthPx,
}: { children: React.ReactNode; active?: boolean; title: string; onClick: () => void; widthPx?: number; }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        background: active ? '#c4622d' : '#fff',
        color: active ? '#fff' : '#2b1e0f',
        border: '1px solid #d8ccb7',
        borderRadius: 3,
        padding: 0,
        fontSize: 13,
        minWidth: widthPx ?? 28,
        width: widthPx,
        height: 28,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >{children}</button>
  );
}

function AlignIcon({ side }: { side: 'left' | 'center' | 'right' }) {
  // Four horizontal bars representing text lines, shifted per alignment.
  const widths = [14, 10, 12, 8];
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
      {widths.map((w, i) => {
        const x =
          side === 'left' ? 1 :
          side === 'right' ? 15 - w :
          (16 - w) / 2;
        return (
          <rect
            key={i}
            x={x}
            y={1 + i * 3.25}
            width={w}
            height={1.6}
            rx={0.6}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

function ColorSwatchIcon({ mode, color }: { mode: 'color' | 'highlight'; color: string }) {
  // "A" sitting on a colored underline bar (for text color), or "A" on top of a
  // colored background (for highlight). Mirrors the Google Docs / Word pattern
  // so the swatch and letter never overlap.
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        width: 16,
      }}
    >
      <span
        style={{
          fontWeight: 600,
          fontSize: 12,
          padding: mode === 'highlight' ? '0 2px' : 0,
          background: mode === 'highlight' ? color : 'transparent',
          color: mode === 'color' ? '#2b1e0f' : '#2b1e0f',
          borderRadius: mode === 'highlight' ? 1 : 0,
        }}
      >A</span>
      {mode === 'color' && (
        <span
          style={{
            display: 'block',
            marginTop: 2,
            width: 14,
            height: 3,
            background: color,
            border: color.toLowerCase() === '#ffffff' ? '1px solid #ccc' : 'none',
            borderRadius: 1,
          }}
        />
      )}
    </span>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #d8ccb7',
  borderRadius: 3,
  padding: '3px 6px',
  fontSize: 13,
  height: 28,
  cursor: 'pointer',
  flexShrink: 0,
};

const clearLinkStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 8,
  padding: 0,
  background: 'transparent',
  border: 'none',
  color: '#c4622d',
  fontSize: 12,
  cursor: 'pointer',
  textDecoration: 'underline',
};

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Escape closes; outside-click is handled by the parent toolbar effect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 8,
      zIndex: 50,
      background: '#fff',
      border: '1px solid #d8ccb7',
      borderRadius: 4,
      padding: 8,
      boxShadow: '0 6px 18px rgba(0,0,0,.12)',
    }}>{children}</div>
  );
}
