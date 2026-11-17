import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motionDisabled } from './motion';
import './snap-sheet.css';

export const SHEET_STATES = ['small', 'half', 'full'] as const;
export type SheetState = typeof SHEET_STATES[number];
export function dragSnap(state: SheetState, distance: number): SheetState {
  const step = Math.abs(distance) < 32 ? 0 : distance < 0 ? 1 : -1;
  return SHEET_STATES[Math.max(0, Math.min(2, SHEET_STATES.indexOf(state) + step))]!;
}

/** Read-only exploration only: mutations and their confirmations stay on the page. */
export function SnapSheet({ id, title, label, children, mobileOnly = false }: {
  id: string; title: string; label: ReactNode; children: ReactNode; mobileOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const start = useRef<{ id: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SheetState>('half');
  const unlock = useRef<(() => void) | null>(null);
  const release = () => { unlock.current?.(); unlock.current = null; setOpen(false); };
  const close = () => { if (!dialog.current?.open) return; dialog.current.close(); release(); trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)');
    const resize = () => { if (mobileOnly && !media.matches) close(); };
    media.addEventListener('change', resize);
    window.addEventListener('civic-sheet:dismiss', close);
    return () => { media.removeEventListener('change', resize); window.removeEventListener('civic-sheet:dismiss', close); unlock.current?.(); };
  }, [mobileOnly]);
  function show() {
    const node = dialog.current;
    // Never stack over another modal (including a vote confirmation).
    if (!node || document.querySelector('dialog[open]')) return;
    if (typeof node.showModal !== 'function') {
      const fallback = document.getElementById(`${id}-fallback`) as HTMLDetailsElement | null;
      if (fallback) { fallback.open = true; fallback.querySelector('summary')?.focus(); }
      return;
    }
    setState('half');
    node.showModal();
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    unlock.current = () => { body.style.overflow = previous; };
    setOpen(true);
  }
  return <>
    <button ref={trigger} type="button" className={mobileOnly ? 'bottom-more' : 'sheet-trigger'} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={show}>{label}</button>
    {typeof document !== 'undefined' && createPortal(<dialog ref={dialog} id={id} className="snap-sheet" data-snap={state} data-instant={motionDisabled() || undefined} aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} onClose={release} onCancel={e => { e.preventDefault(); close(); }}>
      <header className="snap-sheet-header">
        <div className="sheet-handle" aria-hidden="true" onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; start.current = { id: e.pointerId, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { if (start.current?.id === e.pointerId) setState(s => dragSnap(s, e.clientY - start.current!.y)); start.current = null; }} onPointerCancel={() => { start.current = null; }} />
        <div className="sheet-title"><h2 id={`${id}-title`}>{title}</h2><button type="button" autoFocus onClick={close}>Close</button></div>
        <p id={`${id}-help`}>Resize with the buttons or swipe the handle. Close to return to the page.</p>
        <div role="group" aria-label="Sheet size">{SHEET_STATES.map(size => <button key={size} type="button" aria-pressed={state === size} onClick={() => setState(size)}>{size[0]!.toUpperCase() + size.slice(1)}</button>)}</div>
        <span className="sr" role="status">{state} sheet</span>
      </header>
      <div className="snap-sheet-content">{children}</div>
    </dialog>, document.body)}
    <details id={`${id}-fallback`} className="sheet-fallback"><summary>{title} — inline view</summary>{children}</details>
  </>;
}
