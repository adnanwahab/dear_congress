import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/synth' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = (async () => { throw new Error('Unexpected network request'); }) as any;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { HouseholdStory } = await import('../src/client/HouseholdStory');
const demo = await import('../src/client/household-story-demo');
const root = createRoot(document.body.appendChild(document.createElement('div')));
let resolve!: (value: typeof demo) => void;
let reject!: (error: Error) => void;
const load = () => new Promise<typeof demo>((yes, no) => { resolve = yes; reject = no; });
try {
  await act(async () => root.render(<HouseholdStory load={load} />));
  const q = within(document.body);
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Open household demo' })));
  assert.equal((q.getByRole('button', { name: 'Loading household demo…' }) as HTMLButtonElement).disabled, true);
  assert.match(q.getAllByRole('status')[0]!.textContent!, /Loading local/);
  await act(async () => reject(new Error('offline')));
  assert.match(q.getAllByRole('status')[0]!.textContent!, /could not load/);
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Retry household demo' })));
  await act(async () => resolve(demo));
  const select = q.getByRole('combobox', { name: 'Synthetic household ID' }) as HTMLSelectElement;
  assert.equal(select.value, demo.DEFAULT_STORY_HOUSEHOLD);
  for (const household of demo.STORY_HOUSEHOLDS) {
    await act(async () => fireEvent.change(select, { target: { value: household } }));
    assert.match(q.getAllByRole('status')[0]!.textContent!, new RegExp(household));
    assert.equal(q.getAllByText(household, { selector: 'td' }).length, 2);
    const pair = demo.simulateHouseholdPair(household);
    const sources = Array.from(document.querySelectorAll('details code')).map(el => el.textContent);
    assert.deepEqual(sources.sort(), pair.flatMap(run => run.events.map(event => event.id)).sort());
    assert.equal(q.getAllByText(/Population synthetic-households-v1/).length, 2);
  }
  const toggle = q.getByRole('checkbox', { name: 'Apply $150 monthly demo credit' });
  await act(async () => fireEvent.click(toggle));
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Pause replay' })));
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Next month' })));
  assert.match(q.getByRole('list', { name: 'Dated divergence event log' }).textContent!, /2030-02-01.*\$150/);
  assert.equal(document.querySelectorAll('.divergence-changed').length, 1);
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Replay changed assumption' })));
  await act(async () => { await Bun.sleep(950); });
  assert.equal(q.getByRole('list', { name: 'Dated divergence event log' }).children.length, 1);
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Replay changed assumption' })));
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Pause replay' })));
  assert.equal(q.getByRole('list', { name: 'Dated divergence event log' }).children.length, 0);
  await act(async () => fireEvent.click(toggle));
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Next month' })));
  assert.match(q.getByRole('list', { name: 'Dated divergence event log' }).textContent!, /no divergence/);
  assert.equal(document.querySelectorAll('.divergence-changed').length, 0);
  assert.equal(q.getByRole('region' , { name: 'Paired synthetic household event logs' }).getAttribute('tabindex'), '0');
  assert.ok(document.querySelector('[data-no-stage-swipe]'));
  assert.equal(document.querySelectorAll('[style]').length, 0); // static, no motion required
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Close household demo' })));
  assert.equal(q.queryByRole('table'), null);
  assert.ok(q.getByRole('button', { name: 'Open household demo' }));
  assert.equal(dom.localStorage.length, 0);
  assert.equal(dom.sessionStorage.length, 0);
  assert.equal(dom.location.href, 'http://localhost/synth');
  await act(async () => root.unmount());
  console.log('PASS household story loading, retry, paired trace, selection, close and privacy');
} finally { await dom.happyDOM.close(); }
