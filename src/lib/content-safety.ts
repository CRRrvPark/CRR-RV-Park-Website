/**
 * Shared copy validation for operational API inputs.
 *
 * Public-page source changes are reviewed through Git/Deploy Previews, while
 * operational editors still use this guard for text they submit to APIs.
 */

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
    let index = lower.indexOf(word.toLowerCase());
    while (index !== -1) {
      const before = index === 0 || /\W/.test(text[index - 1]);
      const after = index + word.length === text.length || /\W/.test(text[index + word.length]);
      if (before && after) hits.push({ word, index });
      index = lower.indexOf(word.toLowerCase(), index + 1);
    }
  }

  return hits;
}

export class BannedWordError extends Error {
  status = 422;
  hits: BannedWordHit[];

  constructor(hits: BannedWordHit[]) {
    super(`Content contains banned words: ${hits.map((hit) => hit.word).join(', ')}`);
    this.hits = hits;
    this.name = 'BannedWordError';
  }
}

export function assertNoBannedWords(text: string | null | undefined): void {
  if (!text) return;
  const hits = findBannedWords(text);
  if (hits.length > 0) throw new BannedWordError(hits);
}
