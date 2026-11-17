import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { fireEvent } from '@testing-library/dom';
const dom = new Window({ url: 'http://localhost/bills?q=HFL-051&category=Housing' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// Reduced-motion/low-power environment: component must work without animation APIs.
dom.matchMedia = (() => ({ matches: true })) as any;
const { createRoot } = await import('react-dom/client');
const { PlaceCosts } = await import('../src/client/PlaceCosts');
const container = document.createElement('div'); document.body.append(container);
const root = createRoot(container);
let requests = 0; globalThis.fetch = async () => { requests++; throw Error('offline'); };
await act(async () => root.render(<PlaceCosts now={Date.parse('2027-01-01')} />));
assert.match(container.textContent!, /Stale source check/);
assert.match(container.textContent!, /Missing: no reviewed city-wide childcare/);
const input = container.querySelector('input')!;
input.focus();
await act(async () => fireEvent.input(input, { target: { value: 'zzzz' } }));
assert.equal(document.activeElement, input);
assert.match(container.textContent!, /No places match/);
assert.equal(new URLSearchParams(window.location.search).get('q'), 'HFL-051');
const selects = container.querySelectorAll('select');
await act(async () => fireEvent.change(selects[0]!, { target: { value: '' } }));
assert.match(container.textContent!, /Select an available place/);
// Native back/forward dispatch restores both search and selections from URLs.
for (const url of ['/bills?placeA=new-york-ny&placeB=chicago-il&placeSearch=New', '/bills?placeA=chicago-il&placeB=new-york-ny']) {
  await act(async () => { window.history.replaceState(null, '', url); window.dispatchEvent(new dom.PopStateEvent('popstate')); });
  assert.equal(selects[0]!.value, new URLSearchParams(window.location.search).get('placeA'));
  assert.equal(input.value, new URLSearchParams(window.location.search).get('placeSearch') ?? '');
}
assert(container.querySelector('a[href="/topics/housing"]'));
await act(async () => root.render(<PlaceCosts places={[]} />));
assert.match(container.textContent!, /No published place dataset/);
assert.equal(requests, 0);
await act(async () => root.unmount()); await dom.happyDOM.close();
console.log('PASS place costs');
