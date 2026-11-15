import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { runViewTransition } from './motion';
import './world-portal.css';

/** Keeps the source tree alive: opening a model must not reset forms or filters. */
export function WorldPortal({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  const token = useId();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const entry = useRef(false);
  const position = useRef(0);
  useEffect(() => {
    const back = () => {
      if (!entry.current || window.history.state?.worldPortal === token) return;
      entry.current = false;
      setOpen(false);
      dialog.current?.close();
      window.scrollTo(0, position.current);
      trigger.current?.focus({ preventScroll: true });
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [token]);
  function enter() {
    if (entry.current) return;
    position.current = window.scrollY;
    // Same URL, distinct history entry; no proposal, ballot or storage writes.
    window.history.pushState({ ...window.history.state, worldPortal: token }, '', window.location.href);
    entry.current = true;
    void runViewTransition(() => {
      setOpen(true);
      dialog.current?.showModal();
    }, 'proposal-change');
  }
  function leave() { if (entry.current) window.history.back(); }
  return <>
    <button ref={trigger} type="button" onClick={enter}>
      <span style={{ viewTransitionName: open ? undefined : 'world-portal-title' }}>{title}</span>
      {' · Explore in HappyBearLandia'}
    </button>
    <dialog ref={dialog} className="world-portal" aria-label="Proposal world portal" onCancel={e => { e.preventDefault(); leave(); }}>
      <header className="world-portal-source">
        <button type="button" onClick={leave}>← Return to the same Civic Synthesis view</button>
        <p>Source reference · {source}</p>
        <h2 style={{ viewTransitionName: open ? 'world-portal-title' : undefined }}>{title}</h2>
        <p>This proposal’s text is not applied. Choose a separately reviewed modeled assumption below. No proposal or vote is changed.</p>
      </header>
      {open && children}
    </dialog>
  </>;
}
