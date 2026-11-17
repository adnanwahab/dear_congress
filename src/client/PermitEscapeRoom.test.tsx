import { expect, test } from 'bun:test';
import { act } from 'react';
import { Window } from 'happy-dom';
import { getByRole } from '@testing-library/dom';
import { PermitEscapeRoom } from './PermitEscapeRoom';

test('permit puzzle completes, retries, skips, resets and exits without requests or storage', async () => {
  const dom = new Window({ url: 'http://localhost/bills' });
  const globals = { window: dom, document: dom.document, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (() => { throw new Error('Puzzle must never request data'); }) };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const { createRoot } = await import('react-dom/client');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let opened = 0;
  const click = async (name: string) => act(async () => getByRole(host, 'button', { name }).click());
  try {
    await act(async () => root.render(<PermitEscapeRoom onOpen={() => opened++} />));
    await click('Play permit escape room');
    expect(opened).toBe(1);
    expect((getByRole(host, 'button', { name: 'Review conflicting rules' }) as HTMLButtonElement).disabled).toBe(true);
    for (const permit of ['Building', 'Electrical', 'Mechanical']) await click(`Recover ${permit} permit`);
    await click('Review conflicting rules');
    await click('Follow the old memo');
    expect(getByRole(host, 'status').textContent).toContain('conflicts');
    await click('Confirm the current checklist with the coordinator');
    await click('Open Tuesday to beat the deadline');
    expect(getByRole(host, 'status').textContent).toContain('incomplete');
    await click('Finish trade work → inspection → occupancy review → Friday opening if approved');
    expect(host.textContent).toContain('Fictional backlog untangled');
    expect(host.textContent).toContain('Entire fictional story and solution');
    await click('Restart puzzle');
    expect(host.textContent).toContain('0 of 3 fictional permits recovered');
    await click('Skip puzzle');
    expect(getByRole(host, 'status').textContent).toContain('skipped');
    await click('Exit puzzle');
    expect(host.querySelector('dialog')?.open).toBe(false);
    expect(document.activeElement?.textContent).toBe('Play permit escape room');
    await click('Play permit escape room');
    await click('Recover Building permit');
    await act(async () => { host.querySelector('dialog')!.dispatchEvent(new dom.Event('cancel', { cancelable: true })); });
    expect(host.querySelector('dialog')?.open).toBe(false);
    expect(host.textContent).toContain('0 of 3 fictional permits recovered');
    expect(document.activeElement?.textContent).toBe('Play permit escape room');
    expect(dom.localStorage.length).toBe(0);
    expect(dom.sessionStorage.length).toBe(0);
  } finally {
    await act(async () => root.unmount()); await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
