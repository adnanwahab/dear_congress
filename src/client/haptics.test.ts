import { expect, test } from 'bun:test';
import { hapticsEnabled, requestHaptic, setHapticsEnabled } from './haptics';

test('opt-in, intentional input, reduced motion, hidden, unsupported and throttled feedback', () => {
  const keys = ['window', 'document', 'navigator', 'localStorage', 'performance'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let reduced = false, visible = 'visible', now = 1000, pulses = 0;
  const nav: { vibrate?: (duration: number) => boolean } = { vibrate: duration => { expect(duration).toBe(8); pulses++; return true; } };
  const values = [ { matchMedia: () => ({ matches: reduced }), dispatchEvent() {} }, { get visibilityState() { return visible; } }, nav,
    { getItem: () => null, setItem() { throw Error('blocked'); } }, { now: () => now } ];
  keys.forEach((key, i) => Object.defineProperty(globalThis, key, { configurable: true, value: values[i] }));
  try {
    expect(hapticsEnabled()).toBe(false);
    expect(requestHaptic({ isTrusted: true })).toBe(false);
    setHapticsEnabled(true);
    expect(requestHaptic({ isTrusted: false })).toBe(false);
    expect(requestHaptic({ isTrusted: true })).toBe(true);
    expect(requestHaptic({ isTrusted: true })).toBe(false);
    now += 150; reduced = true;
    expect(requestHaptic({ isTrusted: true })).toBe(false);
    reduced = false; visible = 'hidden';
    expect(requestHaptic({ isTrusted: true })).toBe(false);
    visible = 'visible'; delete nav.vibrate;
    expect(requestHaptic({ isTrusted: true })).toBe(false);
    nav.vibrate = () => { throw Error('denied'); };
    expect(requestHaptic({ isTrusted: true })).toBe(false);
    expect(pulses).toBe(1);
    setHapticsEnabled(false);
  } finally {
    keys.forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else Reflect.deleteProperty(globalThis, key); });
  }
});
