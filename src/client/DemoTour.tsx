import { useEffect, useRef, useState } from 'react';
import { TOUR_STOPS, tourState, tourUrl } from './demo-tour';

export function DemoTour() {
  const initial = tourState(new URL(window.location.href));
  const [paused, setPaused] = useState(initial?.paused ?? false);
  const [finished, setFinished] = useState(false);
  const overlay = useRef<HTMLElement>(null);
  const remaining = useRef(initial ? TOUR_STOPS[initial.step]!.duration : 0);
  const step = initial?.step ?? 0;
  const active = !!initial;
  const stop = TOUR_STOPS[step]!;
  const go = (next: number) => window.location.assign(tourUrl(next, paused));
  const exit = () => {
    const url = new URL(window.location.href);
    for (const key of ['demo', 'step', 'paused']) url.searchParams.delete(key);
    window.location.assign(url.pathname + url.search + url.hash);
  };
  useEffect(() => {
    if (!active) return;
    if (window.location.pathname !== stop.route) { window.location.replace(tourUrl(step, paused)); return; }
    const url = new URL(window.location.href);
    url.searchParams.set('step', String(step));
    if (paused) url.searchParams.set('paused', '1'); else url.searchParams.delete('paused');
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new CustomEvent('demo:paused', { detail: paused }));
    if (paused || finished) return;
    const start = performance.now();
    const timer = window.setTimeout(() => {
      if (step < TOUR_STOPS.length - 1) window.location.assign(tourUrl(step + 1));
      else { setFinished(true); setPaused(true); }
    }, remaining.current);
    return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (performance.now() - start)); };
  }, [active, paused, finished, step]);
  useEffect(() => {
    if (!active) return;
    overlay.current?.focus();
    const click = (e: MouseEvent) => {
      if (overlay.current?.contains(e.target as Node)) return;
      e.preventDefault(); e.stopImmediatePropagation(); setPaused(true);
    };
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (![' ', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Escape') exit();
      else if (e.key === ' ') { if (!finished) setPaused(p => !p); }
      else if (e.key === 'ArrowLeft' && step > 0) go(step - 1);
      else if (e.key === 'ArrowRight' && step < TOUR_STOPS.length - 1) go(step + 1);
    };
    const visibility = () => { if (document.hidden) setPaused(true); };
    window.addEventListener('click', click, true);
    window.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', visibility);
    const bar = document.querySelector('.bottom-bar');
    const resize = () => { if (overlay.current && bar) overlay.current.style.bottom = `${bar.getBoundingClientRect().height + 12}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    if (bar) observer.observe(bar);
    return () => { window.removeEventListener('click', click, true); window.removeEventListener('keydown', key, true); document.removeEventListener('visibilitychange', visibility); observer.disconnect(); };
  }, [active, paused, finished, step]);
  if (!active) return null;
  return <section className="demo-tour" ref={overlay} tabIndex={-1} aria-label="Guided demo controls">
    <p aria-live="polite"><strong>{finished ? 'Demo complete' : `${step + 1} / ${TOUR_STOPS.length} · ${stop.title} · ${paused ? 'Paused' : 'Playing'}`}</strong><br />{stop.caption}</p>
    <small>Sample data · Read-only tour · Space: pause · ← / →: step · Esc: exit · Click page to pause</small>
    <div><button disabled={step === 0} onClick={() => go(step - 1)}>← Back</button><button disabled={finished} onClick={() => setPaused(p => !p)}>{paused ? '▶ Resume' : 'Pause'}</button><button disabled={step === TOUR_STOPS.length - 1} onClick={() => go(step + 1)}>Next →</button><button onClick={exit}>Exit demo</button></div>
  </section>;
}
