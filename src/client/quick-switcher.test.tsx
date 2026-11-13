import { expect, test } from 'bun:test';
import { matchDestinations, SWITCH_DESTINATIONS } from './quick-switcher';
import { pageTitle } from '../shared/page-metadata';
import { NEEDS } from '../engine/catalog';

test('catalog preserves proposal routing and finds words across title and stage', () => {
  expect(SWITCH_DESTINATIONS.filter(r => r.type === 'Stage')).toHaveLength(6);
  expect(SWITCH_DESTINATIONS.filter(r => r.type === 'Proposal')).toHaveLength(36);
  expect(SWITCH_DESTINATIONS.filter(r => r.type === 'Need')).toHaveLength(NEEDS.length);
  expect(matchDestinations('childcare draft')[0]?.href).toBe('/draft?proposal=demo-childcare');
  expect(matchDestinations('Cap childcare')[0]?.href).toBe('/votes?proposal=demo-childcare');
  expect(matchDestinations('affordable childcare').some(r => r.href === '/needs?need=childcare')).toBe(true);
  expect(matchDestinations('zzzzzz')).toHaveLength(0);
  expect(pageTitle('/')).toBe('Overview | Civic Synthesis');
});

test('global shortcut, field exclusion, combobox navigation, escape and focus restoration', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { QuickSwitcher } = await import('./QuickSwitcher');
  const w = new Window();
  const document = w.document;
  const globals = { window: w, document: w.document, Element: w.Element, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const origin = document.createElement('button'); document.body.append(origin);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    await act(async () => root.render(<QuickSwitcher />));
    const dialog = document.querySelector('dialog')!;
    // happy-dom lacks native top-layer focus behavior; exercise component lifecycle with a platform shim.
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => { dialog.removeAttribute('open'); dialog.dispatchEvent(new w.Event('close')); };
    origin.focus();
    await act(async () => origin.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true })));
    expect(dialog.open).toBe(true);
    const input = dialog.querySelector('input')!;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await act(async () => input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(input.getAttribute('aria-activedescendant')).toBe('switch-result-1');
    await act(async () => dialog.dispatchEvent(new w.Event('cancel', { cancelable: true })));
    expect(dialog.open).toBe(false); expect(document.activeElement).toBe(origin);
    const field = document.createElement('textarea'); document.body.append(field); field.focus();
    await act(async () => field.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
    expect(dialog.open).toBe(false);
    origin.focus();
    await act(async () => origin.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
    expect(dialog.open).toBe(true);
    await act(async () => dialog.dispatchEvent(new w.MouseEvent('click', { clientX: -1, clientY: -1, bubbles: true })));
    expect(dialog.open).toBe(false); expect(document.activeElement).toBe(origin);
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    w.happyDOM.abort();
  }
});
