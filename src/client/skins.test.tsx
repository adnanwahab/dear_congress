import { test, expect } from 'bun:test';
import { Window as HappyWindow } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SkinSelect } from './SkinSelect';
import { applySkin, installSkin, SKINS } from './skins';

test('skins persist independently of theme and drafts, with query and blocked-storage recovery', () => {
  const target = new HappyWindow({ url: 'http://localhost/votes?proposal=abc' });
  const win = target as unknown as Window;
  try {
    target.localStorage.setItem('civic-theme', 'dark');
    target.localStorage.setItem('draft', 'Keep my wording');
    target.document.body.innerHTML = '<textarea>Unsaved wording</textarea><button>Support</button><button>Oppose</button><p>Advisory · not binding</p>';
    const content = target.document.body.innerHTML;
    for (const skin of SKINS) {
      applySkin(win, skin); installSkin(win);
      expect(target.document.documentElement.dataset.skin).toBe(skin);
      expect(target.document.body.innerHTML).toBe(content);
      expect(target.localStorage.getItem('draft')).toBe('Keep my wording');
      expect(target.localStorage.getItem('civic-theme')).toBe('dark');
    }
    target.localStorage.setItem('civic-skin', 'broken'); installSkin(win);
    expect(target.document.documentElement.dataset.skin).toBe('standard');
    target.localStorage.setItem('civic-skin', 'terminal');
    target.location.href = 'http://localhost/votes?proposal=abc&skin=standard'; installSkin(win);
    expect(target.document.documentElement.dataset.skin).toBe('standard');
    expect(target.localStorage.getItem('civic-skin')).toBe('terminal');
    Object.defineProperty(target, 'localStorage', { get() { throw Error('blocked'); } });
    installSkin(win); applySkin(win, 'paper');
    expect(target.document.documentElement.dataset.skin).toBe('paper');
  } finally { target.happyDOM.abort(); target.close(); }
});

test('native labeled selectors synchronize without remounting a live draft', async () => {
  const target = new HappyWindow();
  const globals = { window: target, document: target.document, Event: target.Event, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<><SkinSelect /><SkinSelect /><textarea defaultValue="My draft" /></>));
    const draft = host.querySelector('textarea')!; draft.value = 'Unsaved edit';
    const selectors = host.querySelectorAll('select');
    expect(selectors[0]!.id).not.toBe(selectors[1]!.id);
    expect(host.querySelector(`label[for="${selectors[0]!.id}"]`)!.textContent).toContain('Visual skin');
    for (const skin of SKINS) {
      await act(async () => { selectors[0]!.value = skin; selectors[0]!.dispatchEvent(new target.Event('change', { bubbles: true }) as unknown as Event); });
      expect(selectors[1]!.value).toBe(skin);
      expect(host.querySelector('textarea')).toBe(draft);
      expect(draft.value).toBe('Unsaved edit');
    }
    await act(async () => window.dispatchEvent(new target.StorageEvent('storage', { key: 'civic-skin', newValue: 'terminal' }) as unknown as Event));
    expect(selectors[0]!.value).toBe('terminal');
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await target.happyDOM.close();
  }
});
