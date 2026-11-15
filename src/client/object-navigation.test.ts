import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { installObjectNavigation, validSnapshot } from './object-navigation';

function fixture(reduced = false) {
 const w = new Window({ url: 'https://example.test/published' });
 w.document.body.innerHTML = '<article data-motion-proposal="one" data-motion-revision="Title"><a href="/votes?proposal=one">First</a><a href="/votes?proposal=one">Second</a></article>';
 Object.defineProperty(w, 'matchMedia', { value: () => ({ matches: reduced }) });
 const from = { key: 'origin', url: w.location.href }, to = { key: 'detail', url: 'https://example.test/votes?proposal=one' };
 Object.defineProperty(w, 'navigation', { value: { currentEntry: from } });
 const anchors = [...w.document.querySelectorAll('a')];
 for (const a of anchors) a.getBoundingClientRect = () => new w.DOMRect(10, 20, 80, 30);
 installObjectNavigation(w as unknown as globalThis.Window);
 const dispatch = (type: string, reverse = false) => {
  const event = new w.Event(type);
  Object.assign(event, { activation: reverse ? { from: to, entry: from } : { from, entry: to }, viewTransition: { ready: Promise.resolve(), finished: new Promise(() => {}) } });
  w.dispatchEvent(event);
 };
 return { w, anchors, dispatch };
}

test('keyboard/touch click captures exact origin, bounds and history entry; reverse returns to the second link', () => {
 const { w, anchors, dispatch } = fixture();
 const event = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 0 });
 anchors[1]!.dispatchEvent(event);
 expect(event.defaultPrevented).toBe(false);
 dispatch('pageswap');
 expect(anchors[1]!.style.viewTransitionName).toBe('sample-navigation-object');
 const saved = JSON.parse(w.sessionStorage.getItem('civic_sample_object_navigation_v1')!);
 expect(saved[0].ordinal).toBe(1); expect(saved[0].rect).toEqual({ x: 10, y: 20, width: 80, height: 30 });
 w.dispatchEvent(new w.Event('pageshow'));
 dispatch('pagereveal', true);
 expect(anchors[0]!.style.viewTransitionName).toBe('');
 expect(anchors[1]!.style.viewTransitionName).toBe('sample-navigation-object');
});

for (const mode of ['reduced', 'modified', 'prevented', 'off']) test(`${mode} keeps navigation ordinary`, () => {
 const { w, anchors, dispatch } = fixture(mode === 'reduced');
 if (mode === 'off') w.document.documentElement.dataset.motion = 'off';
 const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: mode === 'modified' });
 if (mode === 'prevented') e.preventDefault();
 anchors[0]!.dispatchEvent(e); dispatch('pageswap');
 expect(anchors[0]!.style.viewTransitionName).toBe('');
 expect(w.sessionStorage.length).toBe(0);
});

test('missing, virtualized and stale origins do not capture a different item', () => {
 const { w, anchors, dispatch } = fixture();
 anchors[1]!.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); dispatch('pageswap');
 w.dispatchEvent(new w.Event('pageshow'));
 anchors[1]!.remove(); dispatch('pagereveal', true);
 expect(anchors[0]!.style.viewTransitionName).toBe('');
 expect(validSnapshot(null)).toBe(false);
 const record = JSON.parse(w.sessionStorage.getItem('civic_sample_object_navigation_v1')!)[0];
 expect(validSnapshot(record, record.created + 300_000)).toBe(false);
 expect(validSnapshot({ ...record, rect: { width: 0 } })).toBe(false);
});

test('incoming detail matches identity and title; loading, empty and changed content stay ordinary', () => {
 for (const state of ['ready', 'loading', 'empty', 'changed', 'other']) {
  const { w, anchors, dispatch } = fixture();
  anchors[0]!.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); dispatch('pageswap');
  w.dispatchEvent(new w.Event('pageshow'));
  w.document.body.innerHTML = state === 'loading' ? '<p>Loading…</p>' : state === 'empty' ? '' : `<h3 data-motion-proposal="${state === 'other' ? 'two' : 'one'}" data-motion-revision="${state === 'changed' ? 'New title' : 'Title'}">Title</h3>`;
  const heading = w.document.querySelector('h3');
  if (heading) heading.getBoundingClientRect = () => new w.DOMRect(0, 0, 100, 40);
  dispatch('pagereveal');
  expect(w.document.documentElement.dataset.objectNavigation).toBe(state === 'ready' ? 'true' : undefined);
 }
});

test('touch-style activation, blocked storage and unavailable lifecycle API leave the link working', () => {
 const { w, anchors, dispatch } = fixture();
 Object.defineProperty(w, 'sessionStorage', { get() { throw Error('blocked'); } });
 const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
 anchors[0]!.dispatchEvent(e); dispatch('pageswap');
 expect(e.defaultPrevented).toBe(false);
 expect(anchors[0]!.style.viewTransitionName).toBe('');
 w.dispatchEvent(new w.Event('pagereveal'));
});

test('history entry identity prevents another route to the same proposal from stealing the origin', () => {
 const { w, anchors, dispatch } = fixture();
 anchors[0]!.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); dispatch('pageswap');
 w.dispatchEvent(new w.Event('pageshow'));
 const key = 'civic_sample_object_navigation_v1';
 const records = JSON.parse(w.sessionStorage.getItem(key)!);
 records[0].from.key = 'different-visit';
 w.sessionStorage.setItem(key, JSON.stringify(records));
 dispatch('pagereveal', true);
 expect(anchors[0]!.style.viewTransitionName).toBe('');
});

test('changed return link and later prevented navigation cannot reuse an earlier activation', () => {
 const { w, anchors, dispatch } = fixture();
 const click = new w.MouseEvent('click', { bubbles: true, cancelable: true });
 anchors[0]!.dispatchEvent(click);
 click.preventDefault(); dispatch('pageswap');
 expect(w.sessionStorage.length).toBe(0);
 anchors[0]!.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); dispatch('pageswap');
 w.dispatchEvent(new w.Event('pageshow'));
 anchors[0]!.textContent = 'A different action'; dispatch('pagereveal', true);
 expect(anchors[0]!.style.viewTransitionName).toBe('');
});
