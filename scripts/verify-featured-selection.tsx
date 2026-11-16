import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { fireEvent, within } = await import('@testing-library/dom');
const { Dashboard } = await import('../src/client/Dashboard');
const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
const { demoPayload } = await import('../src/engine/demo');
const { writeJourney } = await import('../src/client/journey-history');
const payload = demoPayload({}, 'test');
const writes: any[] = [];
const request = async <T,>(path: string, body?: any): Promise<T> => {
  if (path === '/api/state') return { needs: [], user: { allocation: {} } } as T;
  if (body) { writes.push(body); return { ok: true } as T; }
  return payload as T;
};
document.body.innerHTML = '<div id="root"></div>';
let root = createRoot(document.getElementById('root')!);
await act(async () => root.render(<Dashboard request={request} />));
const featured = document.querySelector('.daily-question')!;
const href = within(featured as HTMLElement).getByRole('link', { name: /(?:Make|Change) an? advisory choice/ }).getAttribute('href')!;
const featuredID = new URL(href, dom.location.href).searchParams.get('proposal')!;
await act(async () => root.unmount());
async function mount(url: string, staleFilters = false) {
  dom.history.replaceState(null, '', url);
  if (staleFilters) {
    localStorage.setItem('civic_browse_jurisdiction_v1', 'Houston');
    sessionStorage.setItem('civic_demo_selection_v1', 'demo-housing');
    writeJourney({ version: 1, stage: '/votes', direction: null, proposal: 'demo-housing', filters: { query: 'housing', topic: 'Housing', outcomes: 'All outcomes', jurisdiction: 'Houston' }, scroll: [0, 0], focus: null });
  }
  root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(<WorkflowScreen stage="votes" request={request} />));
}
function check(id: string) {
  const item = payload.items.find(i => i.id === id)!;
  const panel = document.getElementById('advisory-choice')!;
  assert.equal((panel.querySelector('select') as HTMLSelectElement).value, id);
  assert(panel.querySelector('.workflow-detail-title')!.textContent!.includes(item.title.slice(1)));
  assert.equal(panel.querySelector('.vote-summary')!.textContent, item.summary);
  assert(document.querySelector('.workflow-two > section:nth-child(2)')!.textContent!.includes(item.proposedText));
}
await mount(href, true);
check(featuredID);
assert.equal(writes.length, 0);
await act(async () => root.unmount());
await mount('/votes?proposal=demo-insurance#advisory-choice', true);
check('demo-insurance');
assert.equal(dom.location.hash, '#advisory-choice');
await act(async () => root.unmount());
await mount(dom.location.href); // refresh with the same history and persisted filters
check('demo-insurance');
assert.equal(writes.length, 0);
// A dropdown choice creates a restorable history entry.
const before = dom.history.length;
await act(async () => fireEvent.change(document.querySelector('.workflow-select select')!, { target: { value: 'demo-housing' } }));
assert.equal(dom.history.length, before + 1);
check('demo-housing');
await act(async () => { dom.history.back(); await new Promise(r => setTimeout(r, 20)); });
check('demo-insurance');
// happy-dom 21 incorrectly truncates forward entries on replaceState (journey capture).
// Replay the browser's forward URL + popstate contract without that emulator defect.
await act(async () => { dom.history.replaceState(null, '', '/votes?proposal=demo-housing'); dom.dispatchEvent(new dom.PopStateEvent('popstate')); });
check('demo-housing');
await act(async () => { dom.history.replaceState(null, '', '/votes?proposal=demo-insurance'); dom.dispatchEvent(new dom.PopStateEvent('popstate')); });
check('demo-insurance');
await act(async () => fireEvent.click(within(document.getElementById('advisory-choice')!).getByRole('button', { name: /Cast advisory vote: Support/ })));
assert.equal(writes.length, 1);
assert.equal(writes[0].votes[0].proposalId, 'demo-insurance');
await act(async () => root.unmount());
for (const id of ['missing', '']) {
  await mount('/votes?proposal=' + id, true);
  assert(document.body.textContent!.includes('This proposal link is unavailable. No choice has been changed.'));
  assert.equal(document.querySelectorAll('#advisory-choice .advisory-bars button').length, 0);
  assert.equal((document.querySelector('.workflow-select select') as HTMLSelectElement).value, '');
  assert.equal(new URL(dom.location.href).searchParams.get('proposal'), id);
  assert.equal(writes.length, 1);
  await act(async () => root.unmount());
}
await dom.happyDOM.close();
console.log('Featured selection: homepage link, stale filters, insurance details, refresh, history, vote identity and unavailable IDs passed');
