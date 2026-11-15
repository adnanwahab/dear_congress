/** Isolated DOM integration; does not contact any service. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import WorkflowScreen from '../src/client/WorkflowScreen';
const dom = new Window({ url: 'http://localhost/outcomes' });
for (const key of ['window', 'document', 'navigator', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const container = dom.document.createElement('div');
dom.document.body.append(container);
const root = createRoot(container as any);
const request = async <T,>(): Promise<T> => { throw new Error('Offline'); };
await act(async () => { root.render(<WorkflowScreen stage="outcomes" request={request} />); });
const measurements = container.querySelector('#policy-measurements')!;
assert(measurements, 'Measurements remain accessible when proposal API is unavailable');
const before = measurements.textContent;
const saved = JSON.stringify([{ id: 'local', title: 'Local activity', office: 'Demo office', stage: 2, updatedAt: 'Synthetic reply' }]);
dom.localStorage.setItem('civic_demo_tracker_v1', saved);
await act(async () => { dom.dispatchEvent(new dom.Event('storage')); });
assert.match(container.textContent!, /Local activity/);
assert.equal(measurements.textContent, before, 'New reply cannot change policy measurements');
assert.equal(dom.localStorage.getItem('civic_demo_tracker_v1'), saved);
assert.match(container.textContent!, /Outreach activity · simulated/);
const summary = measurements.querySelector('summary')!;
await act(async () => { (summary as any).click(); });
assert(measurements.querySelector('details')!.open);
assert.equal(measurements.querySelectorAll('article').length, 3);
const capsule = container.querySelector('#time-capsule')!;
assert(capsule);
const selects = capsule.querySelectorAll('select');
await act(async () => {
  selects[0]!.value = 'wait';
  selects[0]!.dispatchEvent(new dom.Event('change', { bubbles: true }));
  selects[1]!.value = 'Fictional transit pilot';
  selects[1]!.dispatchEvent(new dom.Event('change', { bubbles: true }));
});
// Drive React's value tracking through the native control setter.
for (const [selector, value] of [['input[type=date]', '2099-12-31'], ['input[type=number]', '12'], ['textarea', 'Wait will be at most twelve minutes.']]) {
  const control = capsule.querySelector(selector!)!;
  const prototype = selector === 'textarea' ? dom.HTMLTextAreaElement.prototype : dom.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value);
  await act(async () => { control.dispatchEvent(new dom.Event('input', { bubbles: true })); control.dispatchEvent(new dom.Event('change', { bubbles: true })); });
}
await act(async () => { capsule.querySelector('form')!.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })); });
assert.match(capsule.textContent!, /Session forecast frozen/);
assert.match(capsule.textContent!, /Result unavailable/);
assert.match(capsule.textContent!, /synthetic-fixture-v1\/wait-2024/);
assert.equal(capsule.querySelector('form'), null, 'Frozen forecast has no edit control');
assert.equal(dom.localStorage.getItem('civic_demo_tracker_v1'), saved);
await act(async () => { root.unmount(); });
await dom.happyDOM.close();
console.log('PASS isolated activity, offline measurements and expandable history');
