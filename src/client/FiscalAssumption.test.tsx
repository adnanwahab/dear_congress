import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FiscalAssumption } from './FiscalAssumption';
import { PROPOSALS } from '../engine/catalog';

test('every cost kind discloses provenance limits, units, uncertainty and non-appropriation', () => {
  for (const costEstimate of [undefined, 'provisional', 'assessed', 'citizen', 'designed'] as const) {
    const html = renderToStaticMarkup(<FiscalAssumption proposal={{ ...PROPOSALS[0]!, costEstimate, costB: 1.234567 }} />);
    for (const copy of ['USD billions per year', 'Uncertainty range: unknown', 'not appropriated dollars or exact predictions', 'Independent fiscal source and estimate date: unknown', 'not source verification', 'not an evidence-backed range', 'about $1.23B']) expect(html).toContain(copy);
    expect(html).not.toContain('$1.234567');
  }
  for (const costB of [null, NaN, Infinity, -1]) {
    const html = renderToStaticMarkup(<FiscalAssumption proposal={{ ...PROPOSALS[0]!, emergent: true, costB }} />);
    expect(html).toContain('Unreviewed citizen concept');
    expect(html).toContain('Sensitivity unavailable: baseline cost unknown');
    expect(html).toContain('disabled=""');
  }
});

test('sensitivity changes local cost and delta, resets, and never mutates its proposal', async () => {
  const { Window } = await import('happy-dom'); const window = new Window();
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client'); const { act } = await import('react');
  const host = document.createElement('div'); const root = createRoot(host);
  const proposal = Object.freeze({ ...PROPOSALS[0]!, costB: 20 }); const original = JSON.stringify(proposal);
  try {
    await act(async () => root.render(<FiscalAssumption proposal={proposal} />));
    const slider = host.querySelector('input')!;
    expect(slider.closest('label')!.textContent).toContain(proposal.title);
    for (const [percent, cost, delta] of [[200, 40, '+about $20'], [0, 0, '−about $20'], [150, 30, '+about $10']] as const) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(slider, String(percent));
        slider.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
        slider.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event);
      });
      expect(host.querySelector('[role="status"]')!.textContent).toContain(`about $${cost}B`);
      expect(host.querySelector('[role="status"]')!.textContent).toContain(delta);
    }
    await act(async () => host.querySelector('button')!.click());
    expect(slider.value).toBe('100');
    expect(JSON.stringify(proposal)).toBe(original);
    await act(async () => root.render(<FiscalAssumption key="new-revision" proposal={{ ...proposal, costB: 0 }} />));
    expect(host.querySelector('input')!.disabled).toBe(false);
    expect(host.querySelector('[role="status"]')!.textContent).toContain('about $0B');
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
