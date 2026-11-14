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
Object.defineProperty(dom, 'matchMedia', { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const container = dom.document.createElement('div');
dom.document.body.append(container);
const root = createRoot(container as any);
await act(async () => { root.render(<MapScreen />); });
const panel = container.querySelector('.county-methodology')!;
assert.equal(panel.querySelector('summary')!.textContent, 'How is agreement calculated?');
// Native details/summary supplies keyboard disclosure behavior without custom handlers.
assert.equal(panel.tagName, 'DETAILS');
assert(!panel.hasAttribute('open'));
panel.setAttribute('open', '');
const buttons = () => [...container.querySelectorAll('button')];
const click = async (text: string) => {
  const button = buttons().find(b => b.textContent === text)!;
  assert(button && !(button as any).disabled, text);
  await act(async () => { (button as any).click(); });
};
const ids = counties.map(c => c.id);
assert.equal(container.querySelectorAll('path.county-shape title').length, counties.length);
assert([...container.querySelectorAll('path.county-shape title')].every(t => t.textContent!.includes('Not evaluated')));
await click('Hypothetical model agrees0 / 3,144');
assert.equal(container.querySelectorAll('.county-results button').length, 0);
assert(container.querySelector('.county-directory')!.textContent!.includes('0 / 3,144 synthetic scenarios'));
await click('Hypothetical model agrees0 / 3,144');
let plan = [...INITIAL_PLAN];
for (let revision = 1; revision <= 10; revision++) {
  const supported = ids.filter(id => countyVote(id, plan).status === 'agree').length;
  const ratio = `${supported.toLocaleString()} / ${counties.length.toLocaleString()}`;
  assert(panel.textContent!.includes(`Revision ${revision}: ${ratio} county models`));
  assert(container.querySelector('.county-progress')!.textContent!.includes(`${ratio} bundled county models`));
  assert.equal(container.querySelector('.county-progress progress')!.getAttribute('value'), String(supported));
  assert(container.querySelector('.county-metrics')!.textContent!.includes(revision === 1 ? 'Not evaluated' : `${(supported / counties.length * 100).toFixed(1)}%`));
  assert(container.textContent!.includes('Real verified county participation: unavailable'));
  assert(!container.textContent!.includes('counties participating'));
  assert(!panel.textContent!.includes('95%'));
  if (supported === counties.length) break;
  await click('Improve one revision');
  plan = improvePlan(plan, ids);
}
assert(panel.textContent!.includes('3,144 / 3,144 county models meet all four'));
const before = panel.textContent;
await click('Hypothetical model agrees3,144 / 3,144');
const search = container.querySelector('input[type=search]')!;
await act(async () => {
  Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value')!.set!.call(search, 'Harris');
  search.dispatchEvent(new dom.Event('input', { bubbles: true }));
});
assert(container.querySelector('.county-directory')!.textContent!.includes('Harris County, TX'));
assert.equal(container.querySelectorAll('.county-results button').length, counties.filter(c => `${c.name} ${c.state} ${c.id}`.toLowerCase().includes('harris')).length);
assert.equal(panel.textContent, before, 'search and filters must not redefine the denominator');
await click('Restart');
assert(panel.textContent!.includes('Revision 1: 0 / 3,144 county models meet all four'));
assert(panel.hasAttribute('open'), 'revision and restart retain the open explanation');
await act(async () => { root.unmount(); });
await dom.happyDOM.close();
console.log('PASS county counts: revisions, filters, restart and unavailable real observations');
