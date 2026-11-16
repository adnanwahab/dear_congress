import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/draft?proposal=sample&topic=housing#text' });
for (const key of ['window','document','navigator','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let requests = 0;
globalThis.fetch = (async () => { requests++; throw Error('No network allowed'); }) as any;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { fireEvent, within } = await import('@testing-library/dom');
const { WorldPortal } = await import('../src/client/WorldPortal');
const root = createRoot(document.body.appendChild(document.createElement('div')));
await act(async () => root.render(<><input aria-label="Unsaved source" defaultValue="keep my draft"/><WorldPortal title="Source title" source="citizen:sample"><p>Modeled assumption only</p></WorldPortal></>));
const q = within(document.body);
const original = window.location.href;
const trigger = q.getByRole('button', { name: /Explore in HappyBearLandia/ });
await act(async () => fireEvent.click(trigger));
assert.equal(document.querySelector('dialog')?.open, true);
assert.equal(window.location.href, original);
assert(q.getByText(/Source reference/).textContent?.includes('citizen:sample'));
assert(q.getByText('Modeled assumption only'));
// Simulate browser traversal (Happy DOM does not implement native session traversal).
window.history.replaceState(null, '', original);
await act(async () => window.dispatchEvent(new dom.PopStateEvent('popstate')));
assert.equal(document.querySelector('dialog')?.open, false);
assert.equal(document.activeElement, trigger);
assert.equal((q.getByLabelText('Unsaved source') as HTMLInputElement).value, 'keep my draft');
assert.equal(requests, 0);
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('Portal retained URL, source draft, reference and focus with zero requests.');
