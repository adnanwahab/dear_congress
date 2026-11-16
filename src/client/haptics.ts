export const HAPTIC_KEY = 'civic-haptics';
let volatilePreference: boolean | undefined;
let lastPulse = -Infinity;

export function hapticsEnabled(): boolean {
  if (volatilePreference !== undefined) return volatilePreference;
  try { return localStorage.getItem(HAPTIC_KEY) === 'on'; } catch { return false; }
}

export function setHapticsEnabled(enabled: boolean) {
  volatilePreference = enabled;
  window.dispatchEvent(new Event('haptics-preference'));
  try { localStorage.setItem(HAPTIC_KEY, enabled ? 'on' : 'off'); } catch { /* Page-only preference. */ }
}

/** Only call from a completed neutral interaction, never a vote or progress signal. */
export function requestHaptic(input: Pick<Event, 'isTrusted'>): boolean {
  try {
    if (!input.isTrusted || !hapticsEnabled() || typeof navigator.vibrate !== 'function'
      || document.visibilityState !== 'visible'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    const now = performance.now();
    if (now - lastPulse < 120) return false;
    lastPulse = now;
    return navigator.vibrate(8);
  } catch { return false; }
}
