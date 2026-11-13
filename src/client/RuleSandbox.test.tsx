import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuleSandbox, RuleComparison } from './RuleSandbox';
import { DEFAULT_WEIGHTS } from '../engine/engine';
import { previewSynthesisRule } from '../server/synthesis-rule-preview';

const request = async <T,>(): Promise<T> => { throw new Error('offline'); };
test('sandbox explains normalization and unconfigured authority, and prevents zero-vector preview', () => {
  const render = (weights = DEFAULT_WEIGHTS) => renderToStaticMarkup(<RuleSandbox weights={weights} lambda={.25} budget={40} request={request} />);
  const html = render();
  expect(html).toContain('Raw total: 1.00');
  expect(html).toContain('0.30 ÷ 1.00 = 0.3000');
  expect(html).toContain('Electorate, eligibility, quorum and grace period: not configured');
  expect(html).toContain('role="status" aria-live="polite"');
  expect(html).toContain('aria-label="Scoring rule sandbox"');
  const invalid = render({ support: 0, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 0 });
  expect(invalid).toContain('role="alert"'); expect(invalid).toContain('disabled=""');
});
test('comparison exposes all packages with semantic headers and textual selection changes', () => {
  const preview = previewSynthesisRule({ weights: DEFAULT_WEIGHTS, lambda: 1, budget: 0 });
  const html = renderToStaticMarkup(<RuleComparison preview={preview} />);
  expect((html.match(/<caption>/g) ?? []).length).toBe(3);
  expect(html).toContain('scope="col"'); expect(html).toContain('scope="row"');
  expect(html).toContain('Removed'); expect(html).toContain('Rights blocked');
  expect(html).toContain('no live resident inputs'); expect(html).toContain('not measured personal welfare');
  expect(html).toContain('tabindex="0"'); expect(html).toContain('× 3 + 0.3');
});

test('preview interaction recovers from errors and discards responses after settings change', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { getByRole } = await import('@testing-library/dom');
  const window = new Window({ url: 'http://localhost/synth' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const pending: { resolve: (value: unknown) => void; reject: (reason: Error) => void }[] = [];
  const requests: unknown[] = [];
  const request = <T,>(path: string, body?: unknown) => { requests.push({ path, body }); return new Promise<T>((resolve, reject) => pending.push({ resolve: value => resolve(value as T), reject })); };
  const render = async (budget: number) => { await act(async () => root.render(<RuleSandbox weights={DEFAULT_WEIGHTS} lambda={.25} budget={budget} request={request} />)); };
  const click = async () => { await act(async () => getByRole(host, 'button', { name: 'Compare rule in sandbox' }).click()); };
  try {
    await render(40); await click();
    expect(getByRole(host, 'button').hasAttribute('disabled')).toBe(true);
    expect(requests[0]).toEqual({ path: '/api/synthesis-rule-preview', body: { weights: DEFAULT_WEIGHTS, lambda: .25, budget: 40 } });
    await act(async () => pending[0]!.reject(new Error('Network unavailable')));
    expect(getByRole(host, 'alert').textContent).toContain('Network unavailable');
    await click(); await render(0);
    await act(async () => pending[1]!.resolve(previewSynthesisRule({ weights: DEFAULT_WEIGHTS, lambda: .25, budget: 40 })));
    expect(host.querySelector('table')).toBeNull();
    await click();
    await act(async () => pending[2]!.resolve(previewSynthesisRule({ weights: DEFAULT_WEIGHTS, lambda: .25, budget: 0 })));
    expect(getByRole(host, 'status').textContent).toBe('Fixture comparison ready.');
    expect(host.querySelectorAll('table').length).toBe(3);
    await render(40); expect(host.querySelector('table')).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
