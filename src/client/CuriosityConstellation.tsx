import { useState } from 'react';
import type { TopicHubData } from '../shared/topic-hubs';
import { curiosityGraph } from '../shared/curiosity-graph';

export function CuriosityConstellation({ hub }: { hub: TopicHubData }) {
  const { nodes, edges } = curiosityGraph(hub);
  const [selected, select] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [list, showList] = useState(false);
  const node = nodes.find(n => n.id === selected);
  const columns = ['story', 'need', 'policy', 'metric'];
  const position = (id: string) => {
    const n = nodes.find(n => n.id === id)!;
    return { x: columns.indexOf(n.kind) * 260 + 20, y: nodes.filter(m => m.kind === n.kind).findIndex(m => m.id === id) * 110 + 30 };
  };
  const height = Math.max(240, ...columns.map(kind => nodes.filter(n => n.kind === kind).length * 110 + 40));
  // Walk stored connections in either direction so a metric can reveal its
  // sample origins too. Arrow direction remains explicit in every explanation.
  const reachable = new Set(selected ? [selected] : []);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const e of edges) {
      if ((reachable.has(e.from) || reachable.has(e.to)) && (!reachable.has(e.from) || !reachable.has(e.to))) {
        reachable.add(e.from); reachable.add(e.to); expanded = true;
      }
    }
  }
  const connected = edges.filter(e => reachable.has(e.from) && reachable.has(e.to));
  const describe = (id: string) => nodes.find(n => n.id === id)?.label ?? id;
  return <section className="panel constellation" aria-labelledby="constellation-title">
    <h2 id="constellation-title">Curiosity constellation</h2>
    <p>Explore how one need connects experiences, policy alternatives and measurement targets. Select a node to preview its paths before leaving.</p>
    <p>Solid lines: recorded lineage in fictional samples. Dashed lines: illustrative catalog relationships. Neither is real advisory activity, model simulation or verified evidence. No real graph edges are registered.</p>
    <p>Official bills and measured outcomes: no reviewed source binding available. Measurement targets are not measurements.</p>
    {!nodes.length ? <p>No connected records available for this topic.</p> : <>
      <div className="constellation-controls"><button aria-pressed={list} onClick={() => showList(!list)}>{list ? 'Show graph' : 'Show equivalent list'}</button>
        <button disabled={zoom <= 0.75} onClick={() => setZoom(z => Math.max(0.75, z - 0.25))}>Zoom out</button>
        <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button disabled={zoom >= 2} onClick={() => setZoom(z => Math.min(2, z + 0.25))}>Zoom in</button>
        <button onClick={() => setZoom(1)}>Reset zoom</button></div>
      {!list && <div className="constellation-viewport" tabIndex={0} role="region" aria-label="Scrollable civic graph. Use Tab to select nodes, or scroll to pan.">
        <div style={{ width: 1060 * zoom, height: height * zoom }}><div className="constellation-canvas" style={{ width: 1060, height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <svg width="1060" height={height} aria-hidden="true">{edges.map((e, i) => {
            const a = position(e.from), b = position(e.to);
            return <line key={i} x1={a.x + 110} y1={a.y + 32} x2={b.x + 110} y2={b.y + 32} stroke="currentColor" strokeWidth="2" strokeDasharray={e.lane === 'illustrative-catalog' ? '6 5' : undefined} opacity={selected && !reachable.has(e.from) ? 0.2 : 0.65} />;
          })}</svg>
          {nodes.map(n => { const p = position(n.id); return <button key={n.id} className="constellation-node" style={{ left: p.x, top: p.y }} aria-pressed={n.id === selected} onClick={() => select(n.id)}><small>{n.kind} · {n.kind === 'story' ? 'fictional sample' : 'illustrative catalog'}</small><span>{n.label}</span></button>; })}
        </div></div>
      </div>}
      {list && <ul>{nodes.map(n => <li key={n.id}><button aria-pressed={n.id === selected} onClick={() => select(n.id)}>{n.kind}: {n.label}</button><p>{n.source}</p><ul>{edges.filter(e => e.from === n.id || e.to === n.id).map((e, i) => <li key={i}>{describe(e.from)} → {e.relationship} → {describe(e.to)}. {e.provenance} [{e.lane}]</li>)}</ul></li>)}</ul>}
      <div className="constellation-preview" aria-live="polite">{node ? <><h3>{node.label}</h3><p>{node.source}</p><h4>Source-connected paths</h4>{connected.length ? <ul>{connected.map((e, i) => <li key={i}>{describe(e.from)} → {e.relationship} → {describe(e.to)}<p>{e.provenance} [{e.lane}]</p></li>)}</ul> : <p>No recorded connections.</p>}<p>Next step: {node.preview}</p><a href={node.href}>Continue to source context</a></> : <p>Select a node to inspect its provenance and next step. Selection does not navigate or record a vote.</p>}</div>
    </>}
  </section>;
}
