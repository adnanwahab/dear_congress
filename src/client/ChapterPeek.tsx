import { useEffect, useRef, useState } from 'react';
import { CIVIC_STAGES } from '../shared/civic-stages';
import { motionDisabled } from './motion';

type Chapter = typeof CIVIC_STAGES[number];
/** A preview contains only catalog copy; never mount a destination's controls. */
export function ChapterPeek({ path }: { path: string }) {
  const index = CIVIC_STAGES.findIndex(s => s.route === (path === '/vote' ? '/votes' : path));
  const [peek, setPeek] = useState<{ stage: Chapter; side: 'left' | 'right'; distance: number; ready: boolean } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; side: 'left' | 'right'; stage: Chapter } | null>(null);
  const suppressClick = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const active = useRef(false);
  active.current = !!peek;
  const reset = () => { drag.current = null; setPeek(null); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && active.current) { reset(); trigger.current?.focus(); } };
    const hidden = () => { if (document.hidden) reset(); };
    window.addEventListener('keydown', key);
    window.addEventListener('pagehide', reset);
    window.addEventListener('pageshow', reset);
    window.addEventListener('blur', reset);
    window.addEventListener('popstate', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('pageshow', reset);
      window.removeEventListener('blur', reset);
      window.removeEventListener('popstate', reset);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(reset, [path]);
  if (index < 0) return null;
  return <aside aria-label="Chapter previews">
    {(['left', 'right'] as const).map(side => {
      const stage = CIVIC_STAGES[index + (side === 'left' ? -1 : 1)];
      if (!stage) return null;
      return <button key={side} type="button" className={`chapter-edge chapter-edge-${side}`} aria-label={`Peek ${side === 'left' ? 'previous' : 'next'} stage: ${stage.title}`} aria-expanded={peek?.stage === stage} aria-controls={peek ? "chapter-peek" : undefined}
        onPointerDown={e => {
          if (!e.isPrimary || e.button !== 0 || drag.current) return;
          trigger.current = e.currentTarget;
          suppressClick.current = false;
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, side, stage };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const distance = (e.clientX - d.x) * (side === 'left' ? 1 : -1);
          if (Math.abs(e.clientY - d.y) > 16 && Math.abs(e.clientY - d.y) > Math.abs(distance)) { suppressClick.current = true; reset(); return; }
          if (Math.abs(distance) > 6) suppressClick.current = true;
          if (distance > 6) setPeek({ stage, side, distance, ready: false });
          else setPeek(null);
        }}
        onPointerUp={e => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          drag.current = null;
          const distance = (e.clientX - d.x) * (side === 'left' ? 1 : -1);
          if (distance >= 72 && Math.abs(e.clientY - d.y) < distance) setPeek({ stage, side, distance, ready: true });
          else setPeek(null);
        }}
        onPointerCancel={() => { suppressClick.current = true; reset(); }}
        onLostPointerCapture={() => { if (drag.current) { suppressClick.current = true; reset(); } }}
        onClick={e => {
          if (e.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
          trigger.current = e.currentTarget;
          setPeek({ stage, side, distance: 72, ready: true });
        }}>{side === 'left' ? '‹' : '›'}</button>;
    })}
    <span className="chapter-peek-status" role="status">{peek?.ready ? `${peek.stage.title} preview ready. ${peek.stage.description} Use Open stage to navigate, or Escape to dismiss.` : ''}</span>
    {peek && <div id="chapter-peek" className={`chapter-peek chapter-peek-${peek.side}`} style={{ transform: motionDisabled() ? undefined : `translateX(${(peek.side === 'left' ? -1 : 1) * (peek.ready ? 0 : 80 / (1 + peek.distance / 24))}px)` }}>
      <div aria-hidden="true" className="chapter-preview"><small>Stage {peek.stage.n} · Preview</small><h2>{peek.stage.title}</h2><p>{peek.stage.heading}</p><p>{peek.stage.description}</p></div>
      {peek.ready && <><a href={(() => {
        const query = new URLSearchParams(window.location.search);
        const preserved = new URLSearchParams();
        for (const key of ['topic', 'proposal']) { const value = query.get(key); if (value) preserved.set(key, value); }
        return `${peek.stage.route}${preserved.size ? `?${preserved}` : ''}`;
      })()}>Open stage: {peek.stage.title}</a><button type="button" onClick={() => { reset(); trigger.current?.focus(); }}>Dismiss preview</button></>}
    </div>}
  </aside>;
}
