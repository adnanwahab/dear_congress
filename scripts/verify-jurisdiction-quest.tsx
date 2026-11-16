import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { JurisdictionQuest, questCards } from '../src/client/JurisdictionQuest';
const dom = new Window();
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).fetch = () => { throw Error('Quest must not make requests'); };
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const container = dom.document.createElement('div');
dom.document.body.append(container);
const root = createRoot(container as any);
await act(async () => root.render(<JurisdictionQuest jurisdiction="Texas" />));
assert.match(container.querySelector('legend')!.textContent!, /driver license/);
assert.equal(container.querySelectorAll('fieldset').length, 4);
assert.equal((container.querySelector('[type=submit]') as any).disabled, true);
const cards = questCards('Texas');
for (const [index, select] of [...container.querySelectorAll('select')].entries()) {
  await act(async () => { select.value = index === 0 ? 'Federal' : cards[index]!.level; select.dispatchEvent(new dom.Event('change', { bubbles: true })); });
}
await act(async () => { container.querySelector('form')!.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })); });
assert.match(container.querySelector('[role=status]')!.textContent!, /3 of 4 matched/);
assert.match(container.textContent!, /special-purpose district/);
assert.match(container.textContent!, /Try this: State/);
await act(async () => { (container.querySelector('[type=button]') as any).click(); });
assert.match(container.querySelector('[role=status]')!.textContent!, /0 of 4 answered/);
assert(!container.textContent!.includes('Try this:'));
await act(async () => root.unmount());
console.log('PASS quest matching, overlap feedback, scope ordering, reset and no requests');
