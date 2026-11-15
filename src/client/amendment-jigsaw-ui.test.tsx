import { expect, test } from 'bun:test';
import { AmendmentJigsaw } from './AmendmentJigsaw';

test('assemble, inspect conflicts, repair, restart, skip and exit without writes', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({ url: 'http://localhost/bills' });
  let writes = 0;
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => { writes++; throw new Error('Puzzle must not fetch'); } };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  async function click(text: string) { const button = [...host.querySelectorAll('button')].find(b => b.textContent === text)!; await act(async () => button.click()); }
  async function pick(slot: number, piece: number) { await act(async () => (host.querySelectorAll('fieldset')[slot]!.querySelectorAll('input')[piece] as HTMLInputElement).click()); }
  try {
    await act(async () => root.render(<AmendmentJigsaw />));
    await click('Play amendment jigsaw');
    for (let slot = 0; slot < 5; slot++) await pick(slot, slot === 0 || slot === 3 ? 1 : 0);
    await click('Check assembly');
    expect(host.querySelector('[role=status]')!.textContent).toContain('3 conflicts');
    expect(host.textContent).toContain('town office has no regional authority');
    for (const slot of [1, 2, 4]) await pick(slot, 1);
    await click('Check assembly');
    expect(host.querySelector('[role=status]')!.textContent).toContain('Internally consistent');
    expect(host.querySelector('summary')!.textContent).toBe('Complete text and explanation');
    await click('Restart'); expect(host.querySelectorAll('input:checked')).toHaveLength(0);
    await click('Skip'); expect(document.activeElement!.textContent).toBe('Play amendment jigsaw');
    await click('Play amendment jigsaw'); await click('Exit jigsaw');
    expect(host.querySelectorAll('fieldset')).toHaveLength(0); expect(writes).toBe(0);
  } finally {
    await act(async () => root.unmount()); await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
