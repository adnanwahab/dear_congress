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
}
export function motionDisabled() {
  return (typeof document !== 'undefined' && document.documentElement?.dataset.motion === 'off') ||
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
