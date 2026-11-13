import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createHash } from 'node:crypto';
import { CSP } from '../server/public-security';
import { buildBrowser, transitionShell } from '../server/browser-build';
import { ThemeSwitch } from './ThemeSwitch';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const source = await Bun.file(new URL('../../index.html', import.meta.url)).text();
const bootstrap = source.match(/<script>([\s\S]*?)<\/script>/)![1]!;
for (const production of [false, true]) test(`prepaint theme script survives build and CSP (${production})`, async () => {
  const result = await buildBrowser(production);
  expect(result.success).toBe(true);
  const html = transitionShell(await result.outputs.find(o => o.type.startsWith('text/html'))!.text());
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  expect(CSP).toContain(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
  expect(html.indexOf(script)).toBeLessThan(html.indexOf('type="module"'));
  expect(html.indexOf(script)).toBeLessThan(html.indexOf('rel="stylesheet"'));
});

test('theme initializes before rendering, cycles, persists, follows system, and handles transition fallbacks', async () => {
  const window = new Window({ width: 1280, height: 800 });
  const globals = { window, document: window.document, localStorage: window.localStorage, matchMedia: window.matchMedia.bind(window), innerWidth: 1280, innerHeight: 800, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  let dark = true, reduced = false;
  const systemListeners = new Set<() => void>();
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: query.includes('reduced-motion') ? reduced : dark, addEventListener: (_: string, cb: () => void) => systemListeners.add(cb), removeEventListener: (_: string, cb: () => void) => systemListeners.delete(cb) }) });
  window.matchMedia = globalThis.matchMedia as unknown as typeof window.matchMedia;
  document.head.innerHTML = '<meta name="theme-color" content="">';
  const initialize = () => Function(bootstrap)();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const click = async () => { await act(async () => { host.querySelector('button')!.click(); }); };
  try {
    initialize(); expect(document.documentElement.dataset.theme).toBe('dark');
    localStorage.setItem('civic-theme', 'light'); initialize(); expect(document.documentElement.dataset.theme).toBe('light');
    localStorage.setItem('civic-theme', 'invalid'); initialize(); expect(document.documentElement.dataset.themePreference).toBe('system');
    await act(async () => root.render(<ThemeSwitch />));
    await click(); expect(document.documentElement.dataset.theme).toBe('light'); expect(localStorage.getItem('civic-theme')).toBe('light');
    initialize(); expect(document.documentElement.dataset.theme).toBe('light');
    let starts = 0, animation: any;
    host.querySelector('button')!.getBoundingClientRect = () => ({ left: 100, top: 40, width: 44, height: 44 }) as DOMRect;
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: ({ update, types }: any) => { starts++; expect(types).toEqual(['theme']); update(); return { ready: Promise.resolve(), finished: Promise.resolve() }; } });
    Object.defineProperty(document.documentElement, 'animate', { configurable: true, value: (frames: any, options: any) => { animation = { frames, options }; return { finished: Promise.resolve() }; } });
    await click(); expect(document.documentElement.dataset.theme).toBe('dark'); expect(starts).toBe(1); expect(animation.options.duration).toBe(400); expect(animation.options.pseudoElement).toBe('::view-transition-new(root)'); expect(animation.frames.clipPath).toEqual(['circle(0px at 122px 62px)', `circle(${Math.hypot(1280 - 122, 800 - 62)}px at 122px 62px)`]);
    reduced = true; await click(); expect(starts).toBe(1); expect(document.documentElement.dataset.themePreference).toBe('system');
    dark = false; await act(async () => { systemListeners.forEach(cb => cb()); }); expect(document.documentElement.dataset.theme).toBe('light');
    reduced = false;
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: () => { throw Error('unsupported options'); } });
    await click(); expect(document.documentElement.dataset.themePreference).toBe('light');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('storage blocked'); } });
    initialize(); expect(document.documentElement.dataset.themePreference).toBe('system');
    await click(); expect(document.documentElement.dataset.theme).toBe('dark');
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
