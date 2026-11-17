import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { DEMO_ITEMS, type DemoPayload } from '../src/engine/demo';

test('browsing never votes; only acknowledged submissions confirm, with retry and URL restoration', async () => {
  const dom = new Window({ url: 'http://localhost/' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) {
    Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
  }
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { act, createElement } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { fireEvent, within } = await import('@testing-library/dom');
  const { Dashboard } = await import('../src/client/Dashboard');
  const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
  try {
    for (const page of ['/', '/feed', '/votes']) {
      dom.happyDOM.setURL('http://localhost' + page);
      // Each page is a fresh visit: no remembered selection or snapshot from the previous page.
      sessionStorage.clear();
      document.body.innerHTML = '<div id="root"></div>';
      const root = createRoot(document.getElementById('root')!);
      let payload: DemoPayload = { items: DEMO_ITEMS.slice(0, 2), votes: {}, updatedAt: '2026-11-13', closesAt: '2026-11-20' };
      const writes: any[] = [];
      let settle: (() => void) | undefined;
      let fail = false;
      const request = async <T,>(path: string, body?: any): Promise<T> => {
        if (path === '/api/state') return { needs: [], user: { allocation: {} } } as T;
        if (body) {
          writes.push(body);
          await new Promise<void>(resolve => { settle = resolve; });
          if (fail) throw new Error('Vote could not be saved');
          payload = { ...payload, votes: { [body.votes[0].proposalId]: body.votes[0].stance } };
          return { ok: true } as T;
        }
        return payload as T;
      };
      const render = () => page === '/' ? createElement(Dashboard, { request }) : createElement(WorkflowScreen, { stage: page.slice(1) as 'feed' | 'votes', request });
      await act(async () => { root.render(render()); });
      const q = () => within(document.body);
      if (page === '/votes') {
        await act(async () => { fireEvent.change(q().getByRole('combobox', { name: 'Proposal' }), { target: { value: DEMO_ITEMS[1]!.id } }); });
      } else {
        await act(async () => { fireEvent.click(q().getAllByRole('button', { name: /^View proposal\b/ })[1]!); });
      }
      expect(writes).toHaveLength(0);
      expect(new URL(dom.location.href).searchParams.get('proposal')).toBe(DEMO_ITEMS[1]!.id);
      expect(document.body.textContent).not.toContain('✓');
      if (page !== '/feed') {
        const support = () => q().getByRole('button', { name: /Cast advisory vote: Support/ });
        await act(async () => { fireEvent.click(support()); });
        expect(writes).toHaveLength(1);
        expect(writes[0].votes[0].proposalId).toBe(DEMO_ITEMS[1]!.id);
        expect(support().getAttribute('aria-pressed')).toBe('false');
        expect(support().classList.contains('vote-confirmed')).toBe(false);
        expect(document.body.textContent).not.toContain('vote saved');
        fail = true;
        await act(async () => { settle!(); });
        expect(q().getByRole('alert').textContent).toContain(page === '/votes' ? 'could not confirm whether' : 'Vote could not be saved');
        expect(support().getAttribute('aria-pressed')).toBe('false');
        fail = false;
        await act(async () => { fireEvent.click(support()); });
        await act(async () => { settle!(); });
        expect(support().getAttribute('aria-pressed')).toBe('true');
        if (page === '/votes') expect(document.querySelector('.advisory-receipt')?.textContent).toContain('choice: Support');
        else expect(support().classList.contains('vote-confirmed')).toBe(true);
        expect(support().getAttribute('aria-label')).toMatch(/responses, [0-9.]+%/);
        expect(document.querySelectorAll('.advisory-track')).toHaveLength(3);
        expect(document.body.textContent).toContain('Illustrative responses, not a representative poll.');
        expect(q().getAllByRole('status').map(node => node.textContent).join(' ')).toMatch(page === '/votes' ? /Server confirmed advisory choice/ : /vote (is )?saved/);
      }
      await act(async () => { root.unmount(); });
      const restored = createRoot(document.getElementById('root')!);
      await act(async () => { restored.render(render()); });
      expect(document.body.textContent).toContain(DEMO_ITEMS[1]!.summary);
      expect(writes).toHaveLength(page === '/feed' ? 0 : 2);
      await act(async () => { restored.unmount(); });
    }
  } finally {
    // Restore globals so later test files never see this page's storage (e.g. a proposal snapshot).
    for (const key of keys) { const descriptor = previous.get(key); if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await dom.happyDOM.close();
  }
});


test('copied stage URLs restore public context in a fresh browser without sharing advisory choices', async () => {
  const dom = new Window({ url: 'http://localhost/feed' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { act, createElement } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { fireEvent, within } = await import('@testing-library/dom');
  const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
  const writes: unknown[] = [];
  const request = async <T,>(path: string, body?: unknown): Promise<T> => {
    if (body) writes.push(body);
    return { items: DEMO_ITEMS, votes: { 'demo-transit': 1 }, updatedAt: '2026-11-13', closesAt: '2026-11-20' } as T;
  };
  try {
    for (const stage of ['feed', 'draft', 'sponsors', 'outcomes'] as const) {
      sessionStorage.clear(); localStorage.clear();
      dom.history.replaceState(null, '', `/${stage}?topic=transit&proposal=demo-transit`);
      // The recipient's saved scope and selection must not override the shared link.
      localStorage.setItem('civic_browse_jurisdiction_v1', 'Houston');
      sessionStorage.setItem('civic_demo_selection_v1', 'demo-housing');
      document.body.innerHTML = '<div id="root"></div>';
      let root = createRoot(document.getElementById('root')!);
      await act(async () => { root.render(createElement(WorkflowScreen, { stage, request })); });
      expect(document.querySelector('.workflow-detail-title')?.textContent ?? within(document.body).getByRole('region', { name: 'Proposal context' }).textContent).toContain(DEMO_ITEMS.find(i => i.id === 'demo-transit')!.title);
      const copied = dom.location.href;
      expect(Object.fromEntries(new URL(copied).searchParams)).toEqual({ topic: 'transit', proposal: 'demo-transit' });
      expect(document.querySelector('.workflow-next')?.getAttribute('href')).toContain('topic=transit');
      await act(async () => { root.unmount(); });
      sessionStorage.clear(); localStorage.clear(); dom.history.replaceState(null, '', copied);
      root = createRoot(document.getElementById('root')!);
      await act(async () => { root.render(createElement(WorkflowScreen, { stage, request })); });
      expect(dom.location.href).toBe(copied);
      expect(document.body.textContent).toContain(DEMO_ITEMS.find(i => i.id === 'demo-transit')!.title);
      await act(async () => { root.unmount(); });
    }
    // Filter-driven selection must also update the address bar on Feed.
    dom.history.replaceState(null, '', '/feed'); sessionStorage.clear();
    const root = createRoot(document.getElementById('root')!);
    await act(async () => { root.render(createElement(WorkflowScreen, { stage: 'feed', request })); });
    await act(async () => { fireEvent.change(within(document.body).getByRole('combobox', { name: 'Filter by topic' }), { target: { value: 'Transit' } }); });
    expect(Object.fromEntries(new URL(dom.location.href).searchParams)).toEqual({ proposal: 'demo-transit', topic: 'transit' });
    await act(async () => { root.unmount(); });
    expect(writes).toEqual([]);
  } finally {
    for (const key of keys) { const descriptor = previous.get(key); if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await dom.happyDOM.close();
  }
});
