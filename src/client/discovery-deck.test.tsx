import { test, expect } from 'bun:test';
import { DiscoveryDeck } from './DiscoveryDeck';
import { DEMO_ITEMS } from '../engine/demo';

test('discovery buttons, touch cancellation, persistence and history remain read-only', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const win = new Window({ url: 'http://localhost/feed' });
  const globals = { window: win, document: win.document, navigator: win.navigator, localStorage: win.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
  const old = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const items = DEMO_ITEMS.slice(0, 3);
  const render = (loading = false, failed = false, list = items) => act(async () => root.render(<DiscoveryDeck items={list} loading={loading} failed={failed} fullUrl={id => `/draft?proposal=${id}`} />));
  try {
    await render(true); expect(host.textContent).toContain('Loading discovery');
    await render(false, true); expect(host.textContent).toContain('Discovery unavailable');
    await render(false, false, []); expect(host.textContent).toContain('No proposals match');
    await render(); expect(host.textContent).toContain('Swiping never casts');
    const pointer = (type: string, x: number, y = 0) => host.querySelector('article')!.dispatchEvent(new win.PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true, pointerId: 1, clientX: x, clientY: y }) as unknown as Event);
    await act(async () => { pointer('pointerdown', 100); pointer('pointercancel', 0); pointer('pointerup', 0); });
    expect(host.querySelector('h3')!.textContent).toBe(items[0]!.title);
    await act(async () => { pointer('pointerdown', 100); pointer('pointermove', 90, 80); pointer('pointerup', 0, 80); });
    expect(host.querySelector('h3')!.textContent).toBe(items[0]!.title);
    await act(async () => { pointer('pointerdown', 0); pointer('pointerup', 100); });
    expect(host.querySelector('h3')!.textContent).toBe(items[1]!.title);
    expect(JSON.parse(win.localStorage.getItem('civic_sample_discovery_v1')!).saved).toEqual([items[0]!.id]);
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('h3')!.textContent).toBe(items[2]!.title);
    await act(async () => { win.history.replaceState(null, '', `?discover=${items[0]!.id}`); win.dispatchEvent(new win.Event('popstate')); });
    expect(host.querySelector('h3')!.textContent).toBe(items[0]!.title);
    expect(host.querySelector('.workflow-card-actions a')!.getAttribute('href')).toContain('/draft?proposal=');
    await act(async () => root.render(null));
    win.history.replaceState(null, '', '/feed');
    await render(); expect(host.querySelector('h3')!.textContent).toBe(items[0]!.title);
  } finally {
    await act(async () => root.unmount());
    for (const k of Object.keys(globals)) { if (old[k]) Object.defineProperty(globalThis, k, old[k]!); else Reflect.deleteProperty(globalThis, k); }
    await win.happyDOM.close();
  }
});
