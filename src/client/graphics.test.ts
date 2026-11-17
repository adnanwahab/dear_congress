import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { attachGraphics, GRAPHICS_BUDGETS, graphicsMode, measuredTier, setGraphicsMode } from './graphics';

test('tiers bound rendering only and cap all optional particles at zero', () => {
  expect(measuredTier('standard', 30)).toBe('lite');
  expect(measuredTier('standard', 16)).toBe('cinematic');
  expect(measuredTier('lite', 80)).toBe('lite');
  expect(measuredTier('cinematic', 20)).toBe('cinematic');
  expect(Object.values(GRAPHICS_BUDGETS).map(b => b.particles)).toEqual([0, 0, 0]);
});
test('blocked storage retains graphics choice without changing motion or drafts', async () => {
  const win = new Window(); const target = win as unknown as globalThis.Window;
  win.document.documentElement.dataset.motion = 'off';
  Object.defineProperty(win, 'localStorage', { get() { throw Error('blocked'); } });
  setGraphicsMode(target, 'cinematic');
  expect(graphicsMode(target)).toBe('cinematic');
  expect(win.document.documentElement.dataset.motion).toBe('off');
  await win.happyDOM.close();
});
test('active frame measurement adapts resolution, respects manual mode and disposes listeners', async () => {
  const win = new Window(); const target = win as unknown as globalThis.Window;
  let now = 1000; Object.defineProperty(win.performance, 'now', { value: () => now });
  Object.defineProperty(win, 'devicePixelRatio', { value: 3 });
  const handlers = new Map<string, () => void>(); const ratios: number[] = [];
  const stop = attachGraphics({ on: (name, cb) => handlers.set(name, cb), off: name => handlers.delete(name), setPixelRatio: ratio => ratios.push(ratio) }, target);
  const frames = (count: number, interval: number) => { for (let i = 0; i < count; i++) { now += interval; handlers.get('render')!(); } };
  frames(61, 30); expect(ratios.at(-1)).toBe(1);
  setGraphicsMode(target, 'cinematic'); frames(61, 30); expect(ratios.at(-1)).toBe(2);
  setGraphicsMode(target, 'auto'); frames(61, 1000); expect(ratios.at(-1)).toBe(1.5);
  stop(); expect(handlers.size).toBe(0);
  await win.happyDOM.close();
});
