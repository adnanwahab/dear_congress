import { expect, test } from 'bun:test';
import type { JournalEntry } from '../engine/types';
import { journalFeed, migrateJournalOrigins } from './journal-origin';
import { publicJournal } from '../server/journal-privacy';

const entry = (id: string, hours = 0, extra: Partial<JournalEntry> = {}): JournalEntry => ({
  id, author: 'Resident', text: 'Groceries are expensive.', createdAt: new Date(Date.UTC(2026, 10, 13) + hours * 3600000).toISOString(),
  extraction: { needs: [], importance: .5, concerns: [], constraints: [], proposalIds: [] }, corrected: true, ...extra,
});

test('legacy migration is idempotent and preserves records and source identities', () => {
  const entries = [entry('seed', 0, { seeded: true }), entry('sim', 0, { synthetic: true, source: 'happybearlandia-world' }), entry('human'), entry('explicit', 0, { origin: 'sample' })];
  const before = structuredClone(entries);
  expect(migrateJournalOrigins(entries)).toBe(true);
  expect(entries.map(e => e.origin)).toEqual(['sample', 'simulated', 'real', 'sample']);
  expect(migrateJournalOrigins(entries)).toBe(false);
  expect(entries.map(({ origin, ...rest }) => rest)).toEqual(before.map(({ origin, ...rest }) => rest));
  expect(publicJournal({ ...entries[1]!, location: { lat: 29, lng: -95 }, tileId: 'private' })).toEqual({ ...entries[1]! });
});

test('feed filters origins and collapses exact simulations within anchored 24 hours only', () => {
  const sim = { synthetic: true, source: 'world' };
  const entries = [entry('new', 48, sim), entry('boundary', 24, sim), entry('outside', 23.99, sim), entry('old', 0, sim), entry('other-source', 48, { ...sim, source: 'other' }), entry('other-author', 48, { ...sim, author: 'Other' }), entry('different-text', 48, { ...sim, text: 'Groceries are expensive. ' }), entry('real-a', 48), entry('real-b', 48), entry('sample', 48, { seeded: true })];
  const before = structuredClone(entries);
  expect(journalFeed(entries, ['real']).map(e => e.id)).toEqual(['real-a', 'real-b']);
  expect(journalFeed(entries, ['sample']).map(e => e.id)).toEqual(['sample']);
  const feed = journalFeed(entries, ['simulated']);
  expect(feed).toHaveLength(5);
  expect(feed.find(e => e.id === 'new')?.repetition).toEqual({ count: 2, newestAt: entries[0]!.createdAt, oldestAt: entries[1]!.createdAt });
  expect(feed.find(e => e.id === 'outside')?.repetition?.count).toBe(2);
  expect(entries).toEqual(before);
});
