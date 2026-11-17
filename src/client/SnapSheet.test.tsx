import { expect, test } from 'bun:test';
import { dragSnap, SnapSheet } from './SnapSheet';

test('dragging moves one stable snap, clamps endpoints and ignores jitter', () => {
  expect(dragSnap('half', -80)).toBe('full');
  expect(dragSnap('half', 80)).toBe('small');
  expect(dragSnap('half', 12)).toBe('half');
  expect(dragSnap('small', 80)).toBe('small');
  expect(dragSnap('full', -80)).toBe('full');
});

test('sizes preserve content, modal locking restores, fallback opens without native support', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const win = new Window();
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SnapSheet id="test-sheet" title="Evidence" label="Read"><textarea defaultValue="draft" /><p>Source and comparison</p></SnapSheet>));
    const dialog = document.querySelector('dialog')!;
    dialog.showModal = () => { dialog.setAttribute('open', ''); };
    dialog.close = () => { dialog.removeAttribute('open'); dialog.dispatchEvent(new win.Event('close') as unknown as Event); };
    const trigger = host.querySelector('button')!;
    document.body.style.overflow = 'clip';
    await act(async () => trigger.click());
    expect(document.body.style.overflow).toBe('hidden');
    const draft = dialog.querySelector('textarea')!; draft.value = 'unfinished';
    for (const size of ['Small', 'Full', 'Half']) {
      await act(async () => [...dialog.querySelectorAll('button')].find(b => b.textContent === size)!.click());
      expect(dialog.dataset.snap).toBe(size.toLowerCase());
      expect(dialog.querySelector('textarea')).toBe(draft);
      expect(draft.value).toBe('unfinished');
    }
    await act(async () => dialog.querySelector('button')!.click());
    expect(document.body.style.overflow).toBe('clip');
    expect(document.activeElement).toBe(trigger);
    await act(async () => trigger.click());
    await act(async () => window.dispatchEvent(new win.Event('civic-sheet:dismiss') as unknown as Event));
    expect(dialog.open).toBe(false);
    expect(document.body.style.overflow).toBe('clip');
    Object.defineProperty(dialog, 'showModal', { value: undefined, configurable: true });
    await act(async () => trigger.click());
    expect(host.querySelector('details')!.open).toBe(true);
    expect(document.body.style.overflow).toBe('clip');
  } finally {
    await act(async () => root.unmount());
    for (const k of Object.keys(globals)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!); else Reflect.deleteProperty(globalThis, k); }
    await win.happyDOM.close();
  }
});
