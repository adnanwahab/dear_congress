import type { JournalEntry } from '../engine/types';

export type JournalOrigin = 'sample' | 'simulated' | 'real';

/** Legacy flags are authoritative; prose and source names never establish origin. */
export function journalOrigin(entry: JournalEntry): JournalOrigin {
  if (entry.seeded) return 'sample';
  if (entry.synthetic) return 'simulated';
  return entry.origin ?? 'real';
}

/** Add provenance without replacing records, IDs, corrections or source identities. */
export function migrateJournalOrigins(entries: JournalEntry[]): boolean {
  let changed = false;
  for (const entry of entries) {
    const origin = journalOrigin(entry);
    if (entry.origin !== origin) { entry.origin = origin; changed = true; }
  }
  return changed;
}

export type JournalFeedEntry = JournalEntry & { repetition?: { count: number; oldestAt: string; newestAt: string } };

/** Newest-first, exact-text groups anchored to the newest post, never a rolling chain.
 * Separate source AND author identities; collapse only the display, not storage.
 */
export function journalFeed(entries: JournalEntry[], origins: readonly JournalOrigin[]): JournalFeedEntry[] {
  const sorted = entries.filter(e => origins.includes(journalOrigin(e)))
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  const result: JournalFeedEntry[] = [];
  const anchors = new Map<string, JournalFeedEntry>();
  for (const entry of sorted) {
    const origin = journalOrigin(entry);
    const row = { ...entry, origin };
    if (origin !== 'simulated' || !Number.isFinite(Date.parse(entry.createdAt))) { result.push(row); continue; }
    const key = JSON.stringify([entry.source ?? null, entry.author, entry.text]);
    const anchor = anchors.get(key);
    if (anchor && Date.parse(anchor.createdAt) - Date.parse(entry.createdAt) <= 86_400_000) {
      anchor.repetition = { count: (anchor.repetition?.count ?? 1) + 1, oldestAt: entry.createdAt, newestAt: anchor.createdAt };
    } else { anchors.set(key, row); result.push(row); }
  }
  return result;
}
