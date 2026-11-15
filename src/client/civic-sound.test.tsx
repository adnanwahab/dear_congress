import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { CivicHeader } from './CivicHeader';
import { SoundControl } from './SoundControl';
import { playSound, setSoundEnabled, soundSource, SOUND_KEY } from './civic-sound';

test('original pack is tiny mono PCM and header exposes Sound Off without data', () => {
  for (const cue of ['navigation', 'sandbox', 'completion'] as const) {
    const wav = Buffer.from(soundSource(cue).split(',')[1]!, 'base64');
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.length).toBeLessThan(6000);
  }
  const html = renderToStaticMarkup(<CivicHeader stage="Loading" />);
  expect(html).toContain('Sound Off'); expect(html).toContain('aria-checked="false"');
  expect(html).toContain('Test completion sound');
});

test('explicit opt-in, silence on enable/reload, tests, sensory changes, failure and cross-tab off', async () => {
  const window = new Window({ url: 'https://example.com/needs' });
  let reduced = false, plays = 0, pauses = 0, reject = false;
  const listeners = new Set<() => void>();
  window.matchMedia = (() => ({ get matches() { return reduced; }, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) })) as any;
  class AudioMock { volume = 1; currentTime = 0; play() { plays++; return reject ? Promise.reject(Error('blocked')) : Promise.resolve(); } pause() { pauses++; } }
  const globals = { window, document: window.document, localStorage: window.localStorage, Audio: AudioMock, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value: v });
  const host = document.createElement('div'); document.body.append(host); let root = createRoot(host);
  const click = async (index: number) => { await act(async () => { host.querySelectorAll('button')[index]!.click(); }); };
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now += 200;
  try {
    setSoundEnabled(false);
    await act(async () => root.render(<SoundControl />));
    expect(playSound('navigation')).toBe(false); expect(plays).toBe(0);
    expect(host.querySelectorAll('button')[1]!.disabled).toBe(true);
    // Native buttons dispatch click for touch and keyboard activation alike.
    await click(0); expect(plays).toBe(0); expect(localStorage.getItem(SOUND_KEY)).toBe('on');
    await click(1); expect(plays).toBe(1);
    reduced = true; await act(async () => listeners.forEach(cb => cb()));
    expect(playSound('sandbox')).toBe(false); expect(pauses).toBeGreaterThan(0);
    expect(host.textContent).toContain('Sounds paused');
    reduced = false; await act(async () => listeners.forEach(cb => cb()));
    document.documentElement.dataset.motion = 'off'; expect(playSound('sandbox')).toBe(false); delete document.documentElement.dataset.motion;
    window.history.replaceState(null, '', '/?demo=1'); expect(playSound('navigation')).toBe(false); window.history.replaceState(null, '', '/needs');
    reject = true; expect(playSound('completion')).toBe(true); await Promise.resolve();
    await act(async () => root.unmount()); root = createRoot(host);
    const before = plays; await act(async () => root.render(<SoundControl />)); expect(plays).toBe(before); expect(host.textContent).toContain('Sound On');
    await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: SOUND_KEY, newValue: 'off' })));
    expect(playSound('navigation')).toBe(false); expect(host.textContent).toContain('Sound Off');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked'); } });
    await click(0); expect(host.textContent).toContain('Sound On'); await click(0); expect(playSound('sandbox')).toBe(false);
  } finally {
    await act(async () => root.unmount()); Date.now = originalNow; setSoundEnabled(false);
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
