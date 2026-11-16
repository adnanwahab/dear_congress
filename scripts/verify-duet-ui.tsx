/** Isolated DOM interaction checks. No production API calls or native-browser claims. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/draft' });
for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Element','Node','Event','MouseEvent','MutationObserver','localStorage','sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let requests = 0;
let displays = 0;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (url === '/api/activation-event') {
    assert.deepEqual(JSON.parse(String(init?.body)), { event: 'proposal_read' });
    assert.equal(init?.credentials, 'omit');
    displays++;
    return new Response(null, { status: 204 });
  }
  requests++; throw new Error('No network allowed');
}) as typeof fetch;
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { ProposalDuet } = await import('../src/client/ProposalDuet');
const source = { kind: 'citizen' as const, id: 'pilot', title: '<script>original</script>', text: 'Run for 12 months.', jurisdiction: 'County', origin: 'Published fixture', supportingInfo: 'Citation: fixture section 1', sourceEntryId: 'journal-fixture' };
const original = JSON.stringify(source);
const root = createRoot(document.body.appendChild(document.createElement('div')));
const q = () => within(document.body);
async function click(name: string | RegExp) { await act(async () => { fireEvent.click(q().getByRole('button', { name })); }); }
async function edit(label: string, value: string) { await act(async () => { fireEvent.change(q().getByLabelText(label), { target: { value } }); }); }
try {
  await act(async () => { root.render(<ProposalDuet key={source.id} source={source} />); });
  await click('Duet · propose an alternative');
  assert.equal(q().getByRole('button', { name: 'Duet · propose an alternative' }).getAttribute('aria-expanded'), 'true');
  assert.equal((q().getByLabelText('Your alternate proposal') as HTMLTextAreaElement).value, source.text);
  await edit('What you appreciate and what you would change', 'Keep the pilot, extend observation.');
  await click('Keep private copy on this page');
  assert(q().getByRole('alert').textContent?.includes('Change the text'));
  await edit('Your alternate proposal', 'Run for 18 months.');
  assert(q().getByText('Removed:')); assert(q().getByText('Added:'));
  await click('Keep private copy on this page');
  await edit('Your alternate proposal', 'Run for 24 months.');
  await edit('What you appreciate and what you would change', '<img src=x onerror=bad()> Keep the longer observation.');
  await click('Keep private copy on this page');
  assert(q().getByRole('list', { name: 'Duet provenance chain' }).textContent?.includes('from private copy 1'));
  assert(q().getByText('Citation: fixture section 1'));
  assert.equal(document.querySelectorAll('script, img').length, 0);
  assert.equal(JSON.stringify(source), original);
  await act(async () => { root.render(<ProposalDuet key={source.id} source={{ ...source, text: 'Updated source' }} />); });
  assert((q().getByRole('button', { name: 'Keep private copy on this page' }) as HTMLButtonElement).disabled);
  await act(async () => { root.render(<ProposalDuet key="other" source={{ ...source, kind: 'sample', id: 'other' }} />); });
  await click('Duet · propose an alternative');
  assert(q().getByText(/Fictional sample/));
  assert.equal(q().queryByRole('list', { name: 'Duet provenance chain' }), null);
  assert.equal(requests, 0);
  assert.equal(localStorage.length, 0);
  const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
  const { DEMO_ITEMS } = await import('../src/engine/demo');
  const request = async <T,>(path: string): Promise<T> => { assert.equal(path, '/api/demo'); return { items: DEMO_ITEMS, votes: {}, updatedAt: '2026-11-13', closesAt: '2026-11-14' } as T; };
  for (const stage of ['draft', 'votes'] as const) {
    await act(async () => { root.render(<WorkflowScreen key={stage} stage={stage} request={request} />); });
    const beforeDuet = displays;
    await click('Duet · propose an alternative');
    assert.equal(displays, beforeDuet, 'private duet actions emit no events');
    assert(q().getByRole('heading', { name: 'Build on this idea respectfully' }));
  }
  assert.equal(requests, 0);
  assert.equal(displays, 2, 'only public proposal stage displays are counted');
  console.log('PASS duet provenance, comparison, validation, source isolation, escaped text and zero private network/storage writes');
} finally { await act(async () => { root.unmount(); }); await dom.happyDOM.close(); }
