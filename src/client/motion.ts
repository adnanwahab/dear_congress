import { flushSync } from 'react-dom';

export type MotionType = 'sponsor-move' | 'plan-rerank' | 'proposal-change' | 'filter' | 'theme';
export type MotionMode = 'normal' | 'slow' | 'off';

/** Apply before rendering/capturing the incoming page. Storage may be unavailable. */
export function installMotion(target: Window) {
  const requested = new URL(target.location.href).searchParams.get('motion');
  let mode: MotionMode = 'normal';
  try {
    const saved = target.sessionStorage.getItem('motion');
    if (saved === 'slow' || saved === 'off') mode = saved;
    if (requested === 'normal' || requested === 'slow' || requested === 'off') {
      mode = requested;
      target.sessionStorage.setItem('motion', mode);
    }
  } catch { if (requested === 'slow' || requested === 'off') mode = requested; }
  target.document.documentElement.dataset.motion = mode;
  return installMotionBudget(target);
}
export function motionDisabled() {
  return (typeof document !== 'undefined' && (document.documentElement?.dataset.motion === 'off' || document.documentElement?.dataset.motionBudget === 'constrained')) ||
    (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}
export function motionDuration(ms: number) {
  if (motionDisabled()) return 0;
  return ms * (typeof document !== 'undefined' && document.documentElement?.dataset.motion === 'slow' ? 5 : 1);
}

const fallbackOwners = new WeakMap<HTMLElement, symbol>();

/** `onStart` receives the live transition so callers can skip it when newer input arrives. */
export async function runViewTransition(update: () => void, type: MotionType, onStart?: (transition: ViewTransition) => void) {
  if (typeof document === 'undefined' || !document.startViewTransition || motionDisabled()) {
    flushSync(update); return;
  }
  // Older implementations only accept a callback. Keep its selectors isolated too.
  const root = document.documentElement;
  let called = false;
  const commit = () => { if (!called) { called = true; flushSync(update); } };
  let transition: ViewTransition;
  const owner = Symbol(type);
  let fallback = false;
  try {
    transition = document.startViewTransition({ update: commit, types: [type] });
  } catch (error) {
    if (called || !(error instanceof TypeError)) throw error;
    fallback = true;
    if (root) { root.dataset.motionType = type; fallbackOwners.set(root, owner); }
    try { transition = document.startViewTransition(commit); }
    catch (error) {
      if (root && fallbackOwners.get(root) === owner) { delete root.dataset.motionType; fallbackOwners.delete(root); }
      throw error;
    }
  }
  onStart?.(transition);
  void transition.ready?.catch(() => {});
  const finished = transition.finished?.catch(() => {});
  try {
    await transition.updateCallbackDone;
    await finished;
  } finally {
    if (fallback && root && fallbackOwners.get(root) === owner) { delete root.dataset.motionType; fallbackOwners.delete(root); }
  }
}

/** Product budgets, not claims about a particular device's refresh rate. */
export const MOTION_BUDGET = Object.freeze({ frameMs: 34, inputMs: 100, longTaskMs: 50, layers: 24 });

interface Battery extends EventTarget { readonly charging: boolean; readonly level: number }
interface BatteryNavigator extends Navigator { getBattery?: () => Promise<Battery> }

/** Bounded foreground sampling after input. No device fingerprint or telemetry. */
export function installMotionBudget(target: Window) {
  const root = target.document.documentElement;
  let disposed = false, battery: Battery | undefined, frame = 0;
  let remaining = 0, previous = 0, slow = 0, dropped = false;
  const preference = target.matchMedia?.('(prefers-reduced-motion: reduce)');
  const apply = () => {
    const constrained = dropped || !!preference?.matches || !!(battery && !battery.charging && battery.level <= .2);
    root.dataset.motionBudget = constrained ? 'constrained' : 'full';
    if (constrained) {
      // Finish existing WAAPI decorations as well as disabling future shared motion.
      for (const animation of target.document.getAnimations?.() ?? []) {
        try { animation.finish(); } catch { animation.cancel(); }
      }
    }
  };
  const sample = (time: number) => {
    frame = 0;
    if (disposed || target.document.hidden) { previous = 0; return; }
    if (previous && time - previous > MOTION_BUDGET.frameMs) slow++;
    previous = time;
    if (--remaining > 0) frame = target.requestAnimationFrame(sample);
    else { if (slow >= 6) { dropped = true; apply(); } previous = 0; }
  };
  const start = () => {
    if (frame || dropped || target.document.hidden || preference?.matches) return;
    remaining = 30; slow = 0; previous = 0;
    frame = target.requestAnimationFrame(sample);
  };
  preference?.addEventListener?.('change', apply);
  target.addEventListener('pointerdown', start, { passive: true });
  target.addEventListener('keydown', start);
  apply();
  const navigator = target.navigator as BatteryNavigator;
  // Unsupported/denied APIs retain normal motion; reduced motion still wins.
  try { void navigator.getBattery?.().then(value => {
    if (disposed) return;
    battery = value;
    battery.addEventListener('chargingchange', apply);
    battery.addEventListener('levelchange', apply);
    apply();
  }).catch(() => {}); } catch { /* Optional API can be policy blocked. */ }
  return () => {
    disposed = true;
    target.cancelAnimationFrame(frame);
    target.removeEventListener('pointerdown', start);
    target.removeEventListener('keydown', start);
    preference?.removeEventListener?.('change', apply);
    battery?.removeEventListener('chargingchange', apply);
    battery?.removeEventListener('levelchange', apply);
  };
}
