import { expect, test } from 'bun:test';
import { budgetTotal, workableBudget, BUDGET_LINES } from './BudgetShock';

test('shock requires balancing while preserving all protected minimums', () => {
  expect(budgetTotal(BUDGET_LINES.map(line => line.baseline)) + 20).toBe(120);
  expect(workableBudget([50, 30, 20])).toBe(false);
  expect(workableBudget([50, 30, 0])).toBe(false);
  expect(workableBudget([40, 30, 10])).toBe(false);
  expect(workableBudget([50, 20, 10])).toBe(true);
  expect(workableBudget([50, NaN, 10])).toBe(false);
});

test('local full playthrough, constraint rejection, alternative receipt and reset', async () => {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://localhost/bills' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { BudgetShock } = await import('./BudgetShock');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const click = async (name: string) => {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === name)!;
    expect(button).toBeTruthy(); await act(async () => button.click());
  };
  try {
    await act(async () => root.render(<BudgetShock />));
    await click('Try fictional budget shock');
    expect(document.activeElement).toBe(host.querySelector('h2'));
    await click('Reveal hypothetical shock');
    expect(host.querySelector('[role="status"]')!.textContent).toContain('120 / 100');
    await click('Explore below-minimum plan');
    expect(host.textContent).toContain('Protected minimum violated');
    expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Inspect completed receipt')!.disabled).toBe(true);
    await click('Split reductions'); await click('Inspect completed receipt');
    expect(host.textContent).toContain('Fictional exercise complete');
    await click('Revise sandbox plan'); await click('Use fictional one-time reserve');
    expect(host.querySelector('[role="status"]')!.textContent).toContain('120 / 120');
    await click('Inspect completed receipt');
    expect(host.textContent).toContain('Reserve: 20 → 0');
    await click('Restart'); expect(host.textContent).toContain('Starting assumptions');
    await click('Skip'); expect(document.activeElement?.textContent).toBe('Try fictional budget shock');
    await click('Try fictional budget shock'); await click('Exit');
    expect(host.querySelector('details')!.textContent).toContain('Complete-text explanation');
    expect(window.localStorage.length).toBe(0); expect(window.sessionStorage.length).toBe(0);
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
