import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PriorityHistory } from './PriorityHistory';
import { recordPriorities } from '../server/priority-history';
import { emptyDB } from '../engine/engine';

test('history journey: success, native controls, failed fetch and retry without submissions', async () => {
  const win = new Window({ url: 'http://localhost/needs' });
  const db = emptyDB();
  recordPriorities(db, undefined, new Date('2026-11-14T00:00:00Z'));
  db.allocationByVoter.a = { housing: 100 };
  recordPriorities(db, undefined, new Date('2026-11-15T00:00:00Z'));
  let fail = false;
  const requests: string[] = [];
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => { requests.push(options?.method ?? 'GET'); return Response.json(fail ? {} : {samples: db.priorityHistory}, {status: fail ? 503 : 200}); } };
  const saved = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis,k,{configurable:true,value:v});
  const host = document.createElement('div'); document.body.append(host);
  let root = createRoot(host);
  const render = async () => { await act(async () => { root.render(<PriorityHistory />); }); };
  try {
    await render();
    expect(host.textContent).toContain('2026-11-15');
    const previous = [...host.querySelectorAll('button')].find(b => b.textContent === 'Previous snapshot')!;
    await act(async () => previous.click());
    expect(host.querySelector('caption')!.textContent).toContain('2026-11-14');
    expect(host.querySelector('select')!.value).toBe('0');
    const queued: (() => void)[] = [];
    (document as any).startViewTransition = ({ update }: { update: () => void }) => {
      queued.push(update);
      return { skipTransition() {}, ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve() };
    };
    const select = host.querySelector('select')!;
    await act(async () => {
      select.value = '0'; select.dispatchEvent(new win.Event('change', { bubbles: true }) as any);
      select.value = '1'; select.dispatchEvent(new win.Event('change', { bubbles: true }) as any);
      queued.reverse().forEach(update => update());
    });
    expect(host.querySelector('caption')!.textContent).toContain('2026-11-15');
    delete (document as any).startViewTransition;
    await act(async () => root.unmount());
    fail = true; root = createRoot(host); await render();
    expect(host.querySelector('[role=alert]')!.textContent).toContain('unavailable');
    fail = false;
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('table')).not.toBeNull();
    expect(requests.every(method => method === 'GET')).toBe(true);
  } finally {
    await act(async () => root.unmount());
    for (const [k,v] of Object.entries(saved)) { if(v) Object.defineProperty(globalThis,k,v); else delete (globalThis as any)[k]; }
    await win.happyDOM.close();
  }
});
