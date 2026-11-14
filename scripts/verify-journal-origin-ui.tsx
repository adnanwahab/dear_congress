/** Check the current journal discovery and rendered feed using mixed origins. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SharedJournalFeed } from '../src/client/SharedJournalFeed';
import { discoverJournal } from '../src/shared/journal-discovery';
import type { JournalEntry } from '../src/engine/types';

const dom = new Window({ url: 'http://localhost/journal' });
for (const key of ['window', 'document', 'navigator', 'location']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const entries: JournalEntry[] = [
  { id: 'human', origin: 'real', author: 'Person', text: 'Public lived experience', createdAt: '2026-11-13T13:00:00Z', extraction: { needs: [], importance: .5, concerns: [], constraints: [], proposalIds: [] }, corrected: true },
  { id: 'seed', origin: 'sample', seeded: true, author: 'Example', text: 'Sample scenario', createdAt: '2026-11-13T12:00:00Z', extraction: { needs: [], importance: .5, concerns: [], constraints: [], proposalIds: [] }, corrected: false },
  { id: 'sim', origin: 'simulated', synthetic: true, author: 'Synthetic', text: 'Simulated scenario', createdAt: '2026-11-13T11:00:00Z', extraction: { needs: [], importance: .5, concerns: [], constraints: [], proposalIds: [] }, corrected: false },
];
const container = dom.document.createElement('div'); dom.document.body.append(container);
const root = createRoot(container as any);
try {
  for (const [query, id, label] of [
    ['', 'human', 'Public submission'],
    ['origin=real', 'human', 'Public submission'],
    ['origin=sample', 'seed', 'Sample'],
    ['origin=simulated', 'sim', 'Simulated'],
  ]) {
    const filtered = discoverJournal(entries, new URLSearchParams(query));
    assert.deepEqual(filtered.map(e => e.id), [id]);
    await act(async () => { root.render(<SharedJournalFeed entries={filtered} needs={[]} loading={false} />); });
    const feed = container.querySelector('.journal-feed')!;
    assert.equal(feed.querySelectorAll('article').length, 1);
    assert.match(feed.textContent!, new RegExp(label));
    assert.match(feed.textContent!, new RegExp(filtered[0]!.text));
  }
  console.log('PASS journal: public default, explicit origin filters and badges');
} finally {
  await act(async () => { root.unmount(); });
  await dom.happyDOM.close();
}
