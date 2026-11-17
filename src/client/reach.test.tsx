import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ReachPreference, readReach, saveReach } from './reach';

test('reach selection synchronizes controls, preserves drafts, and tolerates blocked storage', async () => {
  const win = new Window({ url: 'https://example.com/journal' });
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT', 'Event'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach((key, i) => Object.defineProperty(globalThis, key, { configurable: true, value: [win, win.document, true, win.Event][i] }));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<><textarea defaultValue="Unsubmitted journal draft" /><ReachPreference /><ReachPreference /></>));
    const selects = host.querySelectorAll('select');
    selects[0]!.value = 'left';
    await act(async () => selects[0]!.dispatchEvent(new win.Event('change', { bubbles: true }) as unknown as Event));
    expect([...selects].map(s => s.value)).toEqual(['left', 'left']);
    expect(win.localStorage.getItem('civic-reach')).toBe('left');
    expect(host.querySelector('textarea')!.value).toBe('Unsubmitted journal draft');
    win.localStorage.setItem('civic-reach', 'invalid');
    expect(readReach()).toBe('left');
    Object.defineProperty(win, 'localStorage', { get() { throw new Error('blocked'); } });
    await act(async () => saveReach('right'));
    expect([...selects].map(s => s.value)).toEqual(['right', 'right']);
    await act(async () => saveReach('standard'));
    expect(readReach()).toBe('standard');
  } finally {
    await act(async () => root.unmount());
    keys.forEach((key, i) => old[i] ? Object.defineProperty(globalThis, key, old[i]!) : Reflect.deleteProperty(globalThis, key));
    await win.happyDOM.close();
  }
});
