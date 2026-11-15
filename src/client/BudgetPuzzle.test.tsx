import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BudgetPuzzle, PUZZLE_PLANS, PUZZLE_PROGRAMS, puzzleTotal } from './BudgetPuzzle';

test('fictional fixtures have multiple feasible plans and reject invalid selections', () => {
  expect(PUZZLE_PROGRAMS).toHaveLength(5);
  for (const plan of PUZZLE_PLANS) expect(puzzleTotal(plan.ids)).toBeLessThanOrEqual(40000);
  expect(puzzleTotal(PUZZLE_PROGRAMS.map(p => p.id))).toBe(60000);
  expect(() => puzzleTotal(['h_vouchers'])).toThrow('Unknown or duplicate');
  expect(() => puzzleTotal(['quest-homes', 'quest-homes'])).toThrow('Unknown or duplicate');
  const html = renderToStaticMarkup(<BudgetPuzzle />);
  expect(html).toContain('Demo sandbox');
  expect(html).toContain('not measured evidence or model projections');
  expect(html).toContain('never become votes, public synthesis, or simulator inputs');
});

test('select, overspend, recover, compare and reset without network or shared-state writes', async () => {
  const { Window } = await import('happy-dom');
  const win = new Window({ url: 'http://localhost/synth' });
  let networkCalls = 0;
  const globals = { window: win, document: win.document, navigator: win.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => { networkCalls++; throw new Error('Puzzle must stay local'); } };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client'); const { act } = await import('react');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const fixture = JSON.stringify(PUZZLE_PROGRAMS);
  try {
    // The puzzle has no animation, even when the shared environment offers it.
    win.matchMedia = (() => ({ matches: true })) as unknown as typeof win.matchMedia;
    document.startViewTransition = (() => { throw new Error('Unexpected puzzle animation'); }) as typeof document.startViewTransition;
    await act(async () => root.render(<BudgetPuzzle />));
    const button = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent === label)!;
    const boxes = () => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(button('Review my plan').disabled).toBe(true);
    for (const box of boxes()) await act(async () => box.click());
    expect(host.textContent).toContain('Over budget by $20.000B');
    expect(button('Review my plan').disabled).toBe(true);
    await act(async () => boxes()[0]!.click());
    await act(async () => boxes()[4]!.click());
    expect(host.textContent).toContain('Unallocated $4.000B');
    await act(async () => button('Review my plan').click());
    expect(host.querySelector('[aria-label="Your fictional plan tradeoffs"]')!.textContent).toContain('Harbor homes · Deferred');
    expect(host.textContent).toContain('Waitlisted families keep waiting');
    expect(host.textContent).toContain('Neighborhood clinics · Funded');
    await act(async () => button('Try Homes and evening access').click());
    expect(host.querySelector('[aria-label="Your fictional plan tradeoffs"]')).toBeNull();
    expect(host.textContent).toContain('Allocated $40.000B');
    await act(async () => button('Review my plan').click());
    expect(host.textContent).toContain('Neighborhood clinics · Deferred');
    await act(async () => button('Try Care, learning and cooler streets').click());
    expect(host.textContent).toContain('Unallocated $10.000B');
    await act(async () => button('Reset puzzle').click());
    expect(boxes().every(b => !b.checked)).toBe(true);
    expect(host.textContent).toContain('Allocated $0.000B');
    await act(async () => boxes()[0]!.click());
    await act(async () => root.render(<BudgetPuzzle key="new-visit" />));
    expect(boxes().every(b => !b.checked)).toBe(true);
    expect(win.localStorage.length).toBe(0);
    expect(win.sessionStorage.length).toBe(0);
    expect(networkCalls).toBe(0);
    expect(JSON.stringify(PUZZLE_PROGRAMS)).toBe(fixture);
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const k of Object.keys(globals)) { if (previous[k]) Object.defineProperty(globalThis, k, previous[k]!); else Reflect.deleteProperty(globalThis, k); }
    await win.happyDOM.close();
  }
});
