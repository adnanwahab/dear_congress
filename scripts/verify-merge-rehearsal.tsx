import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/vote/dear_congress?view=prs' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { default: MergeRehearsal } = await import('../src/client/MergeRehearsal');
const pulls = [1, 2].map(number => ({ number, repositoryId: 42, title: 'Patch', headSha: `head${number}`, base: 'main', version: `v${number}`, state: 'open', eligibility: { state: 'blocked', reason: 'Policy blocked' } }));
const list: any = { repository: 'adnanwahab/dear_congress', pulls, stale: false, lastSync: 'today', sourceStatus: 'fresh' };
let reads = 0;
globalThis.fetch = (async (url: string, init: RequestInit) => {
  assert.equal(init.method, undefined); assert.match(url, /^\/api\/test\/[12]$/); reads++;
  return Response.json({ pull: pulls.find(p => url.endsWith('/' + p.number)) });
}) as any;
const root = createRoot(document.body.appendChild(document.createElement('div')));
const render = (error = '') => root.render(<MergeRehearsal list={list} api="/api/test" loading={false} error={error} />);
try {
  await act(async () => render());
  const q = within(document.body);
  for (const number of [1, 2]) await act(async () => { fireEvent.change(q.getByRole('combobox'), { target: { value: String(number) } }); });
  assert.equal(reads, 2);
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Move #2 earlier' })));
  assert.match(q.getByRole('status').textContent!, /#2 → #1/);
  assert.equal(reads, 2);
  await act(async () => render('Source failed'));
  assert.match(document.body.textContent!, /unknown — refresh/);
  assert.equal((q.getByRole('combobox') as HTMLSelectElement).disabled, true);
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Clear rehearsal' })));
  assert.match(q.getByRole('status').textContent!, /0 PRs/);
  assert.equal(reads, 2);
  console.log('PASS staging GET-only, reorder, stale/error permission boundary, clear');
} finally { await act(async () => root.unmount()); await dom.happyDOM.close(); }
