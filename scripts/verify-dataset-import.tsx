/** Isolated DOM behavior check; no remote calls or production data. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';

import { DatasetImportWorkbench } from '../src/client/DatasetImportWorkbench';
const dom = new Window({ url: 'http://localhost/outcomes' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let requests = 0; globalThis.fetch = (async () => { requests++; throw new Error('offline'); }) as any;
const { createRoot } = await import('react-dom/client');
const container = dom.document.createElement('div'); dom.document.body.append(container);
const root = createRoot(container as any);
await act(async () => root.render(<DatasetImportWorkbench />));
const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find(e => e.textContent === text)!; assert(button); await act(async () => button.click()); };
const input = async (label: string, value: string) => {
  const el = [...container.querySelectorAll('label')].find(e => e.textContent!.startsWith(label))!.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new dom.Event('input', { bubbles: true })); el.dispatchEvent(new dom.Event('change', { bubbles: true }));
  });
};
await click('Load sourced specimen');
assert.match(container.textContent!, /Retrieval date must be/);
await input('Retrieved date', '2026-11-14');
await input('Reviewer name', 'Test reviewer');
const checkbox = container.querySelector('input[type=checkbox]')! as any;
await act(async () => checkbox.click());
const accept = [...container.querySelectorAll('button')].find(e => e.textContent === 'Accept this local revision')!;
assert.equal(accept.disabled, false);
await click('Accept this local revision');
assert.match(container.textContent!, /Locally accepted by Test reviewer/);
await input('Required unit', 'different');
assert.match(container.textContent!, /Awaiting valid data and human review/);
assert.match(container.textContent!, /1 retained local review records/);
assert.equal(accept.disabled, true);
const packet = JSON.parse((container.querySelector('[aria-label="Complete review packet"]') as any).value);
assert.equal(packet.accepted, null); assert.equal(packet.history[0].draft.expectedUnit, 'persons');
assert.equal(packet.history[0].published, false);
assert.equal(container.querySelector('.dataset-print-report')!.textContent, JSON.stringify(packet, null, 2));
await click('Load conflicting specimen'); assert.match(container.textContent!, /unit conflicts/);
await click('Load missing-source specimen'); assert.match(container.textContent!, /HTTPS source URL/);
// File-read loading and failure retain paste/export fallbacks.
const file = container.querySelector('input[type=file]')! as any;
let rejectRead!: (e: Error) => void;
Object.defineProperty(file, 'files', { configurable: true, value: [{ size: 10, text: () => new Promise((_, reject) => { rejectRead = reject; }) }] });
await act(async () => file.dispatchEvent(new dom.Event('change', { bubbles: true })));
assert.match(container.querySelector('[role=status]')!.textContent!, /Reading local CSV/);
assert.equal(accept.disabled, true);
await act(async () => rejectRead(new Error('unreadable')));
assert.match(container.querySelector('[role=status]')!.textContent!, /Paste CSV below to retry/);
assert.equal(requests, 0);
await act(async () => root.unmount()); await dom.happyDOM.close();
console.log('PASS local import, exact-draft review, invalidation, offline, loading/error and print text');
