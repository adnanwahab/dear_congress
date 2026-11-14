import type { JournalEntry } from '../engine/types';

// Known equivalent world-template sentences. Keep this list local to display:
// it must never classify unflagged entries as simulated or alter stored words.
const FRIDGE = /(?:Our fridge was empty tonight and it was hard to find groceries nearby\.|I came home to an empty fridge and struggled to get basic groceries\.|We ran out at home and finding groceries nearby was difficult\.)/gi;
const BOILERPLATE = /(?:This keeps disrupting my daily life\.|I'm sharing this because it keeps happening\.|I need a practical fix soon\.)/gi;
function tokens(text: string): Set<string> {
  return new Set(text.normalize('NFKC').replace(FRIDGE, 'empty fridge groceries nearby').replace(BOILERPLATE, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}
function similar(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  const intersection = [...a].filter(token => b.has(token)).length;
  return intersection / (a.size + b.size - intersection) >= 0.6;
}
function needs(entry: JournalEntry): string {
  return JSON.stringify([...new Set(entry.extraction.needs.map(n => n.id))].sort());
}

/** Consecutive runs only; compare to the first entry to avoid similarity chaining. */
export function groupJournalEntries(entries: readonly JournalEntry[]): JournalEntry[][] {
  const groups: JournalEntry[][] = [];
  let anchorTokens = new Set<string>();
  let anchorNeeds = '';
  for (const entry of entries) {
    const group = groups.at(-1);
    const anchor = group?.[0];
    const entryNeeds = needs(entry);
    const entryTokens = tokens(entry.text);
    if (anchor?.synthetic === true && entry.synthetic === true &&
        anchor.source === entry.source && entryNeeds !== '[]' && entryNeeds === anchorNeeds &&
        similar(anchorTokens, entryTokens)) {
      group!.push(entry);
    } else {
      groups.push([entry]);
      anchorTokens = entryTokens;
      anchorNeeds = entryNeeds;
    }
  }
  return groups;
}
