import { expect, test } from 'bun:test';
import { TOUR_STOPS, tourState, tourUrl } from './demo-tour';
import { DemoTour } from './DemoTour';

test('seven safe stops total sixty seconds and malformed links start safely', () => {
  expect(TOUR_STOPS.map(s => s.route)).toEqual(['/published', '/feed', '/votes', '/draft', '/sponsors', '/outcomes', '/map']);
  expect(TOUR_STOPS.reduce((sum, s) => sum + s.duration, 0)).toBe(60_000);
  expect(TOUR_STOPS.every(s => s.caption.length > 0)).toBe(true);
  expect(tourState(new URL('http://localhost/'))).toBeNull();
  for (const step of ['-1', '99', 'NaN', '1.5']) expect(tourState(new URL(`http://localhost/?demo=1&step=${step}`))?.step).toBe(0);
  expect(tourState(new URL('http://localhost/?demo=1&step=3&paused=1'))).toEqual({ step: 3, paused: true });
  expect(tourUrl(6, true)).toBe('/map?demo=1&step=6&paused=1');
});

test('timer navigates; page clicks pause before actions; space resumes and cleans up', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({ url: 'http://localhost/votes?demo=1&step=2' });
  const globals = { window: dom, document: dom.document, CustomEvent: dom.CustomEvent, ResizeObserver: dom.ResizeObserver, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  let pending: (() => void) | undefined;
  let delay = 0;
  dom.setTimeout = ((cb: () => void, ms: number) => { pending = cb; delay = ms; return 1; }) as any;
  dom.clearTimeout = (() => { pending = undefined; }) as any;
  const paths: string[] = [];
  dom.location.assign = path => { paths.push(String(path)); };
  document.body.innerHTML = '<button id="vote">Vote</button><div id="root"></div>';
  let writes = 0;
  document.getElementById('vote')!.addEventListener('click', () => writes++);
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(<DemoTour />));
    expect(delay).toBe(8000);
    await act(async () => document.getElementById('vote')!.dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true }) as any));
    expect(writes).toBe(0); expect(pending).toBeUndefined();
    expect(dom.location.search).toContain('paused=1');
    await act(async () => dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: ' ' })));
    expect(pending).toBeDefined();
    pending!(); expect(paths).toEqual(['/draft?demo=1&step=3']);
    await act(async () => dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowLeft' })));
    expect(paths.at(-1)).toBe('/feed?demo=1&step=1');
    await act(async () => dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })));
    expect(paths.at(-1)).toBe('/votes');
  } finally {
    await act(async () => root.unmount());
    expect(pending).toBeUndefined();
    await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
