import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DEMO_ITEMS } from '../engine/demo';
import { DESK_KEY, ResearchDesk, readDeskLayout, resizeDesk } from './ResearchDesk';

test('adjacent resizing preserves other pane and total, with readable minimums', () => {
  expect(resizeDesk([34, 33, 33], 0, 100)).toEqual([47, 20, 33]);
  expect(resizeDesk([34, 33, 33], 1, -100)).toEqual([34, 20, 46]);
});
test('desk links all panes, persists layout, isolates selection on revision change and survives storage denial', async () => {
  const win = new Window();
  const values = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const item = DEMO_ITEMS[2]!;
  const before = JSON.stringify(item);
  const click = async (node: Element) => act(async () => (node as HTMLElement).click());
  try {
    win.localStorage.setItem('unrelated-draft', 'keep me');
    win.localStorage.setItem(DESK_KEY, JSON.stringify({ version: 1, widths: [90, 5, 5], stacked: false }));
    expect(readDeskLayout().widths).toEqual([34, 33, 33]);
    await act(async () => root.render(<ResearchDesk key="v1" item={item} />));
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Proposed clause')!);
    expect(host.querySelectorAll('[data-linked="true"]').length).toBe(3);
    expect(host.textContent).toContain('No claim-level citation supplied');
    const divider = host.querySelector('[role="separator"]')!;
    await act(async () => divider.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }) as unknown as Event));
    expect(divider.getAttribute('aria-valuenow')).toBe('36');
    expect(readDeskLayout().widths).toEqual([36, 31, 33]);
    const grid = host.querySelector('.research-grid') as HTMLElement;
    grid.getBoundingClientRect = () => ({ width: 1000 }) as DOMRect;
    (divider as HTMLElement).setPointerCapture = () => {};
    const pointer = async (type: string, x: number) => act(async () => {
      const event = new win.Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, clientX: x, button: 0 });
      divider.dispatchEvent(event as unknown as Event);
    });
    await pointer('pointerdown', 100);
    await pointer('pointermove', 150);
    await pointer('pointerup', 150);
    expect(readDeskLayout().widths).toEqual([41, 26, 33]);
    await pointer('pointerdown', 100);
    await pointer('pointermove', 180);
    await pointer('pointercancel', 180);
    expect(divider.getAttribute('aria-valuenow')).toBe('41');
    await click(host.querySelector('input')!);
    expect(readDeskLayout().stacked).toBe(true);
    await act(async () => root.render(<ResearchDesk key="v2" item={{ ...item, proposedText: 'Changed revision' }} />));
    expect(host.querySelectorAll('[data-linked="true"]').length).toBe(0);
    expect(host.textContent).toContain('Changed revision');
    expect(host.querySelector('.research-grid')!.getAttribute('data-stacked')).toBe('true');
    expect(win.localStorage.getItem('unrelated-draft')).toBe('keep me');
    expect(JSON.stringify(item)).toBe(before);
    Object.defineProperty(win, 'localStorage', { configurable: true, get() { throw Error('denied'); } });
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Reset desk layout')!);
    expect(host.textContent).toContain('browser storage is unavailable');
    expect(readDeskLayout().widths).toEqual([34, 33, 33]);
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(values)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await win.happyDOM.close();
  }
});
