import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { DEMO_ITEMS } from '../engine/demo';

test('paper opens on missing/failed snapshots and latest interrupted intent wins', async () => {
  const dom = new Window({ url: 'http://localhost/feed' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node'];
  const old = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { ProposalPaper } = await import('./ProposalPaper');
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(<ProposalPaper item={DEMO_ITEMS[0]!} draftUrl="/draft?proposal=test" />));
    const details = document.querySelector('details')!;
    const summary = document.querySelector('summary')!;
    await act(async () => summary.click());
    expect(details.open).toBe(true);
    const clause = document.querySelector('.proposal-paper-body > p');
    (document as any).startViewTransition = () => { throw Error('snapshot failed'); };
    await act(async () => summary.click());
    expect(details.open).toBe(false);
    expect(document.querySelector('.proposal-paper-body > p')).toBe(clause);
    const callbacks: (() => void)[] = [];
    (document as any).startViewTransition = (options: { update: () => void }) => {
      callbacks.push(options.update);
      return { skipTransition() {}, ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve() };
    };
    await act(async () => { summary.click(); summary.click(); callbacks.forEach(fn => fn()); });
    expect(details.open).toBe(false);
    expect(dom.location.href).toBe('http://localhost/feed');
  } finally {
    await act(async () => root.unmount());
    for (const key of keys) { const descriptor = old.get(key); if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await dom.happyDOM.close();
  }
});
