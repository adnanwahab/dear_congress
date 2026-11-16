import { expect, test } from 'bun:test';
import { CouncilRoleplay, COUNCIL_ROUNDS } from './CouncilRoleplay';

test('local council practice pauses, completes, exposes transcript and resets without requests', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { getByRole, getAllByRole } = await import('@testing-library/dom');
  const dom = new Window({ url: 'http://localhost/votes' });
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value });
  let tick: (() => void) | undefined;
  dom.setInterval = ((cb: () => void) => { tick = cb; return 1; }) as any;
  dom.clearInterval = (() => { tick = undefined; }) as any;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const click = async (name: string) => act(async () => { getByRole(host, 'button', { name }).click(); });
  try {
    await act(async () => root.render(<CouncilRoleplay />));
    expect(host.textContent).toContain('No account needed');
    expect(host.querySelectorAll('details article').length).toBe(5);
    await click('Start 5-minute scenario');
    expect(tick).toBeDefined();
    await act(async () => { for (let i = 0; i < 60; i++) tick!(); });
    expect(getByRole(host, 'status').textContent).toContain('Round 2');
    await click('Pause'); expect(tick).toBeUndefined();
    await click('Resume'); expect(tick).toBeDefined();
    await act(async () => { (getAllByRole(host, 'radio')[0] as HTMLInputElement).click(); });
    expect(tick).toBeUndefined();
    expect(getByRole(host, 'status').textContent).toContain('Paused');
    expect(host.querySelector('input:checked')).not.toBeNull();
    await click('Previous round');
    expect(getByRole(host, 'status').textContent).toContain('Round 1');
    for (let i = 0; i < 4; i++) await click('Next round');
    await click('Finish practice');
    expect(getByRole(host, 'status').textContent).toContain('Practice complete');
    await click('Restart scenario (paused)');
    expect(host.querySelector('input:checked')).toBeNull();
    expect(getByRole(host, 'status').textContent).toContain('Round 1');
    await click('Skip scenario'); expect(tick).toBeUndefined();
    expect(getByRole(host, 'status').textContent).toContain('skipped');
    expect(host.querySelectorAll('details article').length).toBe(COUNCIL_ROUNDS.length);
  } finally {
    await act(async () => root.unmount());
    for (const [k, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else Reflect.deleteProperty(globalThis, k); }
    await dom.happyDOM.close();
  }
});
