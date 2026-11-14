import { recordQuality, qualityAllowed } from './experience-quality';
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
    if (typeof window !== 'undefined') recordQuality('accessibility_fallback');
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
