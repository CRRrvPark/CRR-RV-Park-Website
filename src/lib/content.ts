/**
 * Content helpers — fetching, validating, banned-word checks.
 *
 * The "banned words" list comes from HANDOFF.md §3.4 — words the brand has
 * decided to avoid in all copy. The validator runs server-side on every
 * content_block save.
 */

import { serverClient } from './supabase';

export const BANNED_WORDS = [
  'stunning',
  'breathtaking',
  'nestled',
  'premier',
  'one-of-a-kind',
  'unparalleled',
  'world-class',
];

export interface BannedWordHit {
  word: string;
  index: number;
}

export function findBannedWords(text: string): BannedWordHit[] {
  if (!text) return [];
  const hits: BannedWordHit[] = [];
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    let idx = lower.indexOf(word.toLowerCase());
    while (idx !== -1) {
      // Word boundary check (very lightweight)
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after = idx + word.length === text.length || /\W/.test(text[idx + word.length]);
      if (before && after) hits.push({ word, index: idx });
      idx = lower.indexOf(word.toLowerCase(), idx + 1);
    }
  }
  return hits;
}

export class BannedWordError extends Error {
  status = 422;
  hits: BannedWordHit[];
  constructor(hits: BannedWordHit[]) {
    super(`Content contains banned words: ${hits.map(h => h.word).join(', ')}`);
    this.hits = hits;
    this.name = 'BannedWordError';
  }
}

export function assertNoBannedWords(text: string | null | undefined): void {
  if (!text) return;
  const hits = findBannedWords(text);
  if (hits.length > 0) throw new BannedWordError(hits);
}

// ---------------------------------------------------------------------------
// Snapshot helpers — used before publish + before destructive actions.
// ---------------------------------------------------------------------------

export interface SnapshotState {
  pages: any[];
  sections: any[];
  content_blocks: any[];
  media: any[];
  events: any[];
  capturedAt: string;
}

export async function captureSnapshot(reason: string, triggeredBy: string | null): Promise<string> {
  const sb = serverClient();
  const [pages, sections, content_blocks, media, events] = await Promise.all([
    sb.from('pages').select('*'),
    sb.from('sections').select('*'),
    sb.from('content_blocks').select('*'),
    sb.from('media').select('*').eq('is_active', true),
    sb.from('events').select('*'),
  ]);

  const state: SnapshotState = {
    pages: pages.data ?? [],
    sections: sections.data ?? [],
    content_blocks: content_blocks.data ?? [],
    media: media.data ?? [],
    events: events.data ?? [],
    capturedAt: new Date().toISOString(),
  };

  const stateJson = JSON.stringify(state);
  const { data, error } = await sb.from('snapshots').insert({
    triggered_by: triggeredBy,
    reason,
    state,
    byte_size: stateJson.length,
  }).select('id').single();

  if (error || !data) throw new Error(`Snapshot capture failed: ${error?.message}`);
  return data.id;
}

export async function restoreSnapshot(snapshotId: string, triggeredBy: string): Promise<void> {
  const sb = serverClient();

  // Always snapshot current state before restoring (so restore is reversible)
  await captureSnapshot('pre_restore', triggeredBy);

  const { data: snap, error } = await sb.from('snapshots').select('state').eq('id', snapshotId).single();
  if (error || !snap) throw new Error(`Snapshot not found: ${snapshotId}`);

  const state = snap.state as SnapshotState;

  // Restore in dependency order: content_blocks depend on sections depend on pages
  // Use upsert so we restore values without breaking referential integrity.
  await sb.from('pages').upsert(state.pages);
  await sb.from('sections').upsert(state.sections);
  await sb.from('content_blocks').upsert(state.content_blocks);
  await sb.from('media').upsert(state.media);
  await sb.from('events').upsert(state.events);
}
