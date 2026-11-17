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
const { DisconfirmationLab } = await import('../src/client/DisconfirmationLab');
const context = { lawId: 83, implementationStrength: .5, seed: 42, population: 24 as const, revision: 1, modelVersion: 'test-v1' };
const root = createRoot(document.body.appendChild(document.createElement('div')));
try {
  await act(async () => root.render(<DisconfirmationLab context={context} />));
  const q = within(document.body);
  const values = ['Transit lowers travel time', 'At minute 720, edited minus baseline minutes >= 0', 'Paired receipt v1, same seed, missing data inconclusive'];
  const areas = q.getAllByRole('textbox');
  for (let i = 0; i < areas.length; i++) await act(async () => fireEvent.change(areas[i]!, { target: { value: values[i] } }));
  await act(async () => fireEvent.change(q.getByRole('spinbutton'), { target: { value: '0' } }));
  const submit = () => fireEvent.submit(document.querySelector('form')!);
  await act(async () => submit());
  const receipt = document.querySelector('pre')!.textContent;
  assert.match(receipt!, /proposed test—awaiting review/);
  await act(async () => submit());
  assert.equal(document.querySelector('pre')!.textContent, receipt);
  await act(async () => fireEvent.change(areas[0]!, { target: { value: 'Changed hypothesis' } }));
  assert.equal(document.querySelector('pre'), null);
  await act(async () => fireEvent.click(q.getByRole('button', { name: 'Clear test' })));
  assert.equal((areas[0] as HTMLTextAreaElement).value, '');
  assert.equal(requests, 0);
  assert.equal(dom.localStorage.length, 0);
  assert.equal(dom.sessionStorage.length, 0);
  console.log('PASS planning, replay, invalidation, reset and no network/storage');
} finally {
  await act(async () => root.unmount());
  await dom.happyDOM.close();
}
