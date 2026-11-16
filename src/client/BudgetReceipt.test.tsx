import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BudgetReceipt } from './BudgetReceipt';
import type { BudgetRow } from '../shared/plan-budget';
const row: BudgetRow = { id: 'one', title: 'Bus service', jurisdiction: 'Houston', amount: 600, cumulative: 600, source: 'Illustrative catalog assumption', date: 'Not recorded' };
test('receipt exposes source, funding/time assumptions and simulated labels in both lanes', () => {
  for (const lane of ['real', 'blended']) {
    const html = renderToStaticMarkup(<BudgetReceipt rows={[row]} lane={lane} />);
    for (const text of ['not a verified personal tax bill', 'simulated fiscal amounts in both lanes', 'Unspecified in the model', '1 year denominator', '2,304,580', 'April 1, 2020', 'Receipt proposal', 'Receipt view']) expect(html).toContain(text);
    expect(html).toContain('https://www.census.gov/');
  }
  expect(renderToStaticMarkup(<BudgetReceipt rows={[]} lane="real" />)).toContain('No allocated proposals');
});
test('selection changes convert locally, missing denominators fail and annual view recovers', async () => {
  const { Window } = await import('happy-dom'); const window = new Window();
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v });
  const { createRoot } = await import('react-dom/client'); const { act } = await import('react');
  const host = document.createElement('div'); const root = createRoot(host);
  const rows = [row, { ...row, id: 'other', jurisdiction: 'Unknown' }]; const original = JSON.stringify(rows);
  try {
    await act(async () => root.render(<BudgetReceipt rows={rows} lane="real" />));
    const [proposal, view] = host.querySelectorAll('select');
    const change = async (select: HTMLSelectElement, value: string) => { await act(async () => { select.value = value; select.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); }); };
    await change(view!, 'resident'); expect(host.querySelector('[role=status]')!.textContent).toContain('$260.35 per resident per year');
    await change(proposal!, 'other'); expect(host.querySelector('[role=status]')!.textContent).toContain('No sourced resident denominator');
    await change(view!, 'annual'); expect(host.querySelector('[role=status]')!.textContent).toContain('$600,000,000.00 per year');
    expect(JSON.stringify(rows)).toBe(original);
  } finally {
    await act(async () => root.unmount());
    for (const k of Object.keys(globals)) { if (previous[k]) Object.defineProperty(globalThis, k, previous[k]!); else Reflect.deleteProperty(globalThis, k); }
    await window.happyDOM.close();
  }
});
