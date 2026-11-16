import { useEffect, useRef, useState } from 'react';
import type { DemoPayload } from '../engine/demo';
import { CIVIC_STAGES, STAGES, type Stage } from '../shared/civic-stages';
import { runViewTransition } from './motion';
import { ProposalProvenance } from './ProposalProvenance';
import './presenter.css';

/** A read-only audience surface. Never mounts participation or mutation controls. */
export default function Presenter({ stage }: { stage: Stage }) {
  const [data, setData] = useState<DemoPayload>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [black, setBlack] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [full, setFull] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const active = useRef(true);
  const revision = useRef(0);
  const transition = useRef<ViewTransition | null>(null);
  const params = new URLSearchParams(window.location.search);
  const item = data?.items.find(i => i.id === params.get('proposal')) ?? (!params.has('proposal') ? data?.items[0] : undefined);
  useEffect(() => {
    active.current = true;
    const abort = new AbortController();
    setError('');
    fetch('/api/demo', { signal: abort.signal }).then(async response => {
      if (!response.ok) throw Error('unavailable');
      const value = await response.json() as DemoPayload;
      if (!Array.isArray(value.items)) throw Error('invalid');
      if (!abort.signal.aborted) setData(value);
    }).catch(() => { if (!abort.signal.aborted) setError('Sample proposals unavailable. Retry or exit presentation.'); });
    const changed = () => setFull(document.fullscreenElement === panel.current);
    document.addEventListener('fullscreenchange', changed);
    return () => { active.current = false; revision.current++; transition.current?.skipTransition(); abort.abort(); document.removeEventListener('fullscreenchange', changed); };
  }, [attempt]);
  function reveal(next: boolean) {
    const version = ++revision.current;
    transition.current?.skipTransition();
    const commit = () => { if (active.current && version === revision.current) setBlack(next); };
    void runViewTransition(commit, 'presenter-reveal', t => { transition.current = t; }).catch(commit);
  }
  async function fullscreen() {
    setError('');
    try {
      if (document.fullscreenElement === panel.current) await document.exitFullscreen();
      else if (panel.current?.requestFullscreen) await panel.current.requestFullscreen();
      else throw Error('unsupported');
    } catch { if (active.current) setError('Fullscreen unavailable. Presentation controls still work in this window.'); }
  }
  const chapter = CIVIC_STAGES.findIndex(s => s.route === STAGES[stage].route);
  const url = (route: string, presenting = true) => { const query = new URLSearchParams(window.location.search); query.delete('demo'); query.delete('step'); if (presenting) query.set('presenter', '1'); else query.delete('presenter'); return `${route}?${query}`; };
  return <main ref={panel} className="presenter" id="main-content" onKeyDown={e => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key.toLowerCase() === 'b') { e.preventDefault(); reveal(!black); }
    if (e.key === 'Escape') reveal(false);
  }} tabIndex={0} aria-label="Proposal presentation">
    <header><h1>Proposal presentation</h1><p><strong>Synthetic demonstration · fictional proposals · not introduced bills</strong></p><p>Read-only. No vote, submission, or outreach is sent.</p></header>
    <nav aria-label="Presenter controls">
      {chapter > 0 && <a href={url(CIVIC_STAGES[chapter - 1]!.route)}>Previous slide</a>}
      {chapter < CIVIC_STAGES.length - 1 && <a href={url(CIVIC_STAGES[chapter + 1]!.route)}>Next slide</a>}
      <button onClick={() => reveal(!black)} aria-pressed={black}>{black ? 'Reveal slide' : 'Blackout'}</button>
      <button onClick={() => setZoom(!zoom)} aria-pressed={zoom}>Zoom text</button>
      <button onClick={fullscreen}>{full ? 'Exit fullscreen' : 'Fullscreen'}</button>
      <a href={url(STAGES[stage].route, false)}>Exit presentation</a>
    </nav>
    <p>Six chapters, equal treatment for every proposal. Tab to controls; Enter activates. With the presentation focused, B toggles blackout and Escape reveals.</p>
    <p role="status">Slide {chapter + 1} of 6 · {STAGES[stage].title}{black ? ' · Blackout enabled' : ''}</p>
    {error && <p role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}
    <section className={`presenter-screen${black ? ' is-black' : ''}${zoom ? ' is-zoom' : ''}`} aria-label="Projected slide">
      <div hidden={black}>
        <h2>{STAGES[stage].title}</h2>
        {!data ? <p>Loading sample proposals…</p> : !item ? <p>Proposal unavailable. Exit presentation to choose a sample.</p> : <article>
          <h3>{item.title}</h3><p>{item.summary}</p>
          {stage === 'draft' && <><h4>Illustrative current approach</h4><p>{item.currentText}</p><h4>Proposed text · fictional</h4><p>{item.proposedText}</p></>}
          {stage === 'votes' && <p>Discuss reasons to support, oppose, or remain unsure. This presentation records no choices and shows no popularity ranking.</p>}
          {stage === 'sponsors' && <p>Possible offices, not confirmed sponsors: {item.sponsors.join(', ')}. No outreach initiated.</p>}
          {stage === 'outcomes' && <p>No verified outcome is established by this synthetic demonstration.</p>}
          <ProposalProvenance item={item} />
        </article>}
      </div>
    </section>
  </main>;
}
