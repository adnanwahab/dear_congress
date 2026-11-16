import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { fireEvent } from '@testing-library/dom';
import { ChapterPeek } from '../src/client/ChapterPeek';
const dom = new Window({ url: 'http://localhost/feed?topic=housing&proposal=sample%26one' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const container = dom.document.createElement('div'); dom.document.body.append(container);
const root = createRoot(container as any);
for (const mode of ['normal', 'off']) {
  dom.document.documentElement.dataset.motion = mode;
  await act(async () => root.render(<ChapterPeek path="/feed" />));
  const edge = container.querySelector('.chapter-edge-right')!;
  (edge as any).setPointerCapture = () => {};
  const pointer = async (name: string, x: number, y = 300, pointerType = 'touch') => {
    await act(async () => fireEvent(edge, new dom.PointerEvent(name, { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, pointerType }) as any));
  };
  for (const pointerType of ['touch', 'mouse', 'pen']) {
    await pointer('pointerdown', 390, 300, pointerType);
    await pointer('pointermove', 350);
    assert(container.querySelector('.chapter-preview'));
    assert.equal(container.querySelector('a'), null);
    await pointer('pointerup', 350);
    assert.equal(container.querySelector('.chapter-peek'), null);
    await pointer('pointerdown', 390, 300, pointerType);
    await pointer('pointermove', 280);
    await pointer('pointerup', 280);
    assert.equal(container.querySelector('a')?.getAttribute('href'), '/votes?topic=housing&proposal=sample%26one');
    assert.equal(dom.location.pathname, '/feed');
    assert.match(container.querySelector('[role=status]')!.textContent!, /Votes preview ready/);
    await act(async () => dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })));
    assert.equal(container.querySelector('a'), null);
  }
  await pointer('pointerdown', 390);
  await pointer('pointermove', 280);
  await pointer('pointercancel', 280);
  assert.equal(container.querySelector('.chapter-peek'), null);
  await act(async () => fireEvent.click(edge, { detail: 0 }));
  assert(container.querySelector('a'));
  await act(async () => dom.dispatchEvent(new dom.Event('pagehide')));
  assert.equal(container.querySelector('a'), null);
}
await act(async () => root.render(<ChapterPeek path="/account" />));
assert.equal(container.querySelector('button'), null);
await act(async () => root.unmount());
console.log('PASS chapter peek: pointer thresholds, touch/mouse/pen, keyboard, cancellation, isolation, off motion and context');
