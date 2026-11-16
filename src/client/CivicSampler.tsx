import { useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { stageRoute } from '../shared/civic-stages';
import { ProposalProvenance } from './ProposalProvenance';
import { TopicChip } from './TopicChip';
import { followIdentity, readFollows, toggleFollow } from './proposal-follows';

const tradeoffs: Record<string, string> = {
  'demo-housing': 'More rental homes could widen housing choices, while added density can strain infrastructure and requires safety oversight.',
  'demo-childcare': 'Lower copays could ease family costs, while public funding and enough provider capacity would be needed.',
  'demo-transit': 'More frequent buses could improve access to work, while operating costs and driver capacity constrain service.',
  'demo-flood': 'Risk-based drainage priorities could protect vulnerable homes, while diverting funding from other projects and relying on uncertain risk estimates.',
  'demo-health': 'Combined estimates could help patients compare costs, while uncertain treatment needs and coordination across providers can limit accuracy.',
};
export function samplerItems(items: DemoItem[]) {
  return Object.keys(tradeoffs).flatMap(id => { const item = items.find(i => i.id === id); return item ? [item] : []; });
}
export function CivicSampler({ items, loading, failed, retry }: { items: DemoItem[]; loading: boolean; failed: boolean; retry: () => void }) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const cards = samplerItems(items), item = cards[index];
  const advance = (message: string) => { setStatus(message); setIndex(n => n + 1); heading.current?.focus(); };
  function save() {
    if (!item) return;
    const source = { kind: 'sample' as const, id: item.id, title: item.title, text: item.proposedText };
    try {
      if (!readFollows(localStorage).some(r => followIdentity(r.source) === followIdentity(source))) toggleFollow(localStorage, source);
      window.dispatchEvent(new Event('proposal-follows'));
      advance('Saved to your browser reading list. No vote cast.');
    } catch { setStatus('Could not save the reading list. Browser storage may be unavailable or full. Your card has not been skipped.'); }
  }
  return <section className="panel civic-sampler" data-no-stage-swipe aria-labelledby="sampler-heading">
    <span className="pill info">Demo sandbox · awaiting review</span>
    <h2 id="sampler-heading" ref={heading} tabIndex={-1}>Two-minute civic sampler</h2>
    <p>Explore five topics at your pace. No timer or voting requirement. Fictional policies, not official bills or model projections. Independent of the feed filters.</p>
    <p role="status">{status}</p>
    {!started ? <button type="button" onClick={() => setStarted(true)}>Explore five policies</button> : loading ? <p role="status">Loading sample policies…</p> : failed ? <><p role="alert">Sample policies could not be loaded.</p><button type="button" onClick={retry}>Retry sampler</button></> : cards.length !== 5 ? <><p role="status">The five-policy sampler is unavailable.</p><button type="button" onClick={retry}>Retry sampler</button></> : item ? <article style={{ touchAction: 'pan-y' }}
      onPointerDown={e => {
        origin.current = null;
        if (e.pointerType !== 'touch' || !e.isPrimary || (e.target as Element).closest('a,button,summary,details')) return;
        origin.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={e => {
        const start = origin.current;
        if (start && start.id === e.pointerId && Math.abs(e.clientY - start.y) > 20 && Math.abs(e.clientY - start.y) > Math.abs(e.clientX - start.x)) origin.current = null;
      }}
      onPointerCancel={() => { origin.current = null; }}
      onPointerUp={e => {
        const start = origin.current; origin.current = null;
        if (!start || start.id !== e.pointerId) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 2) advance('Skipped. No vote cast.');
      }}>
      <p>Card {index + 1} of 5 · <TopicChip topic={item.topic} /></p>
      <h3>{item.title}</h3>
      <p>{tradeoffs[item.id]}</p>
      <p>Jurisdiction: {item.jurisdiction} · Discussion status: fictional scenario; official discussion status unavailable.</p>
      <ProposalProvenance item={item} />
      <p>Swipe either way to skip, or use Skip with keyboard or assistive technology. Cards change immediately, including with reduced motion. Swiping never casts a vote.</p>
      <div className="sampler-actions"><button type="button" onClick={save}>Save to reading list</button><button type="button" onClick={() => advance('Skipped. No vote cast.')}>Skip</button><a href={stageRoute('draft', item.id)}>Open context</a></div>
    </article> : <><p>You've explored all five policies. You can stop here.</p><button type="button" onClick={() => { setIndex(0); setStatus('Sampler restarted. No vote cast.'); }}>Explore again</button></>}
    <p><a href="/outcomes#watchlist">Reading list · browser watchlist</a> · Saved only in this browser profile; others using it can read saved text. No notifications or votes.</p>
  </section>;
}
