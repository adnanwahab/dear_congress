/** Isolated DOM interaction checks. No production API calls or native-browser claims. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/draft' });
for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Element','Node','Event','MouseEvent','MutationObserver','localStorage','sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let requests = 0;
globalThis.fetch = (async () => { requests++; throw new Error('No network allowed'); }) as any;
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { default: Editor } = await import('../src/client/AmendmentEditor');
const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
const { DEMO_ITEMS } = await import('../src/engine/demo');
const source = { kind: 'citizen' as const, id: 'pilot', title: 'Pilot', text: 'The pilot shall run for 12 months.', jurisdiction: 'County', origin: 'journal:fixture' };
let root = createRoot(document.body.appendChild(document.createElement('div')));
const q = () => within(document.body);
async function click(name: string | RegExp) { await act(async () => { fireEvent.click(q().getByRole('button', { name })); }); }
async function edit(label: string | RegExp, value: string) { await act(async () => { fireEvent.change(q().getByLabelText(label), { target: { value } }); }); }
async function mount(s = source) { await act(async () => { root.render(<Editor key={`${s.kind}:${s.id}`} source={s} />); }); }
try {
  await mount(); await click('Suggest amendment');
  assert.equal(q().getByRole('button', { name: 'Suggest amendment' }).getAttribute('aria-expanded'), 'true');
  await edit('Suggested replacement text', 'The pilot shall run for 18 months.');
  await edit('Rationale', '<script>bad()</script> Observe two summer seasons');
  await edit(/Impact \/ cost/, 'Additional cost unknown');
  await edit(/Citation note/, 'javascript:alert(1) — fixture, section 1, 2026-11-13');
  assert(q().getByText('Removed:')); assert(q().getByText('Added:'));
  await click('Save new private version');
  assert(q().getByRole('status').textContent?.includes('Not submitted or published'));
  assert.equal(document.querySelectorAll('script').length, 0);
  assert.equal(document.querySelectorAll('a[href^="javascript:"]').length, 0);
  assert(q().getByText(/Publication permission: not requested/));
  await edit('Suggested replacement text', 'The pilot shall run for 24 months.');
  await click('Save new private version');
  await click('View version 1');
  assert.equal((q().getByLabelText('Suggested replacement text') as HTMLTextAreaElement).value, 'The pilot shall run for 18 months.');
  await act(async () => { root.unmount(); });
  root = createRoot(document.body.appendChild(document.createElement('div')));
  await mount(); await click('Suggest amendment'); await click('View version 2');
  assert.equal((q().getByLabelText('Suggested replacement text') as HTMLTextAreaElement).value, 'The pilot shall run for 24 months.');
  await mount({ ...source, text: 'The pilot shall run for 6 months.' });
  assert((q().getByRole('button', { name: 'Save new private version' }) as HTMLButtonElement).disabled);
  assert(q().getByText(/source has changed/));
  await click('Start fresh against current source');
  assert.equal((q().getByLabelText('Suggested replacement text') as HTMLTextAreaElement).value, 'The pilot shall run for 6 months.');
  await mount({ ...source, id: 'different' }); await click('Suggest amendment');
  assert(q().getByText('No versions saved here yet.'));
  assert.equal(requests, 0, 'preparing and comparing must never send data or cast votes');
  // Verify actual recovered /draft and /votes composition, not just the standalone editor.
  const payload = { items: DEMO_ITEMS, votes: {}, updatedAt: '2026-11-13', closesAt: '2026-11-14' };
  const request = async <T,>(path: string): Promise<T> => { assert.equal(path, '/api/demo'); return payload as T; };
  for (const stage of ['draft', 'votes'] as const) {
    await act(async () => { root.render(<WorkflowScreen key={stage} stage={stage} request={request} />); });
    await click('Suggest amendment');
    assert(q().getByText('Prepare a private amendment'));
    assert(q().getByText(/Fictional sample · not legal text/));
  }
  console.log('PASS amendment creation, redline, version reopen/reload, source isolation, conflict recovery, escaped text, no network, /draft and /votes integration');
} finally { await act(async () => { root.unmount(); }); await dom.happyDOM.close(); }
