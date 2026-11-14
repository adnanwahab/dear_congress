import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS } from '../engine/demo';
import { comparisonLink, comparisonRevision, readComparison, ProposalCompare } from './ProposalCompare';

const pair = DEMO_ITEMS.slice(0, 2);
const search = (items = pair) => new URL(comparisonLink(items), 'https://example.test').search;
test('share URL preserves two or three ordered public revision identities without votes', () => {
  for (const items of [pair, [...pair].reverse(), DEMO_ITEMS.slice(0, 3)]) {
    expect(readComparison(search(items), DEMO_ITEMS).items.map(item => item.id)).toEqual(items.map(item => item.id));
  }
  expect(comparisonRevision({ ...pair[0]!, support: 99999 })).toBe(comparisonRevision(pair[0]!));
  expect(comparisonLink(pair)).not.toContain('99999');
  expect(readComparison('', DEMO_ITEMS)).toEqual({ items: [], error: '' });
});
test('invalid, duplicate, absent, oversize and stale snapshots fail closed', () => {
  for (const raw of ['[]', 'null', '{', JSON.stringify([[pair[0]!.id, comparisonRevision(pair[0]!)], [pair[0]!.id, comparisonRevision(pair[0]!)]]), 'x'.repeat(30001)]) {
    const result = readComparison('?' + new URLSearchParams({ compare: raw }), DEMO_ITEMS);
    expect(result.items).toEqual([]); expect(result.error).toContain('Comparison unavailable');
  }
  expect(readComparison(search(), [pair[0]!]).items).toEqual([]);
  for (const change of [{ proposedText: 'new revision' }, { jurisdiction: 'State' }, { sourceUrl: 'https://other.test' }]) {
    expect(readComparison(search(), DEMO_ITEMS.map((item, index) => index === 0 ? { ...item, ...change } : item)).items).toEqual([]);
  }
});
test('criteria, independent links, missing evidence and semantic data lanes render without mutation', () => {
  const before = JSON.stringify(DEMO_ITEMS);
  const html = renderToStaticMarkup(<ProposalCompare items={DEMO_ITEMS} current={pair[0]} search={search()} />);
  for (const text of ['scope="row"', 'scope="col"', 'No evidence supplied', 'Exact draft text', 'Strongest concern', 'Synthetic outcomes', 'Unverified advisory tallies', 'Official facts', 'scroll horizontally', 'tabindex="0"', 'Move ', '/votes?proposal=', '/draft?proposal=', 'type="checkbox"', '/synth']) expect(html).toContain(text);
  expect(html).not.toContain('onVote');
  expect(JSON.stringify(DEMO_ITEMS)).toBe(before);
});
test('comparison reuses exact-text argument map and guards CSS mobile overflow and reduced motion', async () => {
  const items = [DEMO_ITEMS.find(item => item.id === 'demo-transit')!, pair[0]!];
  const html = renderToStaticMarkup(<ProposalCompare items={DEMO_ITEMS} search={search(items)} />);
  expect(html).toContain('unverified assertion');
  expect(html).toContain('have not been reviewed as the strongest');
  const css = await Bun.file(new URL('./proposal-compare.css', import.meta.url)).text();
  expect(css).toContain('overflow-x: auto');
  expect(css).toContain('max-width: 100%');
  expect(css).toContain('prefers-reduced-motion: reduce');
});

test('native controls select, cap, reorder, remove and replay without requests or storage', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { getByRole, getAllByRole } = await import('@testing-library/dom');
  const window = new Window({ url: 'http://localhost/feed' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ProposalCompare items={DEMO_ITEMS} current={pair[0]} search="" />));
    const boxes = getAllByRole(host, 'checkbox');
    boxes[0]!.focus(); expect(document.activeElement).toBe(boxes[0]!);
    for (const index of [0, 1, 2]) await act(async () => boxes[index]!.click());
    expect(boxes[3]!.hasAttribute('disabled')).toBe(true);
    const move = getByRole(host, 'button', { name: `Move ${pair[1]!.title} earlier` });
    await act(async () => move.click());
    const href = getByRole(host, 'link', { name: 'Open shareable comparison snapshot' }).getAttribute('href')!;
    const replay = readComparison(new URL(href, 'http://localhost').search, DEMO_ITEMS);
    expect(replay.items.map(item => item.id)).toEqual([pair[1]!.id, pair[0]!.id, DEMO_ITEMS[2]!.id]);
    await act(async () => boxes[0]!.click());
    expect(boxes[3]!.hasAttribute('disabled')).toBe(false);
    await act(async () => root.render(<ProposalCompare key="replay" items={DEMO_ITEMS} search={new URL(href, 'http://localhost').search} />));
    expect(getByRole(host, 'status').textContent).toContain('3 of 3');
    expect(window.localStorage.length).toBe(0); expect(window.sessionStorage.length).toBe(0);
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
