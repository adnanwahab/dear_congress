import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanWorkbench } from './PlanWorkbench';
import { PROPOSALS } from '../engine/catalog';

test('loading and empty workbench explicitly remain advisory', () => {
  expect(renderToStaticMarkup(<PlanWorkbench proposals={[]} lane="real" loading />)).toContain('Loading policies');
  const html = renderToStaticMarkup(<PlanWorkbench proposals={[]} lane="synthetic" />);
  expect(html).toContain('No policies available'); expect(html).toContain('Includes simulated inputs'); expect(html).toContain('$40.000B');
});

test('buttons and drag share deterministic local changes with reduced motion', async () => {
  const { Window } = await import('happy-dom');
  const win = new Window();
  const globals = { window: win, document: win.document, navigator: win.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client'); const { act } = await import('react');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const proposals = [25, 20, null].map((costB, i) => ({ ...PROPOSALS[0]!, id: `p${i}`, title: `Policy ${i}`, costB }));
  proposals.push({ ...proposals[0]!, id: 'blocked', title: 'Blocked', rightsIssue: 'Rights constraint' });
  const original = JSON.stringify(proposals);
  try {
    win.matchMedia = (() => ({ matches: true })) as unknown as typeof win.matchMedia;
    document.startViewTransition = (() => { throw new Error('Reduced motion must skip transition'); }) as typeof document.startViewTransition;
    await act(async () => root.render(<PlanWorkbench proposals={proposals} lane="real" />));
    const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    expect(button('Add Policy 2').disabled).toBe(true); expect(button('Add Blocked').disabled).toBe(true);
    // Native buttons provide the same activation for keyboard and touch.
    await act(async () => button('Add Policy 0').click());
    expect(host.textContent).toContain('Remaining $15.000B');
    const drop = (id: string, area: string) => {
      const e = new win.Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'dataTransfer', { value: { getData: () => id } });
      host.querySelector(`[aria-label="${area}"]`)!.dispatchEvent(e as unknown as Event);
    };
    await act(async () => drop('p1', 'Workbench drop area'));
    expect(host.textContent).toContain('Over budget by $5.000B');
    await act(async () => button('Remove Policy 0').click());
    expect(host.textContent).toContain('Remaining $20.000B');
    expect(host.querySelector('details')!.textContent).toContain('Removed Policy 0');
    expect(JSON.stringify(proposals)).toBe(original);
  } finally {
    await act(async () => root.unmount());
    for (const k of Object.keys(globals)) { if (previous[k]) Object.defineProperty(globalThis, k, previous[k]!); else Reflect.deleteProperty(globalThis, k); }
    await win.happyDOM.close();
  }
});
