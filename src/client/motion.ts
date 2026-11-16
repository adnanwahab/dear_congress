import { recordQuality, qualityAllowed } from './experience-quality';
import { flushSync } from 'react-dom';

export type MotionType = 'sponsor-move' | 'plan-rerank' | 'proposal-change' | 'filter' | 'theme' | 'time-zoom' | 'clause-explain' | 'priority-history' | 'proposal-fold' | 'presenter-reveal' | 'score-boundary' | 'geography-mode';
export type MotionPreset = 'playful' | 'calm' | 'off';
export const MOTION_STORAGE_KEY = 'civic-motion';
export function motionPreset(target: Window): MotionPreset {
  const value = target?.document?.documentElement?.dataset.motionPreference;
  return value === 'calm' || value === 'off' ? value : 'playful';
}
export function setMotionPreset(target: Window, preset: MotionPreset, remember: boolean) {
  target.document.documentElement.dataset.motionPreference = preset;
  delete target.document.documentElement.dataset.motionReview;
  try { target.sessionStorage.removeItem('motion'); } catch {}
  try {
    if (remember) target.localStorage.setItem(MOTION_STORAGE_KEY, preset);
    else target.localStorage.removeItem(MOTION_STORAGE_KEY);
  } catch {}
  applyMotion(target);
}
function applyMotion(target: Window) {
  const review = target.document.documentElement.dataset.motionReview;
  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const preset = motionPreset(target);
  target.document.documentElement.dataset.motion = reduced ? 'off' : review ?? (preset === 'playful' ? 'normal' : preset);
  // Settle existing WAAPI/FLIP effects too when a visitor stops motion mid-flight.
  if (['off', 'calm'].includes(target.document.documentElement.dataset.motion)) {
    for (const animation of target.document.getAnimations?.() ?? []) {
      try { animation.finish(); } catch { animation.cancel(); }
    }
  }
  const event = target.document.createEvent('Event');
  event.initEvent('motionchange', false, false);
  target.dispatchEvent(event);
}

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
  try {
    const saved = target.localStorage.getItem(MOTION_STORAGE_KEY);
    if (saved === 'playful' || saved === 'calm' || saved === 'off') target.document.documentElement.dataset.motionPreference = saved;
  } catch {}
  if (mode === 'normal') delete target.document.documentElement.dataset.motionReview;
  else target.document.documentElement.dataset.motionReview = mode;
  applyMotion(target);
  const changed = () => applyMotion(target);
  target.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', changed);
  const stopBudget = installMotionBudget(target);
  return () => {
    stopBudget();
    target.matchMedia?.('(prefers-reduced-motion: reduce)')?.removeEventListener?.('change', changed);
  };
}
export function motionDisabled() {
  return (typeof document !== 'undefined' && (['off', 'calm'].includes(document.documentElement?.dataset.motion ?? '') || document.documentElement?.dataset.motionBudget === 'constrained')) ||
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
    if (typeof window !== 'undefined') recordQuality('accessibility_fallback');
    flushSync(update); return;
  }
  // Older implementations only accept a callback. Keep its selectors isolated too.
  const root = document.documentElement;
  let called = false;
  const commit = () => { if (!called) { called = true; flushSync(update); } };
  let transition: ViewTransition;
  const owner = Symbol(type);
  // Keep CSS isolation even when options are accepted but transition types are ignored.
  if (root) { root.dataset.motionType = type; fallbackOwners.set(root, owner); }
  const cleanup = () => {
    if (root && fallbackOwners.get(root) === owner) { delete root.dataset.motionType; fallbackOwners.delete(root); }
  };
  try {
    transition = document.startViewTransition({ update: commit, types: [type] });
  } catch (error) {
    if (called) { cleanup(); throw error; }
    if (!(error instanceof TypeError)) { cleanup(); commit(); return; }
    try { transition = document.startViewTransition(commit); }
    catch (error) {
      cleanup();
      if (called) throw error;
      commit(); return;
    }
  }
  // A rejected snapshot is visual failure; a rejected update remains observable.
  void transition.ready?.catch(() => {});
  const finished = transition.finished?.catch(() => {});
  try {
    onStart?.(transition);
    await transition.updateCallbackDone;
    await finished;
  } finally {
    cleanup();
  }
}

/** Labels describe evidence, never confer publication or participation authority. */
export const STATUS_MOTION = {
  saved: { label: 'Saved', icon: '✓', duration: 180 },
  draft: { label: 'Draft', icon: '✎', duration: 150 },
  syncing: { label: 'Syncing', icon: '↔', duration: 180 },
  updated: { label: 'Updated', icon: '✓', duration: 180 },
  cited: { label: 'Cited', icon: '※', duration: 150 },
  unavailable: { label: 'Unavailable', icon: '—', duration: 0 },
  error: { label: 'Error', icon: '!', duration: 0 },
} as const;
export type StatusKind = keyof typeof STATUS_MOTION;

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


/** Incoming route readiness: no persisted navigation/visitor linkage. */
export function installRouteQuality(target: Window, emit: typeof recordQuality = recordQuality) {
  let pending = false;
  let generation = 0;
  let revealed = false;
  const start = () => { pending = qualityAllowed(target); generation++; };
  start();
  const finish = (failed = false, version = generation) => {
    if (!pending || version !== generation) return;
    pending = false;
    emit(failed ? 'route_failed' : 'route_ready', target.performance.now(), target);
    if (!target.document.startViewTransition || target.matchMedia?.('(prefers-reduced-motion: reduce)').matches || target.document.documentElement.dataset.motion === 'off') emit('accessibility_fallback', undefined, target);
  };
  // pagereveal precedes the first rendering opportunity. Observe its actual transition.
  target.addEventListener('pagereveal', event => {
    revealed = true;
    const transition = (event as Event & { viewTransition?: { finished: Promise<void> } }).viewTransition;
    const version = generation;
    if (transition) void transition.finished.then(() => finish(false, version), () => finish(true, version));
    else finish();
  });
  // Browsers without cross-document View Transitions still have a render fallback.
  target.requestAnimationFrame(() => target.requestAnimationFrame(() => { if (!revealed) finish(); }));
  target.addEventListener('pagehide', () => {
    if (pending) emit('route_abandoned', undefined, target);
    pending = false; generation++;
  });
  target.addEventListener('pageshow', event => {
    if ((event as PageTransitionEvent).persisted) {
      start();
      // BFCache performance.now() includes time away: it is not route latency.
      pending = false;
    }
  });
  target.addEventListener('quality-consent', () => { pending = false; generation++; });
  target.addEventListener('storage', () => { if (!qualityAllowed(target)) { pending = false; generation++; } });
}
