import { flushSync } from 'react-dom';

export type MotionType = 'sponsor-move' | 'plan-rerank' | 'proposal-change' | 'filter' | 'theme' | 'time-zoom' | 'clause-explain';
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
  return () => target.matchMedia?.('(prefers-reduced-motion: reduce)')?.removeEventListener?.('change', changed);
}
export function motionDisabled() {
  return (typeof document !== 'undefined' && ['off', 'calm'].includes(document.documentElement?.dataset.motion ?? '')) ||
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
