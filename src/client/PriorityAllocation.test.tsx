import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { movePoint, PersonalPriorities, PriorityAllocation } from './PriorityAllocation';
const needs = [{ id: 'housing', label: 'Housing' }, { id: 'health', label: 'Health' }];
test('point transfers conserve the budget and reject overspending, empty sources and cancelled drops', () => {
  const full = { housing: 100 };
  expect(movePoint(full, '', 'health')).toBe(full);
  expect(movePoint(full, 'health', 'housing')).toBe(full);
  expect(movePoint(full, 'housing', 'housing')).toBe(full);
  expect(movePoint(full, 'housing', 'health')).toEqual({ housing: 99, health: 1 });
  expect(movePoint(full, 'housing', '')).toEqual({ housing: 99 });
  expect(full).toEqual({ housing: 100 });
});
test('loading, empty allocation and empty catalog have explicit inert states', () => {
  expect(renderToStaticMarkup(<PersonalPriorities request={async () => new Promise(() => {})} />)).toContain('Loading your priority points');
  const html = renderToStaticMarkup(<PriorityAllocation needs={[]} initial={{}} save={async () => { throw new Error('no save'); }} />);
  expect(html).toContain('No needs available');
  expect(html.match(/class="priority-token"/g)?.length).toBe(100);
  expect(html).toContain('0 allocated · 100 remaining');
});
test('keyboard edits, undo, touch drag and explicit save share one allocation; server values restore on remount', async () => {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://localhost/votes' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client'); const { act } = await import('react');
  const { fireEvent } = await import('@testing-library/dom');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  let persisted = { housing: 99 } as Record<string, number>; let calls = 0; let fail = false;
  const save = async (value: Record<string, number>) => { calls++; if (fail) throw new Error('offline'); persisted = value; };
  const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const textButton = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent === label)!;
  try {
    await act(async () => root.render(<PriorityAllocation needs={needs} initial={persisted} save={save} />));
    expect(host.querySelectorAll('.priority-token').length).toBe(100);
    await act(async () => button('Add one point to Health').click());
    expect(host.textContent).toContain('100 allocated · 0 remaining');
    expect(button('Add one point to Housing').disabled).toBe(true);
    expect(calls).toBe(0);
    await act(async () => textButton('Undo').click());
    expect(host.textContent).toContain('99 allocated · 1 remaining');
    await act(async () => fireEvent.change(host.querySelector('#priority-health')!, { target: { value: '500' } }));
    expect((host.querySelector('#priority-health') as HTMLInputElement).value).toBe('1');
    expect(host.textContent).toContain('100 allocated · 0 remaining');
    await act(async () => textButton('Undo').click());
    const source = host.querySelector<HTMLButtonElement>('button[data-priority-zone="housing"]')!;
    Object.defineProperty(source, 'setPointerCapture', { value: () => {} });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => host.querySelector('.priority-need[data-priority-zone="health"]') });
    await act(async () => {
      source.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0 }) as unknown as Event);
      source.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true }) as unknown as Event);
    });
    expect((host.querySelector('#priority-housing') as HTMLInputElement).value).toBe('98');
    expect((host.querySelector('#priority-health') as HTMLInputElement).value).toBe('1');
    expect(calls).toBe(0);
    fail = true;
    await act(async () => textButton('Save priorities').click());
    expect(host.textContent).toContain('Could not confirm');
    expect(persisted).toEqual({ housing: 99 });
    fail = false;
    await act(async () => textButton('Save priorities').click());
    expect(persisted).toEqual({ housing: 98, health: 1 });
    await act(async () => root.render(<PriorityAllocation key="refresh" needs={needs} initial={persisted} save={save} />));
    expect((host.querySelector('#priority-health') as HTMLInputElement).value).toBe('1');
    expect(textButton('Save priorities').disabled).toBe(true);
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});

test('token layout introduces no motion, including under reduced motion', async () => {
  const css = await Bun.file(new URL('./priority-allocation.css', import.meta.url)).text();
  expect(css).not.toMatch(/(?:animation|transition)\s*:/);
  expect(css).toContain('touch-action: none');
});
