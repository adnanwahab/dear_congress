import { useEffect, useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { ProposalProvenance } from './ProposalProvenance';

const KEY = 'civic_sample_discovery_v1';
interface Saved { cursor: string | null; saved: string[] }
function read(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && (v.cursor === null || typeof v.cursor === 'string') && Array.isArray(v.saved) && v.saved.every((id: unknown) => typeof id === 'string')) return v;
  } catch {}
  return { cursor: null, saved: [] };
}
export function DiscoveryDeck({ items, loading, failed, fullUrl }: { items: DemoItem[]; loading: boolean; failed: boolean; fullUrl: (id: string) => string }) {
  const [state, setState] = useState(read);
  const fromUrl = () => new URLSearchParams(window.location.search).get('discover');
  const [cursor, setCursor] = useState(() => fromUrl() ?? state.cursor);
  const [notice, setNotice] = useState('');
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const current = cursor === 'done' ? undefined : items.find(i => i.id === cursor) ?? items[0];
  useEffect(() => {
    const pop = () => setCursor(fromUrl() ?? read().cursor);
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (loading || failed || !current) return;
    const next = { ...read(), cursor: current.id };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { setNotice('Storage unavailable: progress lasts only on this page.'); }
    const url = new URL(window.location.href); url.searchParams.set('discover', current.id);
    window.history.replaceState(window.history.state, '', url);
  }, [current?.id, loading, failed]);
  function advance(save: boolean) {
    if (!current) return;
    const nextId = items[items.indexOf(current) + 1]?.id ?? 'done';
    const next = { cursor: nextId, saved: save ? [...new Set([...state.saved, current.id])] : state.saved };
    setState(next); setCursor(nextId);
    setNotice(save ? 'Saved for later in this browser. No vote cast.' : 'Skipped. No vote cast.');
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { setNotice('Storage unavailable: progress and saves last only on this page. No vote cast.'); }
    const url = new URL(window.location.href); url.searchParams.set('discover', nextId);
    window.history.pushState(window.history.state, '', url);
  }
  return <section className="panel discovery-deck" aria-label="Discover sample proposals" data-no-stage-swipe aria-busy={loading}>
    <h2>Discover sample proposals</h2>
    <p id="discovery-help">Swiping never casts Support, Oppose or Not sure. Swipe left to Skip, right to Save for later, or use the buttons. Read full proposal opens the sample draft. Saves stay in this browser.</p>
    {loading ? <p role="status">Loading discovery cards…</p> : failed ? <p>Discovery unavailable. Use Retry loading proposals above.</p> : !items.length ? <p>No proposals match. Change or clear your filters.</p> : !current ? <p>You’ve reached the end. <button onClick={() => { setCursor(items[0]!.id); const url = new URL(window.location.href); url.searchParams.set('discover', items[0]!.id); window.history.pushState(null, '', url); }}>Browse again</button></p> : <article tabIndex={0} aria-label={`${items.indexOf(current) + 1} of ${items.length}: ${current.title}`} aria-describedby="discovery-help"
      onPointerDown={e => {
        if (start.current || !e.isPrimary) { start.current = null; return; }
        if (e.pointerType !== 'touch' || (e.target as HTMLElement).closest('a,button,summary')) return;
        start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={e => { const s = start.current; if (s && Math.abs(e.clientY - s.y) > 20 && Math.abs(e.clientY - s.y) > Math.abs(e.clientX - s.x)) start.current = null; }}
      onPointerCancel={() => { start.current = null; }}
      onPointerUp={e => { const s = start.current; start.current = null; if (!s || s.id !== e.pointerId) return; const dx = e.clientX - s.x; if (Math.abs(dx) >= 60 && Math.abs(dx) >= Math.abs(e.clientY - s.y) * 2) advance(dx > 0); }}>
      <p>Fictional sample · {items.indexOf(current) + 1} of {items.length}</p>
      <h3>{current.title}</h3><p>{current.summary}</p><ProposalProvenance item={current} compact />
      <div className="workflow-card-actions"><button onClick={() => advance(false)}>Skip</button><button onClick={() => advance(true)}>Save for later</button><a href={fullUrl(current.id)}>Read full proposal</a></div>
    </article>}
    <p role="status" aria-live="polite">{notice} {current ? `Current card: ${current.title}.` : ''}</p>
    {state.saved.length > 0 && <details><summary>Saved for later ({state.saved.length})</summary><ul>{state.saved.map(id => { const item = items.find(i => i.id === id); return <li key={id}>{item ? <a href={fullUrl(id)}>{item.title}</a> : 'Saved sample outside current filters or unavailable'}</li>; })}</ul></details>}
  </section>;
}
