import { runViewTransition, motionDisabled, motionDuration } from "./motion";
import { TopicChip } from './TopicChip';
import { topicForProposal } from '../shared/topics';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import './sponsor-board.css';

export interface SponsorCard { id: string; title: string; office: string; stage: number; updatedAt: string; }
export const SPONSOR_LANES = ['Drafted', 'Ready to send', 'Replied', 'Introduced or offered', 'Stalled'];
export const reducedMotion = motionDisabled;
export function moveWithMotion(update: () => void) {
  void runViewTransition(update, 'sponsor-move');
}
const transitionName = (id: string) => `sponsor-card-${Array.from(id).map(c => c.codePointAt(0)!.toString(16)).join('-')}`;

export function SponsorBoard({ cards, save, className, items = [] }: { items?: readonly { id: string; topic: string }[]; cards: SponsorCard[]; save: (cards: SponsorCard[]) => boolean; className: string }) {
  const board = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number; target: number | null } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  function move(id: string, stage: number, keyboard = false) {
    const card = cards.find(c => c.id === id);
    if (!card || card.stage === stage) return;
    moveWithMotion(() => {
      if (save(cards.map(c => c.id === id ? { ...c, stage, updatedAt: `Demo updated ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}` } : c))) {
        setAnnouncement(`${card.title} moved to ${SPONSOR_LANES[stage]}. Saved in this browser.`);
        if (keyboard) window.requestAnimationFrame(() => board.current?.querySelector<HTMLSelectElement>(`[data-card-name="${transitionName(id)}"] select`)?.focus({ preventScroll: true }));
      }
    });
  }
  return <><p className="sponsor-instructions">Drag a card by its handle, or choose its demo stage.</p><div ref={board} className={className}>{SPONSOR_LANES.map((lane, stage) => <section className={`tracker-lane ${drag?.target === stage ? 'sponsor-drop-target' : ''}`} data-sponsor-lane={stage} key={lane}><h3>{stage + 1} · {lane}</h3>{cards.filter(c => c.stage === stage).map(c => <article className="tracked-draft" key={c.id} data-card-name={transitionName(c.id)} style={{ viewTransitionName: transitionName(c.id), ...(drag?.id === c.id ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 2, pointerEvents: 'none' } : {}) } as CSSProperties}>
      <button type="button" className="sponsor-drag-handle" aria-label={`Drag ${c.title} to another stage; or use the stage dropdown`} onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: c.id, x: e.clientX, y: e.clientY, dx: 0, dy: 0, target: null }); }} onPointerMove={e => {
        if (!drag || drag.id !== c.id) return;
        const lane = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-sponsor-lane]');
        const target = lane && board.current?.contains(lane) ? Number(lane.dataset.sponsorLane) : null;
        setDrag({ ...drag, dx: e.clientX - drag.x, dy: e.clientY - drag.y, target });
      }} onPointerUp={() => { const target = drag?.target; flushSync(() => setDrag(null)); if (target != null) move(c.id, target); }} onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)} onKeyDown={e => { if (e.key === 'Escape') setDrag(null); }}>⠿ <span>Drag card</span></button>
      <TopicChip topic={topicForProposal(c.id, items)} /><strong>{c.title}</strong><span>{c.office}</span><small>{c.updatedAt}</small><label><span className="sr">Demo stage for {c.title}</span><select value={c.stage} onChange={e => move(c.id, Number(e.target.value), true)}>{SPONSOR_LANES.map((name, i) => <option key={name} value={i}>{name}</option>)}</select></label></article>)}{!cards.some(c => c.stage === stage) && <p className="workflow-empty">Move a demo card here to explore the journey.</p>}</section>)}</div><p aria-live="polite" className="sr">{announcement}</p></>;
}

export function OutcomeTotal({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const finish = () => { window.cancelAnimationFrame(frame); current.current = value; setDisplay(value); };
    if (motionDisabled()) { finish(); return; }
    const from = current.current;
    const start = performance.now();
    const tick = (now: number) => { const progress = Math.min(1, (now - start) / motionDuration(650)); current.current = Math.round(from + (value - from) * progress); setDisplay(current.current); if (progress < 1) frame = window.requestAnimationFrame(tick); };
    frame = window.requestAnimationFrame(tick);
    const change = () => { if (motionDisabled()) finish(); };
    media?.addEventListener('change', change);
    return () => { window.cancelAnimationFrame(frame); media?.removeEventListener('change', change); };
  }, [value]);
  return <strong aria-label={String(value)}><span aria-hidden="true">{display}</span></strong>;
}
