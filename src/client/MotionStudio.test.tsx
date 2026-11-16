import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionStudio } from './MotionStudio';
import { installMotion, MOTION_STORAGE_KEY } from './motion';

test('studio works without data, uses native keyboard/touch controls, saves only with consent and honors live OS changes', async () => {
  const win = new Window({ url: 'https://example.com/needs', width: 390, height: 844 });
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  let reduced = false;
  const listeners = new Set<() => void>();
  win.matchMedia = (() => ({ get matches() { return reduced; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) })) as unknown as typeof win.matchMedia;
  const target = win as unknown as globalThis.Window;
  const cleanup = installMotion(target);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MotionStudio />));
    expect(host.querySelector('summary')!.textContent).toBe('Motion');
    await act(async () => {
      const details = host.querySelector('details')!; details.open = true;
      const toggle = document.createEvent('Event'); toggle.initEvent('toggle', false, false);
      details.dispatchEvent(toggle);
    });
    expect(host.querySelector('fieldset legend')!.textContent).toBe('Motion preset');
    const controls = host.querySelectorAll<HTMLInputElement>('input');
    expect([...controls].map(input => input.type)).toEqual(['radio', 'radio', 'radio', 'checkbox']);
    // Native labeled radios support keyboard arrows and ordinary touch/click activation.
    controls[1]!.focus(); expect(document.activeElement).toBe(controls[1]!);
    await act(async () => controls[1]!.click());
    expect(document.documentElement.dataset.motion).toBe('calm');
    expect(win.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    await act(async () => controls[3]!.click());
    expect(win.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('calm');
    delete document.documentElement.dataset.motionPreference;
    let reinstallCleanup = () => {};
    await act(async () => { reinstallCleanup = installMotion(target); });
    expect(document.documentElement.dataset.motion).toBe('calm');
    reinstallCleanup();
    await act(async () => { reduced = true; listeners.forEach(listener => listener()); });
    expect(document.documentElement.dataset.motion).toBe('off');
    await act(async () => controls[0]!.click());
    expect(document.documentElement.dataset.motion).toBe('off');
    expect(host.querySelector('[role="status"]')!.textContent).toContain('device');
    await act(async () => { reduced = false; listeners.forEach(listener => listener()); });
    expect(document.documentElement.dataset.motion).toBe('normal');
    const card = host.querySelector('.motion-preview-card');
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('.motion-preview-card')).not.toBe(card);
    expect(host.querySelector('.motion-preview')!.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('form, a')).toBeNull();
    await act(async () => controls[3]!.click());
    expect(win.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    Object.defineProperty(win, 'localStorage', { get() { throw Error('blocked'); } });
    await act(async () => controls[2]!.click());
    expect(document.documentElement.dataset.motion).toBe('off');
    await act(async () => {
      const escape = document.createEvent('Event'); escape.initEvent('keydown', true, true);
      Object.defineProperty(escape, 'key', { value: 'Escape' });
      host.querySelector('button')!.dispatchEvent(escape);
    });
    expect(host.querySelector('details')!.open).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('summary'));
  } finally {
    cleanup();
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) previous[key] ? Object.defineProperty(globalThis, key, previous[key]!) : Reflect.deleteProperty(globalThis, key);
    await win.happyDOM.close();
  }
});
