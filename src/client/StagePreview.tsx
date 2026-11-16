import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { motionDuration } from './motion';
import type { stageSummary } from './stage-preview-data';

export const loadStageSummary = (route: string) => import('./stage-preview-data').then(module => module.stageSummary(route));
type Summary = ReturnType<typeof stageSummary>;

/** A plain-text lens. Never mounts a route, fetches page HTML, or intercepts its link. */
export function StagePreview({ route, title, children, load = loadStageSummary }: {
  route: string; title: string; children: ReactElement<{ 'aria-describedby'?: string }>; load?: (route: string) => Promise<Summary>;
}) {
  const id = useId();
  const [state, setState] = useState<Summary | 'loading' | 'failed' | null>(null);
  const generation = useRef(0);
  const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const close = () => {
    generation.current++;
    clearTimeout(delay.current); clearTimeout(timeout.current);
    setState(null);
  };
  const show = () => {
    clearTimeout(delay.current);
    const token = ++generation.current;
    setState('loading');
    timeout.current = setTimeout(() => { if (token === generation.current) { generation.current++; setState('failed'); } }, 4000);
    void load(route).then(summary => {
      if (token === generation.current) { clearTimeout(timeout.current); setState(summary); }
    }, () => {
      if (token === generation.current) { clearTimeout(timeout.current); setState('failed'); }
    });
  };
  useEffect(() => {
    const dismiss = () => close();
    window.addEventListener('pagehide', dismiss);
    window.addEventListener('popstate', dismiss);
    return () => { generation.current++; clearTimeout(delay.current); clearTimeout(timeout.current); window.removeEventListener('pagehide', dismiss); window.removeEventListener('popstate', dismiss); };
  }, []);
  return <div className="stage-peek" onPointerEnter={event => {
    if (event.pointerType === 'mouse') { clearTimeout(delay.current); if (!state) delay.current = setTimeout(show, 250); }
  }} onPointerLeave={() => { if (!eventFocusWithin()) { clearTimeout(delay.current); delay.current = setTimeout(close, 200); } }} onFocus={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) show();
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <span className="stage-peek-link" aria-describedby={state ? id : undefined} onClick={close}>{cloneElement(children, { 'aria-describedby': state ? id : undefined })}</span>
    <button className="stage-peek-toggle" aria-label={`Preview ${title}`} aria-expanded={!!state} aria-controls={id}
      onPointerDown={event => event.preventDefault()} onClick={() => state ? close() : show()}>⌕</button>
    {state && <aside className="stage-peek-window" style={{ animationDuration: `${motionDuration(150)}ms` }}>
      <div id={id} role="status" aria-live="polite">
        {state === 'loading' ? 'Loading destination summary…' : state === 'failed' ? 'Preview unavailable. The destination link still works.' : <>
          <span className="stage-peek-caption">Stage {state.n} · {state.title}</span><strong>{state.heading}</strong><p>{state.description}</p>
          <small>Destination summary · Opening a page does not submit a vote.</small>
        </>}
      </div>
      <button onClick={close} aria-label={`Dismiss ${title} preview`}>Close preview</button>
    </aside>}
  </div>;
  function eventFocusWithin() { return !!document.activeElement?.closest('.stage-peek')?.contains(document.getElementById(id)); }
}
