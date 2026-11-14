import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NeedDef, NeedDemand } from '../engine/types';
import { NeedRow, needMoves, needTransitionName, rankedNeeds } from './need-motion';
const needs = ['food', 'housing', 'health'].map(id => ({ id, label: id })) as NeedDef[];
const demand = (value: number) => ({ demand: value, journalCount: 2, avgPoints: 3 }) as NeedDemand;
test('view ranks and movement compare the actual previous order without mutating needs', () => {
  const before = rankedNeeds(needs, { food: demand(.1), housing: demand(.8), health: demand(.5) });
  const after = rankedNeeds(needs, { food: demand(.9), housing: demand(.8), health: demand(.5) });
  expect(before.map(n => n.id)).toEqual(['housing', 'health', 'food']);
  expect([...needMoves(before, after)]).toEqual([['food', 2], ['housing', -1], ['health', -1]]);
  expect([...needMoves(after, after).values()]).toEqual([0, 0, 0]);
  expect(needs[0]!.id).toBe('food');
});
test('row preserves selection, signed movement text, transform bars and collision-free names', () => {
  const html = renderToStaticMarkup(<NeedRow need={needs[0]!} demand={demand(.8)} rank={1} move={2} selected mode="both" onSelect={() => {}} />);
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('Moved up 2 places');
  expect(html).toContain('↑2');
  expect(html).toContain('scaleX(0.8)');
  expect(new Set(['a-b', 'a:b', '水'].map(needTransitionName)).size).toBe(3);
});
test('selected row stays selected and scrolls into view on a mode change with reduced motion', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const window = new Window();
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
  const globals = { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value });
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = async (mode: 'real' | 'both', rank: number, move: number) => {
    await act(async () => root.render(<NeedRow need={needs[0]!} demand={demand(.8)} rank={rank} move={move} selected mode={mode} onSelect={() => {}} />));
  };
  try {
    await render('real', 3, 0);
    const row = host.querySelector('li')!;
    let scrolls = 0;
    row.scrollIntoView = options => { expect(options).toEqual({ block: 'nearest', behavior: 'instant' }); scrolls++; };
    await render('both', 1, 2);
    expect(host.querySelector('li')).toBe(row);
    expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('↑2');
    expect(scrolls).toBe(1);
  } finally {
    await act(async () => root.unmount());
    for (const k of Object.keys(globals)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!); else Reflect.deleteProperty(globalThis, k); }
    await window.happyDOM.close();
  }
});
