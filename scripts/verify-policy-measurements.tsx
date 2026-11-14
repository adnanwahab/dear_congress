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
await act(async () => { root.unmount(); });
await dom.happyDOM.close();
console.log('PASS isolated activity, offline measurements and expandable history');
