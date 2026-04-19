/**
 * HelpPanel — a docked side panel with context-sensitive help.
 *
 * Shows:
 *   - The top 5 common tasks ("How do I…")
 *   - Keyboard shortcuts cheatsheet
 *   - Links to the Runbook for deeper topics
 *   - A "Contact an owner" button for last-resort escalation
 *
 * Opens via the ? key or the Help button in the sidebar.
 */

import { type ReactNode } from 'react';
import { Modal } from './ui/Modal';
import { IconExternal, IconMail, IconBook, IconSparkle } from './ui/Icon';
import { Button } from './ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TASKS = [
  {
    title: 'How do I edit the home page?',
    steps: [
      'Go to Pages in the sidebar.',
      'Click "Home" in the list.',
      'Click on any section to edit it — text edits save as you type.',
      'When you\'re done, click "Publish" (big orange button) to push to the live site.',
    ],
  },
  {
    title: 'How do I add a new event?',
    steps: [
      'Go to Events in the sidebar.',
      'Click "New event". Fill in title, date, and location.',
      'Click "Save" — it appears on the live events page immediately.',
    ],
  },
  {
    title: 'How do I upload photos?',
    steps: [
      'Go to Media Library.',
      'Drag files onto the upload box, or click "Upload" and pick files.',
      'Photos are optimized automatically. Copy the image URL to use it in a page.',
    ],
  },
  {
    title: 'I broke something. How do I undo?',
    steps: [
      'Every publish creates a restore point.',
      'Go to Versions in the sidebar.',
      'Find the version that worked, click "Restore", confirm.',
      'The site reverts within 1–2 minutes.',
    ],
  },
  {
    title: 'How do I invite another editor?',
    steps: [
      'You must be an owner to do this.',
      'Go to Users in the sidebar.',
      'Click "Invite", enter their email, pick a role:',
      '  • Editor — can edit & publish',
      '  • Contributor — drafts edits that an editor approves',
      '  • Viewer — read-only',
      '  • Owner — full control (keep at least 2)',
    ],
  },
];

const SHORTCUTS: Array<[string, string]> = [
  ['⌘K / Ctrl+K', 'Open command palette'],
  ['?', 'Toggle this help panel'],
  ['⌘S / Ctrl+S', 'Save current edit'],
  ['Esc', 'Close dialogs'],
];

export function HelpPanel({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={<span className="flex items-center gap-2"><IconSparkle size={18} /> Help</span>}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <a
            href="mailto:rvpark@crookedriverranch.com?subject=Admin%20help"
            className="btn btn-secondary btn-sm"
          >
            <IconMail size={14} /> Email for help
          </a>
          <Button variant="primary" size="sm" onClick={onClose}>Got it</Button>
        </>
      }
    >
      <section style={{ marginBottom: 'var(--sp-6)' }}>
        <h3 className="card-eyebrow">Common Tasks</h3>
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          {TASKS.map((t) => (
            <HelpCard key={t.title} title={t.title}>
              <ol style={{ marginLeft: '1.1rem', lineHeight: 1.65 }}>
                {t.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </HelpCard>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--sp-6)' }}>
        <h3 className="card-eyebrow">Keyboard Shortcuts</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'max-content 1fr',
          gap: 'var(--sp-2) var(--sp-4)',
          fontSize: 'var(--fs-sm)',
        }}>
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} style={{ display: 'contents' }}>
              <div><kbd style={kbdStyle}>{keys}</kbd></div>
              <div className="text-muted">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="card-eyebrow">Further reading</h3>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <a className="btn btn-secondary btn-sm" href="/admin/runbook">
            <IconBook size={14} /> Full runbook
          </a>
          <a className="btn btn-secondary btn-sm" href="/" target="_blank" rel="noopener noreferrer">
            <IconExternal size={14} /> Preview live site
          </a>
        </div>
      </section>
    </Modal>
  );
}

function HelpCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card card-tight" style={{ cursor: 'pointer' }}>
      <summary style={{ fontWeight: 500, listStyle: 'none', outline: 'none' }}>
        {title}
      </summary>
      <div style={{ marginTop: 'var(--sp-3)', color: 'var(--c-text-soft)', fontSize: 'var(--fs-sm)' }}>
        {children}
      </div>
    </details>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  background: 'var(--c-surface-muted)',
  border: '1px solid var(--c-border)',
  borderRadius: 'var(--r-sm)',
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
};
