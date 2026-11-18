import type { TopicHubData } from './topic-hubs';

export type NeighborhoodNode = { id: string; label: string; kind: 'need' | 'proposal' | 'source'; detail: string; href: string };
export type NeighborhoodEdge = { from: string; to: string; label: string };
/** Only recorded relationships. No prose classification, resident counts or geographic coordinates. */
export function topicNeighborhood(hub: TopicHubData) {
  const nodes: NeighborhoodNode[] = hub.needs.map(n => ({ id: `need:${n.id}`, label: n.label, kind: 'need',
    detail: `Illustrative catalog goal: ${n.goal}. Metric: ${n.metric}`, href: `/needs?${new URLSearchParams({ need: n.id, topic: hub.topic.id })}` }));
  const edges: NeighborhoodEdge[] = [];
  const needs = new Set(hub.needs.map(n => n.id));
  for (const p of hub.proposals) {
    if (!needs.has(p.needId)) continue;
    nodes.push({ id: `proposal:${p.id}`, label: p.title, kind: 'proposal', detail: `Hypothetical catalog alternative · ${p.jurisdiction}${p.rightsIssue ? ` · Rights constraint: ${p.rightsIssue}` : ''}`,
      href: `#policy-${p.id}` });
    edges.push({ from: `need:${p.needId}`, to: `proposal:${p.id}`, label: 'Catalog need assignment' });
  }
  for (const s of hub.stories) {
    const targets = [...s.needIds.map(id => `need:${id}`), ...s.proposalIds.map(id => `proposal:${id}`)].filter(id => nodes.some(n => n.id === id));
    if (!targets.length) continue;
    nodes.push({ id: `source:${s.id}`, label: `Sample source ${s.id}`, kind: 'source', detail: 'Fictional repository sample; recorded extraction, not verified evidence. Freshness not assessed.',
      href: `/api/citizen-proposals/journal/${encodeURIComponent(s.id)}` });
    for (const to of new Set(targets)) edges.push({ from: `source:${s.id}`, to, label: 'Recorded sample extraction' });
  }
  return { nodes, edges };
}

/** Bounded deterministic force relaxation, computed once; never an animation loop. */
export function neighborhoodLayout(nodes: NeighborhoodNode[], edges: NeighborhoodEdge[]) {
  const points = nodes.map((n, i) => ({ id: n.id, x: 450 + 300 * Math.cos(i * 2.39996), y: 320 + 230 * Math.sin(i * 2.39996) }));
  const index = new Map(points.map(p => [p.id, p]));
  for (let step = 0; step < 100; step++) {
    const forces = points.map(p => ({ x: (450 - p.x) * .004, y: (320 - p.y) * .004 }));
    points.forEach((p, i) => points.forEach((q, j) => {
      if (i === j) return;
      const dx = p.x - q.x, dy = p.y - q.y, d2 = Math.max(100, dx * dx + dy * dy);
      forces[i]!.x += dx * 650 / d2; forces[i]!.y += dy * 650 / d2;
    }));
    for (const e of edges) {
      const a = index.get(e.from), b = index.get(e.to);
      if (!a || !b) continue;
      const i = points.indexOf(a), j = points.indexOf(b), dx = b.x - a.x, dy = b.y - a.y;
      forces[i]!.x += dx * .012; forces[i]!.y += dy * .012;
      forces[j]!.x -= dx * .012; forces[j]!.y -= dy * .012;
    }
    points.forEach((p, i) => { p.x = Math.max(90, Math.min(810, p.x + forces[i]!.x)); p.y = Math.max(35, Math.min(605, p.y + forces[i]!.y)); });
  }
  return points;
}
