/** Isolated DOM regression checks; viewport layout still needs browser QA. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/draft' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
const { demoPayload } = await import('../src/engine/demo');
const payload = demoPayload({}, 'test');
let root: ReturnType<typeof createRoot>;
const q = () => within(document.body);
async function render(stage: 'draft' | 'sponsors' | 'outcomes', request: any, search = '') {
  if (root) await act(async () => root.unmount());
  dom.happyDOM.setURL(`http://localhost/${stage}${search}`);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(<WorkflowScreen stage={stage} request={request} />));
}
const request = async () => payload;
for (const stage of ['draft', 'sponsors', 'outcomes'] as const) {
  sessionStorage.clear();
  await render(stage, request);
  assert.equal(dom.location.search, '?proposal=demo-housing');
  assert.ok(q().getByRole('link', { name: 'Back to proposal →' }).getAttribute('href')?.includes('demo-housing'));
}
await render('draft', request);
await act(async () => fireEvent.change(q().getByRole('combobox', { name: 'Proposal' }), { target: { value: 'demo-transit' } }));
for (const stage of ['sponsors', 'outcomes', 'draft'] as const) {
  await render(stage, request);
  assert.equal(dom.location.search, '?proposal=demo-transit');
  assert.ok(q().getByRole('link', { name: 'Back to proposal →' }).getAttribute('href')?.includes('demo-transit'));
}
await render('sponsors', request, '?proposal=missing');
assert.ok(q().getByRole('heading', { name: 'Choose a sample proposal' }));
assert.equal(q().queryByRole('button', { name: 'Add to tracker' }), null);
await act(async () => fireEvent.click(q().getByRole('button', { name: 'Open first sample proposal' })));
assert.ok(q().getByRole('button', { name: 'Add to tracker' }));
for (const stage of ['draft', 'sponsors', 'outcomes'] as const) {
  let resolve!: (v: any) => void;
  const pending = new Promise(r => { resolve = r; });
  await render(stage, () => pending);
  assert.ok(document.body.textContent?.includes('Loading sample proposals.'));
  await act(async () => resolve({ ...payload, items: [] }));
  assert.ok(q().getByRole('heading', { name: 'No sample proposals available' }));
  assert.ok(q().getByRole('button', { name: 'Check again' }));
  let calls = 0;
  await render(stage, async () => { if (++calls === 1) throw new Error('offline'); return payload; });
  assert.ok(q().getByRole('alert').textContent?.includes('Could not load sample proposals'));
  assert.ok(!document.body.textContent?.includes('Loading sample proposals…'));
  await act(async () => fireEvent.click(q().getByRole('button', { name: 'Retry loading proposals' })));
  assert.ok(q().getByRole('link', { name: 'Back to proposal →' }));
}
localStorage.setItem('civic_demo_tracker_v1', '[]');
await render('outcomes', request);
assert.ok(q().getByRole('link', { name: 'Open sponsor tracker →' }));
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('Stage states: defaults, session selection, unavailable IDs, slow/empty/failing API and retry passed');
