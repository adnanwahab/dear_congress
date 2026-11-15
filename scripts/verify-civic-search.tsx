import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { fireEvent } from '@testing-library/dom';
const dom = new Window({ url: 'http://localhost/bills?q=existing&ask=HFL-051' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// Both low-power and reduced-motion environments must use the same native path.
dom.matchMedia = (() => ({ matches: true })) as any;
let reads = 0;
globalThis.fetch = async (url, options) => { assert.equal(url, '/api/legislation'); assert(!options?.method || options.method === 'GET'); reads++; return Response.json({ bills: [] }); };
const { createRoot } = await import('react-dom/client');
const { CivicQuestionSearch } = await import('../src/client/CivicQuestionSearch');
const container = document.createElement('div'); document.body.append(container);
const root = createRoot(container);
await act(async () => root.render(<CivicQuestionSearch />));
const input = container.querySelector('input')!;
assert.equal(input.value, 'HFL-051');
assert.equal(container.querySelector('article a')?.getAttribute('href'), '/bills/HFL-051');
input.focus();
await act(async () => { fireEvent.input(input, { target: { value: 'How can childcare cost less?' } }); fireEvent.submit(container.querySelector('form')!); });
assert.equal(document.activeElement, input);
assert.equal(new URLSearchParams(window.location.search).get('q'), 'existing');
assert(container.querySelectorAll('article').length > 0);
await act(async () => { fireEvent.input(input, { target: { value: 'childcare' } }); });
await act(async () => { fireEvent.change(container.querySelector('select')!, { target: { value: 'Outcomes' } }); });
assert(container.textContent!.includes('Hypothetical walkthrough'));
// Back/forward popstate snapshots restore selection and results, without moving focus.
for (const url of ['/bills?ask=HFL-051&askType=Bills', '/bills?ask=no-such-evidence&askType=Needs']) {
  await act(async () => { window.history.replaceState(null, '', url); window.dispatchEvent(new dom.PopStateEvent('popstate')); });
  assert.equal(input.value, new URLSearchParams(window.location.search).get('ask'));
  assert.equal(container.querySelector('select')!.value, new URLSearchParams(window.location.search).get('askType'));
}
assert(container.textContent!.includes('No supported answer found'));
await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Clear question')!.click(); });
assert.equal(document.activeElement, input);
assert.equal(input.value, '');
assert(reads > 0);
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('PASS civic search history, selection, focus, empty coverage and reduced motion');
