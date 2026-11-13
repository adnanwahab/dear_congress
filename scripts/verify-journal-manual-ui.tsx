import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import JournalScreen from '../src/client/JournalScreen';
const dom = new Window({ url: 'http://localhost/journal' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'location']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const writes: any[] = [];
let outcome = 'published';
const request = async <T,>(path: string, body?: any): Promise<T> => {
  if (path.includes('schema')) return { version: 2, needs: [{ id: 'housing', label: 'Housing' }] } as T;
  if (body) {
    writes.push(body);
    if (outcome === 'pending') return { status: 'pending', message: 'Awaiting review' } as T;
    if (outcome === 'failed') throw new Error('Offline');
    return { entry: { id: `manual-${writes.length}`, text: body.text, createdAt: '2026-11-13T12:00:00Z', extraction: { needs: body.labels.map((id: string) => ({ id })) } } } as T;
  }
  return { entries: [], nextCursor: null } as T;
};
const container = dom.document.createElement('div'); dom.document.body.append(container);
const root = createRoot(container as any);
await act(async () => { root.render(<JournalScreen request={request} />); });
const byText = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent === text);
const excerpt = () => (container.querySelector('#journal-excerpt') as any).value as string;
const sample = () => act(async () => { byText('Use a sample experience')!.click(); });
const reviewAndConsent = async () => {
  await act(async () => { byText('Review public excerpt')!.click(); });
  const consent = [...container.querySelectorAll('input[type=checkbox]')].find(input => input.parentElement?.textContent?.includes('I want to share this exact excerpt publicly'))!;
  await act(async () => { consent.click(); });
};
const share = () => act(async () => { byText('Share publicly')!.click(); });
// Nothing can be shared before an excerpt is reviewed and consented to.
assert.equal(byText('Share publicly'), undefined);
await sample();
assert.equal(writes.length, 0); assert.equal(byText('Share publicly'), undefined);
const category = container.querySelector('fieldset input') as any;
await act(async () => { category.click(); });
assert(category.checked);
await act(async () => { category.click(); });
assert(!category.checked);
assert.match(container.querySelector('legend')!.textContent!, /optional/);
await reviewAndConsent();
assert(!(byText('Share publicly') as any).disabled);
await share();
assert.equal(writes.length, 1);
assert.equal(writes[0].inference, 'none'); assert.equal(writes[0].kind, 'journal'); assert.deepEqual(writes[0].labels, []);
assert.match(container.querySelector('[aria-label="Deliberate public sharing"] [role="status"]')!.textContent!, /No inference was requested and no vote was cast/);
assert.match(container.textContent!, /Published without need tags/);
assert.notEqual(excerpt(), ''); // #73: the working text stays on the page after sharing
assert.equal(container.querySelectorAll('.journal-feed article').length, 1);
assert.equal(container.querySelectorAll('.journal-feed a').length, 0);
// A selected category enters with the acknowledged entry; a declined one did not.
await sample(); await act(async () => { category.click(); });
await reviewAndConsent(); await share();
const first = container.querySelector('.journal-feed article')!;
assert.equal(first.className, 'journal-story-new');
assert.match(first.textContent!, /Housing/);
assert.equal(first.querySelector('a')!.getAttribute('href'), '/needs?need=housing&entry=manual-2');
assert.equal(container.querySelectorAll('.journal-feed article').length, 2);
for (const mode of ['pending', 'failed']) {
  outcome = mode;
  await sample(); await reviewAndConsent(); await share();
  assert.equal(container.querySelectorAll('.journal-feed article').length, 2);
  assert.notEqual(excerpt(), '');
  // Consent is consumed by each attempt; sharing again needs a fresh review.
  assert.equal(byText('Share publicly'), undefined);
}
await act(async () => { root.unmount(); });
await dom.happyDOM.close();
console.log('PASS manual journal: select/remove, consent, publish without tags');
