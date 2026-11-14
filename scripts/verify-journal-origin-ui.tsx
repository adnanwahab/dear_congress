/** Isolated DOM journey against mixed-origin fixtures, without network writes. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import JournalScreen from '../src/client/JournalScreen';
import { journalFeed } from '../src/shared/journal-origin';
import type { JournalEntry } from '../src/engine/types';
const dom = new Window({ url: 'http://localhost/journal' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'location']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const entries: JournalEntry[] = ['real', 'sample', 'simulated', 'simulated'].map((origin, i) => ({
  id: String(i), origin: origin as JournalEntry['origin'], author: 'Resident', text: `${origin} experience`,
  createdAt: new Date(Date.UTC(2026, 10, 13, i)).toISOString(), extraction: { needs: [], importance: .5, concerns: [], constraints: [], proposalIds: [] }, corrected: false,
}));
const paths: string[] = [];
const request = async <T,>(path: string): Promise<T> => {
  paths.push(path);
  if (path.includes('/schema')) return { version: 2, needs: [] } as T;
  const origin = new URL(path, 'http://localhost').searchParams.get('origin');
  return { entries: journalFeed(entries, [origin as any]), nextCursor: null } as T;
};
const container = dom.document.createElement('div'); dom.document.body.append(container);
const root = createRoot(container as any);
try {
  await act(async () => { root.render(<JournalScreen request={request} />); });
  const feed = () => container.querySelector('.journal-feed')!;
  assert(paths.includes('/api/entries?limit=12&origin=real'));
  assert.match(feed().textContent!, /real experience/);
  assert.doesNotMatch(feed().textContent!, /sample experience|simulated experience/);
  for (const origin of ['sample', 'simulated', 'real']) {
    await act(async () => { (container.querySelectorAll('[aria-label="Journal origin"] button')[[ 'real', 'sample', 'simulated' ].indexOf(origin)] as any).click(); });
    assert.match(feed().textContent!, new RegExp(`${origin} experience`));
    assert.equal(feed().querySelectorAll('article').length, 1);
    assert.equal(container.querySelector('[aria-pressed="true"]')!.textContent, `${origin[0]!.toUpperCase()}${origin.slice(1)} entries`);
    if (origin === 'simulated') assert.match(feed().textContent!, /Repeated 2 times/);
  }
  assert.equal(feed().querySelector('.sample-tag'), null);
  console.log('PASS journal: real default, origin toggles, simulation groups and real badges');
} finally {
  await act(async () => { root.unmount(); });
  await dom.happyDOM.close();
}
