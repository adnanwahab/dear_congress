import { useEffect, useMemo, useRef, useState } from 'react';
import type { TopicHubData } from '../shared/topic-hubs';
import { neighborhoodLayout, topicNeighborhood } from '../shared/topic-neighborhood';
import { TopicChip } from './TopicChip';
import './topic-neighborhood.css';

export function TopicNeighborhood({ hub }: { hub: TopicHubData }) {
  const read = () => new URLSearchParams(window.location.search);
  const [params, setParams] = useState(read);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => {
    const restore = () => setParams(read());
    window.addEventListener('popstate', restore);
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media?.matches ?? false);
    media?.addEventListener('change', motion);
    return () => { window.removeEventListener('popstate', restore); media?.removeEventListener('change', motion); };
  }, []);
  function update(key: string, value: string) {
    const next = read();
    if (value) next.set(key, value); else next.delete(key);
    window.history.pushState(null, '', `${window.location.pathname}?${next}`);
    setParams(next);
  }
  const graph = useMemo(() => topicNeighborhood(hub), [hub]);
  const positions = useMemo(() => new Map(neighborhoodLayout(graph.nodes, graph.edges).map(p => [p.id, p])), [graph]);
  const query = params.get('nq') ?? '';
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const nodes = graph.nodes.filter(n => terms.every(t => `${n.id} ${n.label} ${n.detail}`.toLowerCase().includes(t)));
  const selected = graph.nodes.find(n => n.id === params.get('node'));
  const list = reduced || params.get('view') === 'list';
  const zoom = Math.max(1, Math.min(3, Number(params.get('zoom')) || 1));
  const center = (zoom > 1 ? positions.get(selected?.id ?? '') : undefined) ?? { x: 450, y: 320 };
  function select(id: string) { update('node', id); detail.current?.focus(); }
  return <section className="neighborhood panel" aria-labelledby="neighborhood-title">
    <h2 id="neighborhood-title">Civic problem neighborhood</h2><TopicChip topic={hub.topic.label} />
    <p>Hypothetical topic clusters, not real geography. Blocks are needs; buildings are policy alternatives; streets show only recorded source or catalog edges. Distance, size and placement imply no support, impact or causation.</p>
    <p>Catalog and fictional sample records only. No resident text, locations, participation counts or personal data are aggregated.</p>
    <label>Search neighborhood details<input type="search" value={query} onChange={e => update('nq', e.target.value)} /></label>
    <button aria-pressed={list} disabled={reduced} onClick={() => update('view', list ? 'map' : 'list')}>{list ? 'Show map' : 'Static / low-power list'}</button>
    {reduced && <p>Reduced motion: static list enabled.</p>}
    <p role="status">{nodes.length} catalog and sample records</p>
    {!nodes.length && <p>No records match. Clear the search or choose another topic above.</p>}
    {!list && nodes.length > 0 && <>
      <label>Zoom<input aria-label="Neighborhood zoom" type="range" min="1" max="3" step="0.5" value={zoom} onChange={e => update('zoom', e.target.value)} /></label>
      <button onClick={() => update('zoom', '1')}>Reset zoom</button>
      <svg className="neighborhood-map" viewBox={`${center.x - 450 / zoom} ${center.y - 320 / zoom} ${900 / zoom} ${640 / zoom}`} role="group" aria-label="Topic neighborhood map. Select a record to focus and inspect it.">
        {graph.edges.filter(e => nodes.some(n => n.id === e.from) && nodes.some(n => n.id === e.to)).map(e => {
          const a = positions.get(e.from)!, b = positions.get(e.to)!;
          return <line key={`${e.from}:${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}><title>{e.label}</title></line>;
        })}
        {nodes.map(n => { const p = positions.get(n.id)!; return <foreignObject key={n.id} x={p.x - 80} y={p.y - 25} width="160" height="64"><button className={`neighborhood-${n.kind}`} aria-pressed={selected?.id === n.id} onClick={() => select(n.id)}>{n.kind === 'need' ? 'Block' : n.kind === 'proposal' ? 'Building' : 'Source'}: {n.label}</button></foreignObject>; })}
      </svg>
    </>}
    <nav aria-label="Neighborhood records"><ul>{nodes.map(n => <li key={n.id}><button aria-pressed={selected?.id === n.id} onClick={() => select(n.id)}>{n.kind}: {n.label}</button></li>)}</ul></nav>
    <section ref={detail} tabIndex={-1} aria-label="Selected neighborhood record">
      {selected ? <><h3>{selected.label}</h3><p>{selected.detail}</p><a href={selected.href}>Inspect original record / alternatives</a><h4>Recorded streets</h4><ul>{graph.edges.filter(e => e.from === selected.id || e.to === selected.id).map(e => {
        const target = graph.nodes.find(n => n.id === (e.from === selected.id ? e.to : e.from))!;
        return <li key={`${e.from}:${e.to}`}>{e.label}: <button onClick={() => select(target.id)}>{target.label}</button></li>;
      })}</ul></> : <p>{params.has('node') ? 'Selected record unavailable. Choose another record.' : 'Select a block, building or source to inspect its recorded relationships.'}</p>}
    </section>
  </section>;
}
