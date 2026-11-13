import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PackageResult } from '../engine/types';
import { PlanNumber, PlanTransitionStyles, planTransitionName, rankChanges, updatePlan } from './plan-motion';

const plan = (...ids: string[]) => ({ items: ids.map(id => ({ proposal: { id } })) }) as PackageResult;
test('rank markers compare visible ranks, distinguish additions, and reset unchanged rows', () => {
  const next = plan('c', 'a', 'd');
  expect([...rankChanges(plan('a', 'b', 'c'), next)]).toEqual([['c', '↑2'], ['a', '↓1'], ['d', 'Added']]);
  expect([...rankChanges(next, next).values()]).toEqual(['', '', '']);
  expect([...rankChanges(undefined, next).values()]).toEqual(['', '', '']);
  expect([...rankChanges(next, plan())]).toEqual([]);
});
test('transition names preserve identity and isolate package/real/simulated scopes', () => {
  const names = ['real:A', 'blended:A', 'real:B'].flatMap(scope => ['a-b', 'a:b', '水'].map(id => planTransitionName(scope, id)));
  expect(new Set(names).size).toBe(9);
  for (const name of names) expect(name).toMatch(/^plan-item-[a-f0-9-]+$/);
  const css = renderToStaticMarkup(<PlanTransitionStyles scope="real:A" items={['a', 'b']} />);
  expect(css).toContain('animation-duration: var(--motion-plan)');
  expect(css).toContain(':active-view-transition-type(plan-rerank)');
  expect(css).toContain(':only-child'); expect(css).toContain('plan-leave'); expect(css).toContain('plan-enter');
  const html = renderToStaticMarkup(<PlanNumber value={12.3} format={n => `$${n.toFixed(1)}B`} />);
  expect(html).toContain('aria-label="$12.3B"');
});
test('result commits in transition callback; reduced motion and unsupported browsers update immediately', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let reduced = false;
  let starts = 0;
  let updates = 0;
  const doc: { startViewTransition?: (options: { update: () => void; types: string[] }) => unknown } = {
    startViewTransition(options) { expect(options.types).toEqual(['plan-rerank']); starts++; options.update(); return { updateCallbackDone: Promise.resolve(), finished: Promise.reject(new Error('skipped')) }; },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: reduced }) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  try {
    await updatePlan(() => updates++); expect(starts).toBe(1); expect(updates).toBe(1);
    reduced = true;
    await updatePlan(() => updates++); expect(starts).toBe(1); expect(updates).toBe(2);
    reduced = false; delete doc.startViewTransition;
    await updatePlan(() => updates++); expect(updates).toBe(3);
  } finally {
    for (const [key, descriptor] of [['window', oldWindow], ['document', oldDocument]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('counters interpolate upward and downward, respect reduced motion, and cancel on unmount', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const window = new Window();
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  let reduced = false;
  const globals = { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (cb: FrameRequestCallback) => { frames.set(++sequence, cb); return sequence; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); } };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  window.matchMedia = (() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = async (value: number) => { await act(async () => root.render(<PlanNumber value={value} format={n => n.toFixed(1)} />)); };
  const step = async (offset: number) => {
    const callbacks = [...frames.values()]; frames.clear();
    await act(async () => { callbacks.forEach(callback => callback(performance.now() + offset)); });
  };
  try {
    await render(10); await step(1000);
    await render(30); await step(200);
    expect(Number(host.textContent)).toBeGreaterThan(10); expect(Number(host.textContent)).toBeLessThan(30);
    await step(1000); expect(host.textContent).toBe('30.0');
    await render(0); await step(200);
    expect(Number(host.textContent)).toBeLessThan(30); expect(Number(host.textContent)).toBeGreaterThan(0);
    await step(1000); expect(host.textContent).toBe('0.0');
    document.documentElement.dataset.motion = 'slow';
    await render(35); await step(1000);
    expect(Number(host.textContent)).toBeGreaterThan(0); expect(Number(host.textContent)).toBeLessThan(35);
    await step(4000); expect(host.textContent).toBe('35.0');
    document.documentElement.dataset.motion = 'off';
    await render(99); expect(host.textContent).toBe('99.0'); expect(frames.size).toBe(0);
    delete document.documentElement.dataset.motion;
    reduced = true; await render(42); expect(host.textContent).toBe('42.0'); expect(frames.size).toBe(0);
    reduced = false; await render(10); expect(frames.size).toBe(1);
  } finally {
    await act(async () => root.unmount()); expect(frames.size).toBe(0);
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
