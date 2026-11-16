import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
const dom = new Window({ url: 'http://localhost/bills' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { PolicyPinball, PINBALL_RULES } = await import('../src/client/PolicyPinball');
const container = document.createElement('div'); document.body.append(container);
const root = createRoot(container);
let opened = 0;
globalThis.fetch = async () => { throw new Error('Game must never fetch'); };
await act(async () => root.render(<PolicyPinball onOpen={() => opened++} />));
async function click(label: string) {
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === label)!.click());
}
const launch = 'Play policy pinball · fictional learning game';
assert.equal(container.querySelector('[role="status"]'), null);
await click(launch);
assert.equal(opened, 1);
assert.equal(container.querySelectorAll('details li').length, 4);
await click('Launch token');
for (let i = 0; i < 4; i++) {
  if (i) await click('Next bounce');
  assert(container.querySelector('[role="status"]')!.textContent!.includes(PINBALL_RULES[i]!.result));
}
assert(container.querySelector('[role="status"]')!.textContent!.includes('Playthrough complete'));
assert((container.querySelector('.pinball-controls button') as HTMLButtonElement).disabled);
await click('Restart');
assert(container.querySelector('[role="status"]')!.textContent!.includes('Ready to launch'));
await click('Skip');
assert.equal(document.activeElement, container.querySelector('button'));
await click(launch); await click('Launch token'); await click('Exit'); await click(launch);
assert(container.querySelector('[role="status"]')!.textContent!.includes('Ready to launch'));
await act(async () => { container.querySelector('.policy-pinball > div')!.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
assert.equal(container.querySelector('[role="status"]'), null);
assert.equal(document.activeElement, container.querySelector('button'));
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('PASS pinball: fixed playthrough, complete text, restart, skip, exit, Escape and focus restoration');
