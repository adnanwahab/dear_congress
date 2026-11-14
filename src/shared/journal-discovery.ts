import type { JournalEntry } from '../engine/types';
export function journalOrigin(e: JournalEntry) {
  return e.synthetic ? 'simulated' : e.seeded ? 'sample' : 'public';
}
/** Operates only on the server's privacy-projected public entries. No location inference. */
export function discoverJournal(entries: JournalEntry[], query: URLSearchParams) {
  const origin = query.get('origin') ?? 'public';
  const need = query.get('need');
  const from = query.get('from');
  const to = query.get('to');
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!['public', 'sample', 'simulated'].includes(origin)) throw new Error('Choose a valid origin.');
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) throw new Error('Choose a valid UTC date range.');
  const filtered = entries.filter(e => journalOrigin(e) === origin && (!need || e.extraction.needs.some(n => n.id === need)) &&
    (!from || Date.parse(e.createdAt) >= Date.parse(from)) && (!to || Date.parse(e.createdAt) < Date.parse(to) + 86400000));
  filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  return filtered;
}
