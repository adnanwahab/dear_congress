import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';


import { WORKSPACE_KEY } from '../src/client/proposal-workspace';
const dom = new Window({ url: 'http://localhost/proposals/new?guided=1' });
for (const key of ['window', 'document', 'navigator', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { CitizenProposalsApp } = await import('../src/client/CitizenProposals');
let requests = 0;
globalThis.fetch = async () => { requests++; throw new Error('Private workspace must not fetch'); };
localStorage.setItem('civic_synthesis_proposal_drafts_v1', 'legacy sentinel');
const container = dom.document.createElement('div'); dom.document.body.append(container);
let root = createRoot(container as any);
async function render() { await act(async () => { root.render(<CitizenProposalsApp />); }); }
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === text);
  assert(button, text); await act(async () => { button.click(); });
}
await render();
assert.match(container.textContent!, /Propose a change/);
for (const field of container.querySelectorAll('textarea,select')) assert(container.querySelector(`label[for="${field.id}"]`));
const problem = container.querySelector('#workspace-problem') as any;
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(dom.HTMLTextAreaElement.prototype, 'value')!.set!;
  setter.call(problem, 'The late bus leaves before my shift ends. <script>unsafe</script>');
  problem.dispatchEvent(new dom.Event('input', { bubbles: true }));
  problem.dispatchEvent(new dom.Event('change', { bubbles: true }));
});
// React event handling in this DOM environment is verified via the persisted value.
await click('Save privately');
assert.match(localStorage.getItem(WORKSPACE_KEY)!, /late bus/);
await click('Next'); await click('Next'); await click('Next');
assert.match(container.textContent!, /Add costs/);
assert.match(container.textContent!, /Add source links/);
assert.match(container.textContent!, /Choose a jurisdiction/);
assert.equal(container.querySelectorAll('script').length, 0);
assert.match((container.querySelector('#workspace-output') as any).value, /late bus/);
await act(async () => { root.unmount(); }); root = createRoot(container as any); await render();
assert.match((container.querySelector('#workspace-problem') as any).value, /late bus/);
assert.match(container.querySelector('[role=status]')!.textContent!, /Resumed/);
const saved = localStorage.getItem(WORKSPACE_KEY)!;
const workingStorage = localStorage;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: workingStorage.getItem.bind(workingStorage),
  setItem: () => { throw new Error('QuotaExceededError'); },
} });
await click('Save privately'); assert.match(container.querySelector('[role=alert]')!.textContent!, /Could not save/);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: workingStorage });
assert.equal(localStorage.getItem(WORKSPACE_KEY), saved);
await act(async () => { root.unmount(); });
localStorage.setItem(WORKSPACE_KEY, '{broken'); root = createRoot(container as any); await render();
assert.match(container.querySelector('[role=alert]')!.textContent!, /has not been overwritten/);
assert.equal(( [...container.querySelectorAll('button')].find(b => b.textContent === 'Save privately') as any).disabled, true);
assert.equal(localStorage.getItem(WORKSPACE_KEY), '{broken');
assert.equal(localStorage.getItem('civic_synthesis_proposal_drafts_v1'), 'legacy sentinel');
assert.equal(requests, 0);
await act(async () => { root.unmount(); });
console.log('PASS private guided workspace');
