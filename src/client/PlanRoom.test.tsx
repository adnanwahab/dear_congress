import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanRoom } from './PlanRoom';
const seed = { packageId: 'A', lane: 'real', budget: 40000, rows: [{ id: 'bus', title: 'Bus', jurisdiction: 'Houston', source: 'Illustrative assumption', amount: 10000 }] };
test('room consent and mobile-safe native keyboard controls are visible before joining', () => {
  const html = renderToStaticMarkup(<PlanRoom seed={seed} />);
  expect(html).toContain('<summary>Collaborative plan lab');
  expect(html).toContain('anyone holding the invitation');
  expect(html).toContain('Nothing here changes public synthesis');
  expect(html).toContain('No private journals or votes');
  expect(html).not.toContain('autofocus');
});
test('creation shows loading, invitation, attributed history, failure and leave states through isolated endpoint', async () => {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://localhost/synth' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true, fetch: globalThis.fetch };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { act } = await import('react'); const { createRoot } = await import('react-dom/client');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const actions: string[] = [];
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    expect(url).toBe('/api/plan-rooms');
    const body = JSON.parse(options.body as string); actions.push(body.action);
    if (body.action === 'create') { await pending; return Response.json({ invite: 'a'.repeat(64) }); }
    if (body.action === 'join') return Response.json({ member: 'b'.repeat(64), alias: 'Guest 1' });
    if (body.action === 'suggest') return Response.json({ error: 'Room expired.' }, { status: 404 });
    return Response.json({ expiresAt: Date.now() + 3600000, seed, people: [{ alias: 'Guest 1', present: true }], history: [{ alias: 'Guest 1', at: 100, itemId: 'bus', amount: 20000 }] });
  }) as typeof fetch;
  try {
    await act(async () => root.render(<PlanRoom seed={seed} />));
    await act(async () => host.querySelector('button')!.click());
    expect(host.textContent).toContain('Opening room');
    await act(async () => { release!(); await pending; });
    expect(host.textContent).toContain('Guest 1: present');
    expect(host.textContent).toContain('$20.000B');
    expect(host.querySelector<HTMLInputElement>('input[readonly]')!.value).toContain('#plan-room=');
    await act(async () => { host.querySelector('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }) as unknown as Event); });
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Enter an annual allocation');
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Leave room')!.click());
    expect(host.textContent).not.toContain('Guest 1: present');
    expect(actions).toEqual(['create', 'join', 'poll']);
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
