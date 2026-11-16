import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import WorkflowScreen from '../src/client/WorkflowScreen';
const dom = new Window({ url: 'http://localhost/outcomes' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const container = dom.document.createElement('div'); dom.document.body.append(container);
const root = createRoot(container as any);
let fail!: (reason: Error) => void;
const pending = new Promise<never>((_, reject) => { fail = reject; });
await act(async () => { root.render(<WorkflowScreen stage="outcomes" request={() => pending} />); });
// Wait for the independently split component to hydrate, not for the proposal API.
await act(async () => { await import('../src/client/ResponseComposition'); });
const simulator = () => container.querySelector('.response-composition')!;
assert(simulator(), 'available during proposal loading');
await act(async () => { fail(new Error('Offline')); });
assert.match(container.textContent!, /Could not load sample proposals/);
assert(simulator(), 'available during offline/API error');
const sliders = simulator().querySelectorAll('input');
assert.equal(sliders.length, 2);
for (const input of sliders) { assert.equal(input.type, 'range'); assert(input.closest('label')); }
// DOM input events exercise the shared keyboard/touch change handler. Native gestures require browser QA.
await act(async () => { sliders[0]!.value = '3'; sliders[0]!.dispatchEvent(new dom.Event('input', { bubbles: true })); });
assert.match(simulator().textContent!, /65.0%/);
const select = simulator().querySelector('select')!;
for (const id of ['conflicting', 'missing']) {
  await act(async () => { select.value = id; select.dispatchEvent(new dom.Event('change', { bubbles: true })); });
  const report = JSON.parse(simulator().querySelector('textarea')!.value);
  assert.equal(report.case.id, id); assert.equal(report.history.length, id === 'missing' ? 3 : 2);
}
assert.match(simulator().textContent!, /Missing — no source supplied/);
const buttons = [...simulator().querySelectorAll('button')];
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => { throw Error('Blocked'); } });
await act(async () => { (buttons.find(b => b.textContent!.includes('Export')) as any).click(); });
assert.match(simulator().querySelector('[role=alert]')!.textContent!, /Select and copy/);
(dom as any).print = () => { throw Error('Blocked'); };
await act(async () => { (buttons.find(b => b.textContent!.includes('Print')) as any).click(); });
assert.match(simulator().querySelector('[role=alert]')!.textContent!, /Print unavailable/);
await act(async () => { (buttons[0] as any).click(); });
assert.match(simulator().textContent!, /50.0%/);
assert.equal(JSON.parse(simulator().querySelector('textarea')!.value).history.length, 4);
await act(async () => root.unmount()); await dom.happyDOM.close();
console.log('PASS composition controls, provenance log, offline/loading, export/print fallbacks');
