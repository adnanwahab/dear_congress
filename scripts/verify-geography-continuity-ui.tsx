/** Isolated DOM integration; does not claim native browser layout/accessibility QA. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import MapScreen from '../src/client/MapScreen';
import counties from '../src/client/data/counties.json';
import { countyVote, improvePlan, INITIAL_PLAN } from '../src/client/county-simulation';

const dom = new Window({ url: 'http://localhost/map' });
for (const key of ['window', 'document', 'navigator']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
Object.defineProperty(dom, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const container = dom.document.createElement('div');
dom.document.body.append(container);
const root = createRoot(container as any);
await act(async () => { root.render(<MapScreen />); });
const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name)!;
const click = async (name: string) => { await act(async () => { (button(name) as any).click(); }); };
await click('List view (map-free)');
assert.equal(container.querySelectorAll('.county-svg').length, 0);
assert.equal(dom.document.activeElement, container.querySelector('tbody tr'));
assert(container.querySelector('tbody tr')!.textContent!.includes('48201'));
await click('Map view');
assert.equal(dom.document.activeElement, button('Map view'));
// Animation API failure still commits the destination and focuses its accessible row.
Object.defineProperty(dom, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
(dom.document as any).startViewTransition = () => { throw new Error('snapshot failed'); };
await click('Hypothetical model agrees0 / 3,144');
await click('List view (map-free)');
assert.equal(container.querySelectorAll('.county-results button').length, 0);
assert(container.textContent!.includes('The selected county is outside the current filters'));
assert.equal(dom.document.activeElement, container.querySelector('tbody tr'));
await click('Map view');
// Newer input invalidates an older deferred visual callback.
const updates: (() => void)[] = [];
(dom.document as any).startViewTransition = ({ update, types }: any) => {
  assert.deepEqual(types, ['geography-mode']);
  updates.push(update);
  return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition() {} };
};
await click('List view (map-free)');
await click('Map view');
await act(async () => { updates[1]!(); updates[0]!(); });
assert.equal(container.querySelectorAll('.county-svg').length, 1, 'obsolete transition cannot restore list mode');
await click('List view (map-free)');
await act(async () => { root.unmount(); updates[2]!(); });
await dom.happyDOM.close();
console.log('PASS geography continuity: selection, focus, failed snapshots, filters and interrupted transitions');
