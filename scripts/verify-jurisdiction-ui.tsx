import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import WorkflowScreen from '../src/client/WorkflowScreen';
import { JurisdictionPicker, useJurisdiction, JURISDICTION_KEY } from '../src/client/JurisdictionPicker';
import { demoPayload } from '../src/engine/demo';
const dom = new Window({ url: 'http://localhost/feed?proposal=demo-food' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
Object.defineProperty(dom.navigator, 'geolocation', { get() { throw Error('Must never access device location'); } });
const container = dom.document.createElement('div'); dom.document.body.append(container);
async function change(value: string) {
  const select = container.querySelector('.jurisdiction-picker select')! as any;
  await act(async () => { select.value = value; select.dispatchEvent(new dom.Event('change', { bubbles: true })); });
}
for (const stage of ['published', 'feed', 'votes'] as const) {
  dom.happyDOM.setURL(`http://localhost/${stage}?proposal=demo-food`);
  dom.localStorage.setItem(JURISDICTION_KEY, 'Unsupported place');
  let failed = true; const writes: any[] = [];
  const payload = demoPayload({ test: { 'demo-food': { stance: 1 } } }, 'test');
  const originalVotes = JSON.stringify(payload.votes);
  const request = async <T,>(path: string, body?: unknown): Promise<T> => {
    if (body) { writes.push(body); throw Error('Vote rejected'); }
    if (failed) throw Error('Offline');
    return payload as T;
  };
  const root = createRoot(container as any);
  await act(async () => { root.render(<WorkflowScreen stage={stage} request={request} />); });
  assert.match(container.textContent!, /Unsupported saved locality/);
  assert.match(container.textContent!, /Could not load sample proposals/);
  await change('Texas');
  failed = false;
  await act(async () => { (container.querySelector('[role=alert] button') as any).click(); });
  assert.match(container.textContent!, /2 applicable proposals/);
  assert(!container.querySelector('.workflow-detail-title')?.textContent?.includes('groceries'));
  assert.equal(dom.localStorage.getItem(JURISDICTION_KEY), 'Texas');
  assert.equal(writes.length, 0, 'Browsing must never submit a vote');
  if (stage === 'votes') {
    const selector = container.querySelector('.workflow-select select')!;
    assert.equal(selector.children.length, 2);
    assert([...selector.children].every(o => ['demo-insurance', 'demo-mental-health'].includes(o.getAttribute('value')!)));
    await act(async () => { (container.querySelector('.vote-options button') as any).click(); });
    assert.match(container.textContent!, /Vote rejected/);
    assert.equal(writes[0].votes[0].proposalId, 'demo-mental-health');
  }
  if (stage !== 'votes') {
    const search = container.querySelector('.workflow-filters select')! as any;
    await act(async () => { search.value = 'Childcare'; search.dispatchEvent(new dom.Event('change', { bubbles: true })); });
    assert.match(container.textContent!, /0 applicable proposals/);
    assert.equal(container.querySelector('a.dashboard-button'), null);
  }
  await act(async () => { (container.querySelector('.jurisdiction-picker button') as any).click(); });
  assert.equal(dom.localStorage.getItem(JURISDICTION_KEY), null);
  assert.equal(JSON.stringify(payload.votes), originalVotes);
  await act(async () => root.unmount());
  console.log(`PASS ${stage}: fallback, filtering, API retry, clear and ballot isolation`);
}
// An empty successful API response must not expose a hidden voting target.
dom.happyDOM.setURL('http://localhost/votes?proposal=demo-food');
dom.localStorage.setItem(JURISDICTION_KEY, 'Texas');
const emptyRoot = createRoot(container as any);
await act(async () => emptyRoot.render(<WorkflowScreen stage="votes" request={async <T,>() => ({ ...demoPayload({}, 'test'), items: [] }) as T} />));
assert.match(container.textContent!, /0 applicable proposals/);
assert.match(container.textContent!, /No proposal matches/);
assert.equal(container.querySelectorAll('.vote-options button').length, 0);
assert((container.querySelector('.workflow-select select') as any).disabled);
await act(async () => emptyRoot.unmount());
// Needs uses the same preference but never mutates engine inputs or demand.
const { NeedsView } = await import('../src/client/App');
const { buildContext, emptyDB } = await import('../src/engine/engine');
const { CHANGE_LEVELS } = await import('../src/engine/catalog');
const context = buildContext(emptyDB());
const state = { ...context, changeLevels: CHANGE_LEVELS, entries: [],
  population: { n: 0, archetypes: [] }, user: { votes: {}, allocation: {}, goalVotes: {}, answers: [] } } as any;
const before = JSON.stringify(state);
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => { throw Error('Offline auxiliary API'); }) as any;
dom.localStorage.setItem(JURISDICTION_KEY, 'Texas');
const needsRoot = createRoot(container as any);
await act(async () => needsRoot.render(<NeedsView state={state} focusNeedId="housing" />));
assert.match(container.textContent!, /Showing Texas decision scope only/);
assert.equal(container.querySelectorAll('.jur h4').length, 1);
assert.equal(container.querySelector('.jur h4')!.textContent, 'Texas');
const expected = state.proposals.filter((p: any) => p.needId === 'housing' && p.jurisdiction === 'Texas');
assert.equal(container.querySelectorAll('.ladder .pol-head').length, expected.length);
await change('Houston');
assert.equal(container.querySelector('.jur h4')!.textContent, 'Houston');
assert.equal(container.querySelectorAll('.ladder .pol-head').length,
  state.proposals.filter((p: any) => p.needId === 'housing' && p.jurisdiction === 'Houston').length);
assert.equal(JSON.stringify(state), before);
await act(async () => { (container.querySelector('.jurisdiction-picker button') as any).click(); });
assert.equal(container.querySelectorAll('.jur h4').length, 4);
await act(async () => needsRoot.unmount());
globalThis.fetch = originalFetch;
console.log('PASS needs: policies, jurisdiction priorities, auxiliary API failure and unchanged state');
// A separate mount proves reload persistence and in-memory behavior with blocked storage.
function Picker() { const preference = useJurisdiction(); return <JurisdictionPicker preference={preference} count={0} />; }
dom.localStorage.setItem(JURISDICTION_KEY, 'Houston');
let root = createRoot(container as any);
await act(async () => root.render(<Picker />));
assert.equal((container.querySelector('select') as any).value, 'Houston');
await act(async () => root.unmount());
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Storage blocked'); } });
root = createRoot(container as any);
await act(async () => root.render(<Picker />));
await change('Texas');
assert.equal((container.querySelector('select') as any).value, 'Texas');
assert.match(container.textContent!, /only to this visit/);
await act(async () => { (container.querySelector('button') as any).click(); });
assert.equal((container.querySelector('select') as any).value, '');
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('PASS storage: reload, blocked storage and clear');
