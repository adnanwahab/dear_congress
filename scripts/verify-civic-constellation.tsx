import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
const dom = new Window({ url: 'http://localhost/bills?q=fixture' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { CivicConstellation } = await import('../src/client/CivicConstellation');
const container = document.createElement('div'); document.body.append(container);
const root = createRoot(container);
let writes = 0; globalThis.fetch = async () => { writes++; throw Error('No requests'); };
const fixture = { id: 'fixture', title: 'Hypothetical fixture', institution: 'Fixture', committee: 'Fixture', date: new Date(Date.now() + 86400000).toISOString(), status: 'confirmed' as const, source: { url: 'https://example.org/test', publisher: 'Hypothetical fixture', checkedAt: new Date().toISOString() }, topicIds: ['housing'], billIds: ['HFL-001'] };
await act(async () => root.render(<CivicConstellation events={[fixture]} />));
assert.equal(container.querySelectorAll('.civic-orbit button').length, 1);
await act(async () => { (container.querySelector('li button') as HTMLButtonElement).click(); await new Promise(r => setTimeout(r, 10)); });
assert.equal(new URLSearchParams(window.location.search).get('q'), 'fixture');
assert.equal(new URLSearchParams(window.location.search).get('event'), 'fixture');
assert.equal(document.activeElement?.getAttribute('aria-label'), 'Selected event evidence');
for (const url of ['/bills', '/bills?event=fixture', '/bills?event=missing']) {
  await act(async () => { window.history.replaceState(null, '', url); window.dispatchEvent(new dom.PopStateEvent('popstate')); });
  assert.equal(!!container.querySelector('[aria-label="Selected event evidence"]'), url.includes('event=fixture'));
}
await act(async () => (container.querySelector('input') as HTMLInputElement).click());
assert.equal(container.querySelector('.civic-orbit'), null);
assert.equal(container.querySelectorAll('li button').length, 1);
await act(async () => root.render(<CivicConstellation events={[]} />));
assert.match(container.textContent!, /No sourced events match/);
assert.equal(writes, 0);
await act(async () => root.unmount()); await dom.happyDOM.close();
