/**
 * EditableJson — structured list editor.
 *
 * For blocks like "trust bar items" or "site cards" that are arrays of
 * objects. The UI adapts to the shape: detect object keys, render editable
 * fields per item. Supports add/remove/reorder.
 *
 * If the shape is ambiguous, falls back to a raw JSON textarea.
 */

import { useState, useEffect } from 'react';
import { apiPatch } from '../api-client';
import { useToast } from '../Toast';

interface Props {
  blockId: string;
  value: unknown;
  label?: string;
  onSaved?: (next: unknown) => void;
}

export function EditableJson({ blockId, value, label, onSaved }: Props) {
  const [draft, setDraft] = useState<unknown>(value);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(JSON.stringify(value ?? null, null, 2));
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setDraft(value);
    setRawText(JSON.stringify(value ?? null, null, 2));
  }, [value]);

  const save = async (next: unknown) => {
    setSaving(true);
    try {
      await apiPatch('/api/content/blocks', { blockId, value_json: next });
      onSaved?.(next);
      toast.success(label ? `Saved: ${label}` : 'Saved');
    } catch (err: any) {
      toast.error('Save failed', { detail: err.message });
    } finally {
      setSaving(false);
    }
  };

  const saveRaw = async () => {
    try {
      const parsed = JSON.parse(rawText);
      setParseError(null);
      setDraft(parsed);
      await save(parsed);
    } catch (err: any) {
      setParseError(err.message);
    }
  };

  const isArrayOfObjects = Array.isArray(draft) && draft.length > 0 && typeof draft[0] === 'object' && draft[0] !== null;

  if (rawMode || !isArrayOfObjects) {
    return (
      <div style={{ border: '1px solid #d4cdbe', borderRadius: 3, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
          <span style={{ fontSize: '.75rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#665040' }}>
            Raw JSON {label && `— ${label}`}
          </span>
          {isArrayOfObjects && (
            <button type="button" onClick={() => setRawMode(false)} style={linkBtn}>Switch to list view</button>
          )}
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          style={{
            width: '100%',
            minHeight: 200,
            fontFamily: 'monospace',
            fontSize: '.85rem',
            padding: '.6rem',
            border: parseError ? '2px solid #C0392B' : '1px solid #d4cdbe',
            borderRadius: 3,
            boxSizing: 'border-box',
          }}
          disabled={saving}
        />
        {parseError && (
          <div style={{ color: '#C0392B', fontSize: '.8rem', marginTop: 4 }}>⚠ {parseError}</div>
        )}
        <button type="button" onClick={saveRaw} disabled={saving} style={saveBtn}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    );
  }

  // List view for arrays of objects
  const items = draft as Record<string, unknown>[];
  const allKeys = Array.from(new Set(items.flatMap((o) => Object.keys(o))));

  const updateItem = async (idx: number, patch: Record<string, unknown>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setDraft(next);
    await save(next);
  };

  const addItem = async () => {
    const template: Record<string, unknown> = {};
    for (const k of allKeys) template[k] = '';
    const next = [...items, template];
    setDraft(next);
    await save(next);
  };

  const removeItem = async (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setDraft(next);
    await save(next);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft(next);
    await save(next);
  };

  return (
    <div style={{ border: '1px solid #d4cdbe', borderRadius: 3, padding: 12, background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.7rem' }}>
        <span style={{ fontSize: '.75rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#665040' }}>
          {label ?? 'List'} · {items.length} item{items.length === 1 ? '' : 's'}
        </span>
        <button type="button" onClick={() => setRawMode(true)} style={linkBtn}>Edit as raw JSON</button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} style={{
          padding: '.7rem',
          marginBottom: '.6rem',
          background: '#fafaf7',
          border: '1px solid #e8e3d8',
          borderRadius: 3,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.3rem' }}>
            <strong style={{ fontSize: '.85rem' }}>Item {idx + 1}</strong>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} style={iconBtn}>↑</button>
              <button type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} style={iconBtn}>↓</button>
              <button type="button" onClick={() => removeItem(idx)} style={{ ...iconBtn, color: '#C0392B' }}>×</button>
            </div>
          </div>
          {allKeys.map((k) => (
            <div key={k} style={{ marginBottom: '.4rem' }}>
              <label style={{ fontSize: '.72rem', color: '#665040', display: 'block', marginBottom: 2 }}>{k}</label>
              {typeof item[k] === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={Boolean(item[k])}
                  onChange={(e) => updateItem(idx, { [k]: e.target.checked })}
                />
              ) : typeof item[k] === 'number' ? (
                <input
                  type="number"
                  value={item[k] as number}
                  onChange={(e) => updateItem(idx, { [k]: Number(e.target.value) })}
                  style={fieldStyle}
                />
              ) : Array.isArray(item[k]) || (item[k] !== null && typeof item[k] === 'object') ? (
                <textarea
                  value={JSON.stringify(item[k], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateItem(idx, { [k]: parsed });
                    } catch {
                      // ignore while typing — only save on valid JSON
                    }
                  }}
                  style={{ ...fieldStyle, fontFamily: 'monospace', fontSize: '.8rem', minHeight: 60 }}
                />
              ) : (
                <input
                  type="text"
                  value={(item[k] ?? '') as string}
                  onChange={(e) => updateItem(idx, { [k]: e.target.value })}
                  style={fieldStyle}
                />
              )}
            </div>
          ))}
        </div>
      ))}
      <button type="button" onClick={addItem} style={{ ...saveBtn, background: '#C4622D' }}>+ Add item</button>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '.4rem .5rem',
  border: '1px solid #d4cdbe',
  borderRadius: 2,
  fontSize: '.85rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #d4cdbe',
  borderRadius: 2,
  cursor: 'pointer',
  padding: '2px 8px',
  fontSize: '.8rem',
};
const linkBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#C4622D',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '.8rem',
};
const saveBtn: React.CSSProperties = {
  background: '#C4622D',
  color: 'white',
  border: 'none',
  padding: '.5rem 1rem',
  borderRadius: 3,
  cursor: 'pointer',
  marginTop: '.8rem',
  fontSize: '.88rem',
};
