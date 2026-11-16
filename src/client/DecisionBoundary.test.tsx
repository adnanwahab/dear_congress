import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { boundaryScores, DecisionBoundary } from './DecisionBoundary';
import { previewSynthesisRule } from '../server/synthesis-rule-preview';
import { DEFAULT_WEIGHTS } from '../engine/engine';

test('brush thresholds are distinct actual deterministic scores and ties cross together', () => {
  const preview = previewSynthesisRule({ weights: DEFAULT_WEIGHTS, lambda: .25, budget: 40 });
  for (const pkg of preview.packages) {
    const scores = boundaryScores(pkg);
    expect(scores).toEqual([...new Set(pkg.options.map(row => row.candidateScore))].sort((a, b) => b - a));
    const html = renderToStaticMarkup(<DecisionBoundary pkg={pkg} />);
    expect(html).toContain('Threshold comparison is inclusive');
    expect(html).toContain('no policies highlighted');
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-valuetext=');
    expect(html).toContain('Math.round');
    expect(html).toContain(':active-view-transition-type(score-boundary)');
  }
});

test('native input updates threshold, respects reduced motion, and cancels delayed updates on unmount', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const window = new Window();
  const globals = { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const pkg = previewSynthesisRule({ weights: DEFAULT_WEIGHTS, lambda: .25, budget: 40 }).packages[0]!;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<DecisionBoundary pkg={pkg} />));
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('[role=status]')!.textContent).toContain('Score ≥');
    expect(host.querySelectorAll('[data-highlighted=true]').length).toBeGreaterThan(0);
    document.documentElement.dataset.motion = 'off';
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('input')!.value).toBe('2');
    delete document.documentElement.dataset.motion;
    let update: (() => void) | undefined;
    let skipped = false;
    document.startViewTransition = ((options: { update: () => void }) => {
      update = options.update;
      return { skipTransition() { skipped = true; }, ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: Promise.resolve() };
    }) as typeof document.startViewTransition;
    await act(async () => host.querySelector('button')!.click());
    await act(async () => root.unmount());
    expect(skipped).toBe(true);
    await act(async () => update!());
    expect(host.textContent).toBe('');
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
