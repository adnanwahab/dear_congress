import { expect, test } from 'bun:test';
import { reconcileTicker, tickerText } from './JournalLive';
import type { JournalEntry } from '../engine/types';
const entry = (id: string, extra = {}) => ({ id, author: 'Private name', text: 'Private text', extraction: { needs: [{ id: 'housing' }] }, ...extra } as JournalEntry);
test('initial and reconnect snapshots do not replay stories; new arrivals queue and removals revoke queued entries', () => {
  const initial = reconcileTicker(null, [], [entry('old')]);
  expect(initial.queue).toEqual([]);
  const next = reconcileTicker(initial.ids, [], [entry('new'), entry('old')]);
  expect(next.queue).toEqual(['new']);
  expect(reconcileTicker(next.ids, next.queue, [entry('new'), entry('old')]).queue).toEqual(['new']);
  expect(reconcileTicker(next.ids, next.queue, [entry('old')]).queue).toEqual([]);
  expect(reconcileTicker(initial.ids, [], [entry('hidden', { moderation: { status: 'hidden' } }), entry('pending', { moderation: { status: 'pending' } })]).queue).toEqual([]);
});
test('ticker only exposes label, withheld location and sample/simulation provenance', () => {
  const text = tickerText(entry('new', { seeded: true, synthetic: true, location: { lat: 29.1234, lng: -95.1234 } }), [{ id: 'housing', label: 'Housing affordability' }]);
  expect(text).toBe('New story · Location not shared · Housing affordability · Sample · Simulated · just now');
  expect(text).not.toContain('Private');
  expect(text).not.toContain('29.1234');
});

test('shell shares one stream, suppresses baseline, links arrivals, retracts hidden stories and persists dismissal', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { JournalLiveProvider, JournalTicker } = await import('./JournalLive');
  const window = new Window({ url: 'http://localhost/' });
  let stream: any;
  let opens = 0;
  let closed = false;
  class Stream {
    onmessage: any; onopen: any; onerror: any;
    constructor() { stream = this; opens++; }
    close() { closed = true; }
  }
  const globals = { window, document: window.document, sessionStorage: window.sessionStorage, EventSource: Stream, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div');
  const root = createRoot(host);
  const send = async (entries: JournalEntry[]) => act(async () => stream.onmessage({ data: JSON.stringify({ entries, needs: [{ id: 'housing', label: 'Housing affordability' }] }) }));
  try {
    await act(async () => root.render(<JournalLiveProvider><JournalTicker /></JournalLiveProvider>));
    await send([entry('old')]); expect(host.querySelector('aside')).toBeNull();
    await send([entry('new'), entry('old')]);
    expect(opens).toBe(1);
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/journal?entry=new#story-new');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Housing affordability');
    await send([entry('old')]); expect(host.querySelector('aside')).toBeNull();
    await send([entry('another'), entry('old')]);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('');
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
    expect(sessionStorage.getItem('journal-ticker-dismissed')).toBe('1');
    expect(host.querySelector('aside')).toBeNull();
  } finally {
    await act(async () => root.unmount()); expect(closed).toBe(true);
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  }
});
