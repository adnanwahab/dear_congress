import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { installMotion, motionDisabled, motionDuration, runViewTransition } from './motion';

async function withWindow(run: (win: Window) => Promise<void> | void) {
  const win = new Window({ url: 'https://example.com/?motion=slow' });
  const old = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: win.document });
  try { await run(win); } finally {
    ['window', 'document'].forEach((key, i) => old[i] ? Object.defineProperty(globalThis, key, old[i]!) : Reflect.deleteProperty(globalThis, key));
    await win.happyDOM.close();
  }
}

test('review mode persists across navigation, can reset, and off/reduced motion win', () => withWindow(win => {
  installMotion(win as unknown as globalThis.Window);
  expect(document.documentElement.dataset.motion).toBe('slow');
  expect(motionDuration(480)).toBe(2400);
  win.happyDOM.setURL('https://example.com/votes');
  installMotion(win as unknown as globalThis.Window);
  expect(motionDuration(700)).toBe(3500);
  win.happyDOM.setURL('https://example.com/?motion=off');
  installMotion(win as unknown as globalThis.Window);
  expect(motionDisabled()).toBe(true); expect(motionDuration(700)).toBe(0);
  win.happyDOM.setURL('https://example.com/?motion=normal');
  installMotion(win as unknown as globalThis.Window);
  expect(motionDuration(700)).toBe(700);
  win.matchMedia = (() => ({ matches: true })) as unknown as typeof win.matchMedia;
  expect(motionDuration(700)).toBe(0);
}));

test('blocked session storage still applies explicit query mode', () => withWindow(win => {
  Object.defineProperty(win, 'sessionStorage', { get() { throw new Error('blocked'); } });
  installMotion(win as unknown as globalThis.Window);
  expect(document.documentElement.dataset.motion).toBe('slow');
}));

test('typed transitions commit once; legacy fallback is isolated and cleaned after completion', () => withWindow(async () => {
  let updates = 0;
  let starts = 0;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => finish = resolve);
  document.startViewTransition = ((arg: unknown) => {
    starts++;
    if (typeof arg !== 'function') throw new TypeError('callback required');
    arg();
    return { ready: Promise.reject(new Error('skipped')), updateCallbackDone: Promise.resolve(), finished };
  }) as typeof document.startViewTransition;
  const pending = runViewTransition(() => updates++, 'sponsor-move');
  expect(starts).toBe(2); expect(updates).toBe(1);
  expect(document.documentElement.dataset.motionType).toBe('sponsor-move');
  finish(); await pending;
  expect(document.documentElement.dataset.motionType).toBeUndefined();
  document.documentElement.dataset.motion = 'off';
  await runViewTransition(() => updates++, 'sponsor-move');
  expect(starts).toBe(2); expect(updates).toBe(2);
}));

// Check each selector, including comma lists and generated inline styles.
function selectors(source: string) {
  return [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].flatMap(match => {
    const result: string[] = []; let depth = 0; let start = 0;
    for (let i = 0; i < match[1]!.length; i++) {
      const c = match[1]![i];
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) { result.push(match[1]!.slice(start, i)); start = i + 1; }
    }
    result.push(match[1]!.slice(start));
    return result.filter(s => s.includes('::view-transition-'));
  });
}
function scoped(selector: string) {
  return /:active-view-transition-type\([\w-]+\)/.test(selector.slice(0, selector.indexOf('::view-transition-')));
}
test('snapshot selectors outside the central motion section always declare a type; calls use the shared helper', async () => {
  expect(selectors('::view-transition-old(a), html:active-view-transition-type(x)::view-transition-new(a) { animation: none; }').map(scoped)).toEqual([false, true]);
  const root = new URL('../../', import.meta.url).pathname;
  // Include stylesheets placed outside src as well; dependency CSS is external.
  for await (const file of new Bun.Glob('**/*.css').scan(root)) {
    if (file.startsWith('node_modules/')) continue;
    let source = await Bun.file(`${root}/${file}`).text();
    if (file === 'src/client/styles.css') source = source.replace(/\/\* Begin motion foundation\. \*\/[\s\S]*?\/\* End motion foundation\. \*\//, '');
    for (const selector of selectors(source)) expect({ file, selector, scoped: scoped(selector) }).toMatchObject({ scoped: true });
  }
  for await (const file of new Bun.Glob('src/**/*.{css,ts,tsx}').scan(root)) {
    if (file.includes('.test.')) continue;
    let source = await Bun.file(`${root}/${file}`).text();
    if (file === 'src/client/styles.css') source = source.replace(/\/\* Begin motion foundation\. \*\/[\s\S]*?\/\* End motion foundation\. \*\//, '');
    for (const selector of selectors(source)) expect({ file, selector, scoped: scoped(selector) }).toMatchObject({ scoped: true });
    if (file !== 'src/client/motion.ts') expect(source).not.toMatch(/\.startViewTransition\s*\(/);
  }
});
