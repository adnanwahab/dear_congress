import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/draft' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { default: AmendmentEditor } = await import('../src/client/AmendmentEditor');
let requests = 0, writes = 0;
globalThis.fetch = (async () => { requests++; throw Error('No network in this fixture'); }) as typeof fetch;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { throw Error('Storage unavailable'); }, setItem() { writes++; throw Error('Storage unavailable'); } } });
const container = document.body.appendChild(document.createElement('div'));
const root = createRoot(container);
const source = { kind: 'citizen' as const, id: 'one', title: 'Citizen words', text: 'Unchanged proposal text', jurisdiction: 'city', origin: 'Citizen source' };
try {
  await act(async () => root.render(<AmendmentEditor key={source.id} source={source} />));
  const q = within(container);
  const details = container.querySelector('details')!;
  assert.equal(details.open, false);
  details.open = true;
  for (let round = 0; round < 3; round++) {
    assert.equal(q.queryByRole('region', { name: 'Detective explanation' }), null);
    assert.equal((q.getByRole('button', { name: 'Reveal explanation' }) as HTMLButtonElement).disabled, true);
    const radios = q.getAllByRole('radio');
    // Exercise incorrect feedback first, then correct feedback and ambiguity.
    await act(async () => fireEvent.click(radios[round === 0 ? 1 : round]!));
    await act(async () => fireEvent.submit(container.querySelector('form')!));
    assert.ok(q.getByRole('region', { name: 'Detective explanation' }));
    assert.match(q.getByRole('status').textContent!, round === 0 ? /Look again/ : /You spotted it/);
    for (const link of q.getAllByRole('link')) {
      assert.ok(document.getElementById((link as HTMLAnchorElement).hash.slice(1)));
    }
    if (round === 2) assert.ok(q.getByText(/Ambiguous simulated text/));
    await act(async () => fireEvent.click(q.getByRole('button', { name: round === 2 ? 'Play again' : 'Next case' })));
    assert.equal(document.activeElement, q.getByRole('heading', { level: 3 }));
    assert.ok(q.getAllByRole('radio').every(r => !(r as HTMLInputElement).checked));
  }
  assert.match(q.getByRole('heading', { level: 3 }).textContent!, /Case 1/);
  // A new source must not retain a guess or reveal.
  await act(async () => fireEvent.click(q.getAllByRole('radio')[0]!));
  await act(async () => fireEvent.submit(container.querySelector('form')!));
  await act(async () => root.render(<AmendmentEditor key="two" source={{ ...source, id: 'two' }} />));
  assert.equal(q.queryByRole('region', { name: 'Detective explanation' }), null);
  assert.equal(requests, 0);
  assert.equal(writes, 0);
  assert.equal(source.text, 'Unchanged proposal text');
  console.log('PASS detective guesses, anchors, uncertainty, reset and isolation');
} finally { await act(async () => root.unmount()); await dom.happyDOM.close(); }
