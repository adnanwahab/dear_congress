import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { PackageResult } from '../engine/types';

export const reducedPlanMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Encode every code point, avoiding collisions and invalid CSS identifiers. Side/package
 * scope is essential: the same proposal appears in both comparison columns. */
export function planTransitionName(scope: string, id: string) {
  return `plan-item-${Array.from(`${scope}:${id}`, c => c.codePointAt(0)!.toString(16)).join('-')}`;
}
export function rankChanges(previous: PackageResult | undefined, next: PackageResult) {
  const ranks = new Map(previous?.items.map((item, i) => [item.proposal.id, i]));
  return new Map(next.items.map((item, i) => {
    const before = ranks.get(item.proposal.id);
    return [item.proposal.id, before === undefined ? (previous ? 'Added' : '') : before > i ? `↑${before - i}` : before < i ? `↓${i - before}` : ''];
  }));
}

export async function updatePlan(update: () => void) {
  if (reducedPlanMotion() || typeof document.startViewTransition !== 'function') { flushSync(update); return; }
  const transition = document.startViewTransition(() => flushSync(update));
  // A skipped transition (e.g. a hidden tab) must never prevent the result update.
  await transition.updateCallbackDone;
  await transition.finished.catch(() => {});
}

export function PlanNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); current.current = value; setDisplay(value); };
    if (media?.matches) { finish(); return; }
    const from = current.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      current.current = from + (value - from) * (1 - (1 - t) ** 3);
      setDisplay(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    media?.addEventListener('change', finish);
    return () => { cancelAnimationFrame(frame); media?.removeEventListener('change', finish); };
  }, [value]);
  return <span className="plan-number" aria-label={format(value)}><span aria-hidden="true">{format(display)}</span></span>;
}

/** FLIP fallback for browsers without same-document View Transitions. */
export function usePlanRowMotion(identity: unknown) {
  const ref = useRef<HTMLLIElement>(null);
  const before = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const after = row.getBoundingClientRect();
    const prior = before.current;
    before.current = after;
    if (!prior || typeof document.startViewTransition === 'function' || reducedPlanMotion() || !row.animate) return;
    const animation = row.animate([
      { transform: `translate(${prior.left - after.left}px, ${prior.top - after.top}px)` },
      { transform: 'translate(0, 0)' },
    ], { duration: 700, easing: 'ease-in-out' });
    return () => animation.cancel();
  }, [identity]);
  return ref;
}

export function PlanTransitionStyles({ scope, items }: { scope: string; items: string[] }) {
  return <style>{[...new Set(items)].map(id => {
    const name = planTransitionName(scope, id);
    return `::view-transition-group(${name}) { animation-duration: 700ms; animation-timing-function: ease-in-out; }
      ::view-transition-new(${name}):only-child { animation: plan-enter 700ms ease-out; }
      ::view-transition-old(${name}):only-child { animation: plan-leave 500ms ease-out forwards; }`;
  }).join('\n')}</style>;
}
