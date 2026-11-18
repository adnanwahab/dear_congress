import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { billCollection } from '../src/shared/bill-catalog';

const dom = new Window({ url: 'http://localhost/bills?law=HFL-051&q=community' });
for (const key of ['window', 'document', 'navigator']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : dom[key as 'document'|'navigator'] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { LawCarousel } = await import('../src/client/LawCarousel');
const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
let calls = 0;
globalThis.fetch = async () => { calls++; throw new Error('No network required for law visualization'); };

await act(async () => root.render(<LawCarousel bills={billCollection.bills} />));
const selection = () => container.querySelector('.law-carousel__controls p')?.textContent ?? '';
const keyboard = async (key: string, target: Element | null = container.querySelector('.law-carousel')) => {
  assert(target, 'target exists');
  await act(async () => target!.dispatchEvent(new dom.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
};
assert.equal(container.querySelectorAll('.law-carousel__thumb').length, 100);
assert.match(selection(), /HFL-051.*Third Places/);
assert.match(container.querySelector('.law-carousel__stage')!.textContent!, /Access to free gathering spaces/);
assert.equal(container.querySelector('.law-carousel__thumb--active')?.getAttribute('data-law-id'), 'HFL-051');
await keyboard('ArrowRight');
assert.match(selection(), /HFL-052/);
assert.equal(new URLSearchParams(window.location.search).get('law'), 'HFL-052');
assert.equal(new URLSearchParams(window.location.search).get('q'), 'community');
await keyboard('ArrowLeft');
assert.match(selection(), /HFL-051/);
await keyboard('Home');
assert.match(selection(), /HFL-001/);
await keyboard('End');
assert.match(selection(), /HFL-100/);
await keyboard('ArrowRight');
assert.match(selection(), /HFL-001/, 'next wraps at end of all 100 drafts');

const input = document.createElement('input');
container.querySelector('.law-carousel')!.append(input);
input.focus();
await keyboard('ArrowRight', input);
assert.match(selection(), /HFL-001/, 'arrows within inputs are not hijacked');
input.remove();

const jump = container.querySelector('[data-law-id="HFL-090"]') as HTMLButtonElement;
await act(async () => jump.click());
assert.match(selection(), /HFL-090/);
assert.match(container.querySelector('.law-carousel__stage')!.textContent!, /Public Futures Simulation/);
assert.match(container.querySelector('.law-carousel__stage')!.textContent!, /Models reproducible/);
assert.equal(calls, 0);
await act(async () => root.unmount());
console.log('Law carousel: 100 scenes, deep link, keyboard navigation, wrap, input exclusion, thumbnail selection, no fetch passed.');
