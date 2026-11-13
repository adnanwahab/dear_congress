import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/synth' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let requests = 0;
globalThis.fetch = (async () => { requests++; throw new Error('Unexpected network request'); }) as any;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { HouseholdImpacts, HOUSEHOLD_PRESETS } = await import('../src/client/HouseholdImpacts');
const root = createRoot(document.body.appendChild(document.createElement('div')));
try {
  await act(async () => root.render(<HouseholdImpacts />));
  const q = within(document.body);
  const select = q.getByRole('combobox', { name: 'Hypothetical household type' }) as HTMLSelectElement;
  assert.equal(select.value, '');
  assert.equal(q.getAllByRole('cell').length, 5);
  for (const [id, label] of HOUSEHOLD_PRESETS) {
    await act(async () => fireEvent.change(select, { target: { value: id } }));
    assert.ok(q.getByRole('columnheader', { name: label }));
    assert.equal(q.getAllByRole('cell').length, 10);
    assert.ok(q.getAllByRole('cell').every(cell => cell.textContent === 'Unavailable'));
    assert.ok(q.getByRole('status').textContent?.includes(label));
    await act(async () => fireEvent.click(q.getByRole('button', { name: 'Reset household' })));
    assert.equal(select.value, '');
    assert.equal(q.getAllByRole('cell').length, 5);
    assert.ok(q.getByRole('status').textContent?.includes('No household selected'));
    assert.equal(q.queryByRole('columnheader', { name: label }), null);
  }
  // Unknown/identity-like values cannot become an experiment selection.
  await act(async () => fireEvent.change(select, { target: { value: 'income=50000&address=private' } }));
  assert.equal(select.value, '');
  await act(async () => fireEvent.change(select, { target: { value: HOUSEHOLD_PRESETS[0][0] } }));
  await act(async () => root.unmount());
  const second = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () => second.render(<HouseholdImpacts />));
  assert.equal((q.getByRole('combobox') as HTMLSelectElement).value, '');
  assert.equal(dom.localStorage.length, 0);
  assert.equal(dom.sessionStorage.length, 0);
  assert.equal(requests, 0);
  assert.equal(dom.location.href, 'http://localhost/synth');
  await act(async () => second.unmount());
  console.log('PASS opt-in, all presets, reset, unknown input, remount and no network/storage');
} finally {
  await dom.happyDOM.close();
}
