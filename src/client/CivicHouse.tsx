import { useEffect, useState, type CSSProperties } from 'react';
import type { DemoPayload, DemoItem } from '../engine/demo';
import { CIVIC_STAGES } from '../shared/civic-stages';
import { CivicHeader } from './CivicHeader';
import { motionDisabled, runViewTransition } from './motion';
import { prepareStageMorph } from './view-transitions';
import './civic-house.css';
import { savedRoom } from './civic-house-return';

function preview(item: DemoItem, n: number) {
  switch (n) {
    case 1: return `${item.source} · background reference only`;
    case 2: return item.summary;
    case 3: return `${item.support} support · ${item.oppose} oppose · ${item.unsure} unsure — synthetic responses`;
    case 4: return item.proposedText;
    case 5: return `${item.sponsors.join(' · ')} — possible offices, no confirmed sponsorship`;
    default: return 'No verified outcome is established by this sample. Open Outcomes for the simulated tracker and separate measurement prototype.';
  }
}
export default function CivicHouse({ request }: { request: <T>(path: string) => Promise<T> }) {
  const [data, setData] = useState<DemoPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [spatial, setSpatial] = useState(false);
  const [noMotion, setNoMotion] = useState(motionDisabled);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    request<DemoPayload>('/api/demo').then(value => { if (active) setData(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [request, attempt]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { const disabled = motionDisabled(); setNoMotion(disabled); if (disabled) setSpatial(false); };
    stop();
    media.addEventListener('change', stop);
    return () => media.removeEventListener('change', stop);
  }, []);
  const query = new URLSearchParams(window.location.search);
  const item = data?.items.find(i => i.id === query.get('proposal')) ?? data?.items[0];
  const changeMode = () => {
    // Commit immediately even if a browser rejects its optional snapshot.
    const next = !spatial;
    void runViewTransition(() => setSpatial(next), 'filter').catch(() => setSpatial(next));
  };
  return <div className="civic-shell"><CivicHeader stage="Civic House" /><main id="main-content" tabIndex={-1} className="civic-main house-main">
    <p className="house-kicker">SIX ROOMS · ONE CIVIC JOURNEY</p><h1>Civic House</h1><p>A place to explore what could change, and how. Choose any room, in any order.</p>
    <p>Fictional sample previews from the existing journey. Room visits never represent civic progress, cast a vote, prepare outreach or publish anything.</p>
    <div className="house-controls"><button aria-pressed={spatial} onClick={changeMode} disabled={noMotion}>Orbitable 3D view</button><button aria-pressed={!spatial} onClick={() => setSpatial(false)}>Flat grid · no motion / low GPU</button></div>
    {spatial && <label className="house-orbit">Orbit the house<input aria-label="Orbit the house" type="range" min="-35" max="35" value={angle} onChange={e => setAngle(Number(e.target.value))} /></label>}
    <p role="status">{failed ? 'Previews could not load. Every room remains open.' : item ? `Previewing fictional sample: ${item.title}` : 'Loading stage previews…'}</p>
    {failed && <button onClick={() => setAttempt(n => n + 1)}>Retry previews</button>}
    <div className={`house-foyer ${spatial ? 'house-spatial' : ''}`} style={{ '--house-angle': `${angle}deg` } as CSSProperties}>
      <div className="house-rooms">{CIVIC_STAGES.map(stage => {
        const saved = savedRoom(stage.route);
        const roomId = new URL(saved.url, window.location.origin).searchParams.get('proposal');
        const roomItem = roomId ? data?.items.find(i => i.id === roomId) : item;
        const href = saved.url === stage.route && item ? `${stage.route}?proposal=${encodeURIComponent(item.id)}` : saved.url;
        return <article className="house-room stage-card" key={stage.route}><span className="house-number">0{stage.n}</span><h2>{stage.title}</h2><p>{stage.heading}</p><div className="house-preview">{roomItem && !failed ? <><strong>{roomItem.title}</strong><p>{preview(roomItem, stage.n)}</p></> : 'Preview unavailable until sample data loads. You can still enter this stage.'}</div><a id={`house-room-${stage.n}`} href={href} onClick={e => prepareStageMorph(e, stage.n)}>Enter {stage.title} →</a></article>;
      })}</div>
    </div><p><a href="/">Return to overview</a></p>
  </main></div>;
}
