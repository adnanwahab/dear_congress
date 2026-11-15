import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { StateFeedback } from '../src/client/StateFeedback';
import { STATUS_MOTION, type StatusKind } from '../src/client/motion';

test('every semantic state has persistent text and a hidden icon without requiring data', () => {
  for (const state of Object.keys(STATUS_MOTION) as StatusKind[]) {
    const html = renderToStaticMarkup(<StateFeedback state={state} />);
    expect(html).toContain(STATUS_MOTION[state].label);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`data-state="${state}"`);
  }
});

test('only state changes fade once; failures, reduced motion, off, empty data and focus remain still', async () => {
  const win = new Window();
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const old = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let reduced = false;
  win.matchMedia = (() => ({ matches: reduced })) as unknown as typeof win.matchMedia;
  const effects: KeyframeAnimationOptions[] = [];
  let cancelled = 0;
  const render = async (state: StatusKind, message?: string) => act(async () => root.render(<><button>Retry</button><div role="status"><StateFeedback state={state}>{message}</StateFeedback></div></>));
  try {
    await render('draft');
    const icon = host.querySelector('[aria-hidden]') as HTMLElement;
    icon.animate = ((_frames: unknown, options: KeyframeAnimationOptions) => { effects.push(options); return { cancel() { cancelled++; } }; }) as typeof icon.animate;
    const button = host.querySelector('button')!; button.focus(); button.click();
    await render('draft', 'Draft changed'); expect(effects.length).toBe(0);
    await render('syncing'); expect(effects).toEqual([{ duration: 180, iterations: 1 }]);
    expect(document.activeElement).toBe(button);
    await render('saved'); expect(cancelled).toBe(1);
    await render('error'); await render('unavailable'); expect(effects.length).toBe(2);
    reduced = true; await render('updated'); expect(effects.length).toBe(2);
    reduced = false; document.documentElement.dataset.motion = 'off';
    await render('cited'); expect(effects.length).toBe(2);
    document.documentElement.dataset.motion = 'slow';
    await render('draft'); expect(effects.at(-1)?.duration).toBe(750);
    Object.defineProperty(icon, 'animate', { value: undefined, configurable: true }); await render('saved');
    expect(host.textContent).toContain('Saved');
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) old[key] ? Object.defineProperty(globalThis, key, old[key]!) : Reflect.deleteProperty(globalThis, key);
    await win.happyDOM.close();
  }
});
