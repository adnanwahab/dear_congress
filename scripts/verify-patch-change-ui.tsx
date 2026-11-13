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
const { PatchChange, transitionProposal } = await import('../src/client/PatchChange');
const root = createRoot(document.body.appendChild(document.createElement('div')));
const item = { id: 'first', currentText: 'Current complete clause.', proposedText: 'The proposed clause has several phrases to reveal in sequence.', summary: 'A complete explanation.' };
let reduced = false;
const preference = new dom.EventTarget();
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => Object.assign(preference, { matches: reduced }) });
try {
  await act(async () => root.render(<PatchChange key={item.id} item={item} />));
  const q = within(document.body);
  const play = () => fireEvent.click(q.getByRole('button', { name: 'Play the change' }));
  const finalText = () => [...document.querySelectorAll('.patch-final')].map(n => n.textContent);
  const expected = [`− ${item.currentText}`, `+ ${item.proposedText}`];
  assert.deepEqual(finalText(), expected);
  assert.equal(document.querySelector('.patch-visual'), null);
  await act(async () => play());
  assert.deepEqual(finalText(), expected);
  assert.equal(document.querySelectorAll('.patch-visual[aria-hidden="true"]').length, 2);
  assert.equal([...document.querySelectorAll('.patch-phrase')].map(n => n.textContent).join(''), item.proposedText);
  const previous = document.querySelector('.patch-sequence');
  await act(async () => play());
  assert.notEqual(document.querySelector('.patch-sequence'), previous);
  await act(async () => new Promise(resolve => setTimeout(resolve, 2650)));
  assert.equal(document.querySelector('.patch-visual'), null);
  assert.deepEqual(finalText(), expected);
  await act(async () => play());
  reduced = true;
  await act(async () => preference.dispatchEvent(new dom.Event('change')));
  assert.equal(document.querySelector('.is-playing'), null);
  await act(async () => play());
  assert.equal(document.querySelector('.is-playing'), null);
  let updates = 0;
  transitionProposal(() => updates++);
  assert.equal(updates, 1);
  reduced = false;
  // Unsupported browsers still switch immediately.
  transitionProposal(() => updates++);
  assert.equal(updates, 2);
  let snapshots = 0;
  (document as any).startViewTransition = (options: { update: () => void; types: string[] }) => {
    assert.deepEqual(options.types, ['proposal-change']);
    snapshots++; options.update(); return { ready: Promise.reject(new Error('Skipped visual transition')) };
  };
  await act(async () => transitionProposal(() => root.render(<PatchChange key="second" item={{ ...item, id: 'second', proposedText: 'Second proposal.' }} />)));
  assert.equal(snapshots, 1);
  assert.equal(document.querySelector('.is-playing'), null);
  assert.deepEqual(finalText(), [`− ${item.currentText}`, '+ Second proposal.']);
  reduced = true;
  transitionProposal(() => updates++);
  assert.equal(snapshots, 1);
  assert.equal(updates, 3);
  await act(async () => root.unmount());
  console.log('PASS replay, full text, completion, proposal swap, fallback and reduced motion');
} finally {
  await dom.happyDOM.close();
}
