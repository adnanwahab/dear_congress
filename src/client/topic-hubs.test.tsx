import { expect, test } from 'bun:test';
import { NEEDS, PROPOSALS } from '../engine/catalog';
import { DEMO_ITEMS } from '../engine/demo';
import { topicHub, topicStageUrl } from '../shared/topic-hubs';
import { extract } from '../engine/engine';
import type { JournalEntry } from '../engine/types';
import { renderPage, sitemap } from '../server/pages';
import { freshness } from './ProposalProvenance';
import { sampleMatchesJurisdiction } from './JurisdictionPicker';

const entry: JournalEntry = { id: 'original-id', author: 'Sample', text: 'The bus is late and rent is too high', createdAt: '2026-11-13', extraction: extract('The bus is late and rent is too high'), corrected: false, seeded: true };
test('topic projections retain source IDs and stored lineage without mutating records', () => {
  const input = structuredClone([entry]); const before = JSON.stringify(input);
  const hub = topicHub('housing', NEEDS, PROPOSALS, input)!;
  expect(hub.stories[0]?.id).toBe(entry.id);
  expect(hub.stories[0]?.needIds).toEqual(['housing']);
  expect(hub.proposals.length).toBeGreaterThan(1);
  expect(hub.proposals.every(p => hub.needs.some(n => n.id === p.needId))).toBe(true);
  expect(JSON.stringify(input)).toBe(before);
});
test('private, ambiguous human, held, hidden, simulated and withdrawn stories never appear', () => {
  for (const variant of [ { seeded: false }, { seeded: undefined }, { synthetic: true },
    { moderation: { status: 'pending' as const, reason: 'hold', decidedAt: '' } },
    { moderation: { status: 'hidden' as const, reason: 'withdrawn', decidedAt: '' } } ]) {
    expect(topicHub('housing', NEEDS, PROPOSALS, [{ ...entry, ...variant }])!.stories).toEqual([]);
  }
  expect(topicHub('housing', NEEDS, PROPOSALS, [])!.stories).toEqual([]);
  expect(topicHub('housing', NEEDS, PROPOSALS, [{ ...entry, extraction: { ...entry.extraction, needs: [] } }])!.stories).toEqual([]);
});
test('empty and unknown topics do not fabricate pipeline links', () => {
  expect(topicHub('unknown', NEEDS, PROPOSALS, [entry])).toBeNull();
  const hub = topicHub('government', [], [], [])!;
  expect(hub.needs).toEqual([]); expect(hub.proposals).toEqual([]); expect(hub.stories).toEqual([]);
});
test('direct routes are indexed, unknown topics return 404, links retain topic and proposal', async () => {
  for (const id of ['housing', 'childcare', 'transit']) {
    const path = `/topics/${id}`;
    expect(renderPage('<title>test</title><div id="root"></div>', path, []).status).toBe(200);
    expect(sitemap([])).toContain(path);
    const url = new URL(topicStageUrl('votes', id, 'original/proposal'), 'https://local');
    expect(url.searchParams.get('topic')).toBe(id);
    expect(url.searchParams.get('proposal')).toBe('original/proposal');
  }
  expect(renderPage('<title>test</title>', '/topics/unknown', []).status).toBe(404);
});
test('wrong jurisdiction and stale/missing sources cannot become local official evidence', () => {
  expect(sampleMatchesJurisdiction('demo-childcare', 'Houston')).toBe(false);
  expect(sampleMatchesJurisdiction('demo-transit', 'Houston')).toBe(false);
  expect(sampleMatchesJurisdiction('demo-streets', 'Houston')).toBe(true);
  const sample = DEMO_ITEMS[0]!;
  for (const checkedAt of [null, '2020-01-01']) expect(freshness({ ...sample, background: { ...sample.background!, checkedAt } })).toBe('Source not available / not checked');
});

test('hub UI keeps missing evidence explicit, scopes samples and recovers search from history', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { TopicHubs } = await import('./TopicHubs');
  const window = new Window({ url: 'http://localhost/topics/transit?q=transit' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const paths: string[] = [];
  const request = async <T,>(path: string): Promise<T> => {
    paths.push(path);
    return (path === '/api/demo' ? { items: DEMO_ITEMS } : topicHub('transit', NEEDS, PROPOSALS, [entry])) as T;
  };
  try {
    await act(async () => root.render(<TopicHubs request={request} />));
    expect(paths).toEqual(['/api/topics/transit', '/api/demo']);
    expect(host.textContent).toContain('No verified implemented policy is registered');
    expect(host.textContent).toContain('Legacy journal records do not retain explicit topic-curation consent');
    expect(host.querySelector('a[href="/votes?topic=transit&proposal=demo-transit"]')).not.toBeNull();
    const nav = host.querySelector('nav[aria-label="Topic hubs"]')!;
    expect(nav.querySelectorAll('a').length).toBe(1);
    await act(async () => { window.history.replaceState(null, '', '/topics/transit?q=housing'); window.dispatchEvent(new window.PopStateEvent('popstate')); });
    expect(nav.textContent).toBe('Housing');
    const select = host.querySelector('select')!;
    await act(async () => { select.value = 'Houston'; select.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); });
    expect(host.textContent).not.toContain('Run frequent buses on evenings and weekends');
    expect(host.textContent).toContain('Make school crossings safer');
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
