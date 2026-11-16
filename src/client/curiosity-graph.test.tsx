import { expect, test } from 'bun:test';
import { curiosityGraph } from '../shared/curiosity-graph';
import { topicHub } from '../shared/topic-hubs';
import { NEEDS, PROPOSALS } from '../engine/catalog';
import type { JournalEntry } from '../engine/types';
import { extract } from '../engine/engine';

const entry: JournalEntry = { id: 'housing', text: 'Rent is too high', author: 'Sample', createdAt: '', seeded: true, corrected: false, extraction: extract('Rent is too high') };
const hub = topicHub('housing', NEEDS, PROPOSALS, [entry])!;
test('constellation keeps source namespaces, directed stored links and illustrative targets without mutations', () => {
  const before = JSON.stringify(hub);
  const graph = curiosityGraph(hub);
  expect(graph.nodes.some(n => n.id === 'story:housing')).toBe(true);
  expect(graph.nodes.some(n => n.id === 'need:housing')).toBe(true);
  expect(graph.edges.filter(e => e.lane === 'sample-lineage').every(e => e.from === 'story:housing')).toBe(true);
  expect(graph.edges.some(e => e.to === 'metric:housing' && e.lane === 'illustrative-catalog')).toBe(true);
  expect(graph.nodes.find(n => n.id === 'story:housing')?.href).toBe('/api/citizen-proposals/journal/housing');
  expect(graph.nodes.filter(n => n.kind === 'policy').every(n => n.preview.includes('not an official bill'))).toBe(true);
  expect(graph.edges.every(e => graph.nodes.some(n => n.id === e.from) && graph.nodes.some(n => n.id === e.to))).toBe(true);
  expect(JSON.stringify(hub)).toBe(before);
  expect(curiosityGraph({ ...hub, stories: [], needs: [], proposals: [] })).toEqual({ nodes: [], edges: [] });
  expect(curiosityGraph({ ...hub, stories: [{ ...hub.stories[0]!, proposalIds: ['missing'] }] }).edges.some(e => e.to === 'policy:missing')).toBe(false);
});

test('hub graph selection previews before navigation; zoom, list, loading, retry and empty states work', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { TopicHubs } = await import('./TopicHubs');
  const { CuriosityConstellation } = await import('./CuriosityConstellation');
  const window = new Window({ url: 'http://localhost/topics/housing' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const click = async (label: string) => { const button = [...host.querySelectorAll('button')].find(b => b.textContent === label)!; expect(button).toBeTruthy(); await act(async () => button.click()); };
  try {
    let resolve!: (data: unknown) => void;
    let fail = true;
    const request = <T,>(path: string): Promise<T> => path === '/api/demo' ? Promise.resolve({ items: [] } as T) : fail ? new Promise<T>((yes, no) => { resolve = () => no(new Error('offline')); }) : Promise.resolve(hub as T);
    await act(async () => root.render(<TopicHubs request={request} />));
    expect(host.textContent).toContain('Loading topic');
    await act(async () => resolve(null));
    expect(host.querySelector('[role=alert]')?.textContent).toContain('unavailable');
    fail = false;
    await click('Retry');
    expect(host.textContent).toContain('Curiosity constellation');
    expect(host.querySelector('.constellation-preview a')).toBeNull();
    const first = host.querySelector<HTMLButtonElement>('.constellation-node')!;
    await act(async () => first.click());
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.constellation-preview')?.textContent).toContain('Next step:');
    expect(host.querySelector('.constellation-preview')?.textContent).toContain('Catalog need: housing');
    expect(window.location.pathname).toBe('/topics/housing');
    await click('Zoom in');
    expect(host.querySelector('output')?.textContent).toBe('125%');
    await click('Reset zoom');
    expect(host.querySelector('output')?.textContent).toBe('100%');
    await click('Show equivalent list');
    expect(host.querySelector('.constellation-viewport')).toBeNull();
    expect(host.querySelector('.constellation')?.textContent).toContain('Defines measurement target');
    expect(host.querySelector('.constellation')?.textContent).toContain('extraction.needs');
    expect(host.querySelector('.constellation')?.textContent).toContain('No real graph edges are registered');
    await act(async () => root.render(<CuriosityConstellation hub={{ ...hub, needs: [], proposals: [], stories: [] }} />));
    expect(host.textContent).toContain('No connected records available');
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
