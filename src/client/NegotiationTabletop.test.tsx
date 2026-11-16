import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NegotiationTabletop } from './NegotiationTabletop';
import { previewTabletop, tabletopDefaults, tabletopDraft } from '../shared/negotiation-tabletop';

test('fixture arithmetic, over-budget behavior, validation and detached unsigned export', () => {
  expect(previewTabletop(tabletopDefaults)).toEqual({ eligible: 2, excluded: 4, cost: 2000, balance: 4000, fits: true });
  expect(previewTabletop({ budget: 0, grant: 2000, ceiling: 70000 })).toEqual({ eligible: 6, excluded: 0, cost: 12000, balance: -12000, fits: false });
  for (const key of ['budget', 'grant', 'ceiling']) for (const value of [NaN, Infinity, -1, 1.5, 999999]) expect(() => previewTabletop({ ...tabletopDefaults, [key]: value })).toThrow();
  const draft = tabletopDraft(tabletopDefaults);
  draft.parameters.budget = 0;
  expect(tabletopDefaults.budget).toBe(6000);
  expect(draft.status).toBe('unsigned proposal draft');
  expect(draft.authority).toContain('no signature');
  expect(draft.sourceRepository).toBe('adnanwahab/dear_congress');
});
test('native touch and keyboard sliders disclose tradeoffs and missing evidence without motion', () => {
  const html = renderToStaticMarkup(<NegotiationTabletop />);
  expect((html.match(/type="range"/g) ?? []).length).toBe(3);
  expect((html.match(/Who may gain or lose/g) ?? []).length).toBe(3);
  expect(html).toContain('aria-describedby="tabletop-ceiling"');
  expect(html).toContain('min-height:44px');
  expect(html).toContain('No motion or network loading is required');
  expect(html).toContain('not verified civic participation');
});
test('local concessions undo/reset and export failure recovery preserve source defaults', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { getByRole } = await import('@testing-library/dom');
  const window = new Window({ url: 'http://localhost/synth' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const originalCreate = URL.createObjectURL;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<NegotiationTabletop />));
    const ceiling = getByRole(host, 'slider', { name: 'Income eligibility ceiling' }) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(ceiling, '70000');
      ceiling.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
      ceiling.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event);
    });
    expect(getByRole(host, 'status').textContent).toContain('6 qualifying');
    await act(async () => getByRole(host, 'button', { name: 'Undo concession' }).click());
    expect(getByRole(host, 'status').textContent).toContain('2 qualifying');
    await act(async () => getByRole(host, 'button', { name: 'Reset tabletop' }).click());
    expect(ceiling.value).toBe('30000');
    URL.createObjectURL = () => { throw new Error('blocked'); };
    await act(async () => getByRole(host, 'button', { name: 'Export unsigned proposal draft' }).click());
    expect(getByRole(host, 'alert').textContent).toContain('copy');
    let exported: Blob | undefined;
    URL.createObjectURL = blob => { exported = blob as Blob; return 'blob:tabletop-test'; };
    await act(async () => getByRole(host, 'button', { name: 'Export unsigned proposal draft' }).click());
    expect(JSON.parse(await exported!.text())).toEqual(tabletopDraft(tabletopDefaults));
    expect(getByRole(host, 'status').textContent).toContain('No civic action recorded');
  } finally {
    URL.createObjectURL = originalCreate;
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
