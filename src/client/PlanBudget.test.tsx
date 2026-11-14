import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanBudget } from './PlanBudget';
import { PROPOSALS } from '../engine/catalog';
import type { PackageResult } from '../engine/types';
const budgetFixture = () => {
  const proposals = [20, 15, 12].map((costB, i) => ({ ...PROPOSALS[0]!, id: ['one', 'two', 'alternative'][i]!, title: ['one', 'two', 'alternative'][i]!, costB }));
  const pkg = { id: 'A', items: proposals.slice(0, 2).map(proposal => ({ proposal })), budget: 40, totalCost: 35,
    scoreAudit: { proposals: [] }, deferred: [{ id: 'alternative', title: 'alternative', costB: 12, reason: "Doesn't fit the remaining budget", replaceIds: ['two'] }] } as unknown as PackageResult;
  return { pkg, proposals };
};

test('accessible table and formula survive filtering; preview and commit preserve original package', async () => {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://localhost/synth' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client'); const { act } = await import('react');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const { pkg, proposals } = budgetFixture(); const original = JSON.stringify(pkg);
  try {
    await act(async () => root.render(<PlanBudget pkg={pkg} proposals={proposals} lane="real" />));
    expect(host.querySelector('caption')!.textContent).toContain('cumulative cost equals');
    expect(host.textContent).toContain('$35.000B');
    const input = host.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'no match');
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
      input.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event);
    });
    expect(host.querySelectorAll('tbody tr').length).toBe(0);
    expect(host.textContent).toContain('$35.000B');
    const select = host.querySelector('select')!;
    await act(async () => { select.value = 'alternative'; select.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); });
    expect(host.textContent).toContain('Remove two: −$15.000B');
    expect(host.textContent).toContain('Add alternative: +$12.000B');
    expect(JSON.stringify(pkg)).toBe(original);
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Commit local ledger revision')!.click());
    expect(host.textContent).toContain('Local plan revision committed');
    const link = host.querySelector<HTMLAnchorElement>('a[download]')!;
    const summary = JSON.parse(decodeURIComponent(link.getAttribute('href')!.split(',').slice(1).join(',')));
    expect(summary.total).toBe(32000);
    expect(JSON.stringify(pkg)).toBe(original);
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Restore original ledger')!.click());
    expect(host.textContent).not.toContain('Local plan revision committed');
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
test('invalid plan visibly closes ledger without a downloadable valid summary', () => {
  const { pkg, proposals } = budgetFixture(); pkg.budget = 0;
  const html = renderToStaticMarkup(<PlanBudget pkg={pkg} proposals={proposals} lane="real" />);
  expect(html).toContain('role="alert"'); expect(html).toContain('Infeasible'); expect(html).not.toContain('download=');
});
