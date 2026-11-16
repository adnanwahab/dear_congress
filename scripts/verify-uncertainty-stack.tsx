/** Isolated DOM contract; browser input and print acceptance are separate. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { UncertaintyStack } from '../src/client/UncertaintyStack';
const dom = new Window({ url: 'http://localhost/outcomes' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const container = dom.document.createElement('div'); dom.document.body.append(container);
const root = createRoot(container as any);
await act(async () => { root.render(<UncertaintyStack />); });
const select = container.querySelector('select')!;
for (const id of ['conflicting', 'missing', 'traceable']) {
  await act(async () => { select.value = id; select.dispatchEvent(new dom.Event('change', { bubbles: true })); });
  assert.match(container.querySelector('[role=status]')!.textContent!, id === 'traceable' ? /198,000/ : /No combined interval/);
  assert.equal(JSON.parse(container.querySelector('textarea')!.value).id, id);
}
const original = URL.createObjectURL;
URL.createObjectURL = () => { throw new Error('Download disabled'); };
await act(async () => { container.querySelector('button')!.click(); });
assert.match(container.querySelector('[role=alert]')!.textContent!, /Copy the complete record/);
assert.equal(JSON.parse(container.querySelector('textarea')!.value).result.bounds[1], 198000);
URL.createObjectURL = original;
await act(async () => { root.unmount(); });
await dom.happyDOM.close();
console.log('PASS local selection, blocked cases, export failure and copy fallback');
