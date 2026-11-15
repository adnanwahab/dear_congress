import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementGame, PROCUREMENT_BIDS } from './ProcurementGame';

test('all hypothetical bids and tradeoffs are readable before playing', () => {
  const html = renderToStaticMarkup(<ProcurementGame />);
  for (const bid of PROCUREMENT_BIDS) {
    expect(html).toContain(bid.name);
    expect(html).toContain(bid.note);
  }
  expect(html).toContain('Complete text explanation');
  expect(html).toContain('No choice proves fairness');
  expect(html).toContain('No rewards, votes or changes to advisory participation');
  expect(html).not.toContain('type="radio"');
});

test('play, review every bid, restart, skip and exit use only component state', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window();
  const values = { window: dom, document: dom.document, requestAnimationFrame: (fn: () => void) => { fn(); return 0; }, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(values).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(values)) Object.defineProperty(globalThis, k, { configurable: true, value });
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  const click = async (name: string) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === name)!;
    expect(button).toBeDefined();
    await act(async () => button.click());
  };
  try {
    await act(async () => root.render(<ProcurementGame />));
    await click('Play procurement game');
    for (let i = 0; i < 3; i++) {
      await click('Compare fictional bids');
      await act(async () => (document.querySelectorAll('input')[i] as HTMLInputElement).click());
      await click('Review tradeoffs');
      expect(document.body.textContent).toContain(`${PROCUREMENT_BIDS[i]!.name} · illustrative scorecard`);
      expect(document.body.textContent).toContain('Fairness: not inferred');
      await click('Restart');
      expect(document.querySelectorAll('input').length).toBe(0);
    }
    await click('Skip');
    expect(document.body.textContent).toContain('Skipped without choosing');
    await click('Exit');
    expect(document.querySelectorAll('input').length).toBe(0);
    await click('Play procurement game');
    await click('Compare fictional bids');
    expect([...document.querySelectorAll('input')].every(input => !input.checked)).toBe(true);
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [k, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else Reflect.deleteProperty(globalThis, k); }
  }
});
