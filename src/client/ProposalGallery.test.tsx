import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { demoPayload } from '../engine/demo';
import { galleryItems, ProposalGallery } from './ProposalGallery';

test('sorts and filters copies without changing source records or counts', () => {
  const items = demoPayload({}, 'gallery-test').items;
  const before = JSON.stringify(items);
  expect(galleryItems(items, '', 'All topics', 'source')).toEqual(items);
  const sorted = galleryItems(items, '', 'All topics', 'title');
  expect(sorted.map(i => i.title)).toEqual(items.map(i => i.title).sort((a,b) => a.localeCompare(b)));
  expect(galleryItems(items, 'no such proposal', 'All topics', 'topic')).toEqual([]);
  expect(JSON.stringify(items)).toBe(before);
});

test('loading, empty, keyboard, pointer/touch freeze and identical compact content', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const keys = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const [key, value] of Object.entries({ window: win, document: win.document, navigator: win.navigator, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = win.document.createElement('div'); win.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const items = demoPayload({}, 'gallery-test').items;
  let selected = 0;
  const render = (rows: typeof items, loaded = true) => act(async () => { root.render(<ProposalGallery items={rows} loaded={loaded} failed={false} busy={false} onSelect={() => selected++} />); });
  const ids = () => [...host.querySelectorAll('article h3')].map(el => el.textContent);
  try {
    await render([], false); expect(host.textContent).toContain('Loading sample proposals');
    await render([]); expect(host.textContent).toContain('No sample proposals are available');
    await render(items);
    const initial = ids();
    const gallery = host.querySelector('.proposal-gallery')!;
    await act(async () => { gallery.dispatchEvent(new win.PointerEvent('pointerover', { bubbles: true, pointerId: 3, pointerType: 'mouse' })); });
    await render(items.slice(1)); expect(ids()).toEqual(initial);
    await act(async () => { gallery.dispatchEvent(new win.PointerEvent('pointerout', { bubbles: true, pointerId: 3, pointerType: 'mouse' })); });
    expect(ids()).toHaveLength(items.length - 1);
    await render(items);
    await act(async () => { gallery.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch' })); });
    await render(items.slice(1)); expect(ids()).toEqual(initial);
    await act(async () => { win.dispatchEvent(new win.PointerEvent('pointercancel', { pointerId: 1 })); });
    expect(ids()).toHaveLength(items.length - 1);
    const button = gallery.querySelector('button')!;
    await act(async () => { (button as unknown as HTMLElement).focus(); });
    await render(items.slice(2)); expect(ids()).toHaveLength(items.length - 1);
    expect(win.document.activeElement).toBe(button);
    await act(async () => { (button as unknown as HTMLElement).blur(); });
    expect(ids()).toHaveLength(items.length - 2);
    const before = ids();
    const compact = [...host.querySelectorAll('button')].find(el => el.textContent === 'Compact list')!;
    await act(async () => { compact.click(); });
    expect(ids()).toEqual(before); expect(host.querySelector('.gallery-list')).not.toBeNull();
    // Reduced motion must still commit sorting immediately, without a snapshot API.
    Object.defineProperty(win, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
    let transitions = 0;
    Object.defineProperty(win.document, 'startViewTransition', { configurable: true, value: () => { transitions++; throw Error('Unexpected snapshot'); } });
    const sort = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="title"]'))!;
    await act(async () => { sort.value = 'title'; sort.dispatchEvent(new win.Event('change', { bubbles: true })); });
    expect(ids()).toEqual([...before].sort((a,b) => a!.localeCompare(b!)));
    expect(transitions).toBe(0);
    expect(selected).toBe(0);
  } finally {
    await act(async () => root.unmount());
    keys.forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else Reflect.deleteProperty(globalThis, key); });
    await win.happyDOM.close();
  }
});
