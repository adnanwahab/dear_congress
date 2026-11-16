import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).fetch = () => { throw new Error('Explorer must not request or write'); };
for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error('Explorer must not persist'); } });
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { SurpriseExplorer } = await import('../src/client/SurpriseExplorer');
const { DEMO_ITEMS } = await import('../src/engine/demo');
const root = createRoot(document.body.appendChild(document.createElement('div')));
await act(async () => root.render(<SurpriseExplorer items={DEMO_ITEMS} loaded failed={false} />));
const button = document.querySelector('button')!;
button.focus();
const links = new Set<string>();
for (let i = 0; i < DEMO_ITEMS.length * 2; i++) {
  await act(async () => button.click());
  assert.equal(document.activeElement, button);
  const link = document.querySelector('article a')!;
  assert.ok(!links.has(link.getAttribute('href')!));
  links.add(link.getAttribute('href')!);
  assert.match(document.querySelector('article strong')!.textContent!, /Fictional sample|Official background/);
}
await act(async () => button.click());
assert.ok(document.body.textContent!.includes('1 of 24'));
await act(async () => root.render(<SurpriseExplorer items={[]} loaded failed={false} />));
assert.ok(button.disabled);
assert.equal(document.querySelector('article'), null);
await act(async () => root.unmount());
await dom.happyDOM.close();
