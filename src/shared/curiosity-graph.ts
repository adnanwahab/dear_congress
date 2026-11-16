import type { TopicHubData } from './topic-hubs';

export type CuriosityNode = { id: string; label: string; kind: 'story' | 'need' | 'policy' | 'metric'; source: string; href: string; preview: string };
export type CuriosityEdge = { from: string; to: string; relationship: string; provenance: string; lane: 'sample-lineage' | 'illustrative-catalog' };

/** Read-only projection of the existing consent-filtered hub. Never matches titles or infers new lineage. */
export function curiosityGraph(hub: TopicHubData) {
  const nodes: CuriosityNode[] = [];
  const edges: CuriosityEdge[] = [];
  const context = (need: string) => `/needs?${new URLSearchParams({ need, topic: hub.topic.id })}`;
  for (const n of hub.needs) {
    nodes.push({ id: `need:${n.id}`, label: n.label, kind: 'need', source: `Catalog need: ${n.id}`, href: context(n.id), preview: 'Read the goal and competing illustrative policy alternatives.' });
    nodes.push({ id: `metric:${n.id}`, label: n.metric, kind: 'metric', source: `Catalog need ${n.id} · metric field`, href: context(n.id), preview: 'Inspect the catalog measurement target. No observed value or verified outcome is registered.' });
    edges.push({ from: `need:${n.id}`, to: `metric:${n.id}`, relationship: 'Defines measurement target', provenance: `Catalog need ${n.id}. Target only; no measured effect.`, lane: 'illustrative-catalog' });
  }
  for (const p of hub.proposals) {
    nodes.push({ id: `policy:${p.id}`, label: p.title, kind: 'policy', source: `Illustrative engine catalog: ${p.id} · ${p.jurisdiction}`, href: context(p.needId), preview: `Compare illustrative alternatives; this is not an official bill.${p.rightsIssue ? ` Rights constraint: ${p.rightsIssue}` : ''}` });
    edges.push({ from: `policy:${p.id}`, to: `need:${p.needId}`, relationship: 'Catalog alternative for', provenance: `Catalog proposal ${p.id} · needId=${p.needId}. No endorsement or causal claim.`, lane: 'illustrative-catalog' });
  }
  for (const s of hub.stories) {
    nodes.push({ id: `story:${s.id}`, label: s.text, kind: 'story', source: `Fictional repository sample: ${s.id}`, href: `/api/citizen-proposals/journal/${encodeURIComponent(s.id)}`, preview: 'Open the original public sample JSON record and its stored extraction.' });
    for (const n of s.needIds) edges.push({ from: `story:${s.id}`, to: `need:${n}`, relationship: 'Stored sample need label', provenance: `Source entry ${s.id} · extraction.needs. Fictional story, not resident evidence.`, lane: 'sample-lineage' });
    for (const p of s.proposalIds) edges.push({ from: `story:${s.id}`, to: `policy:${p}`, relationship: 'Stored sample proposal link', provenance: `Source entry ${s.id} · extraction.proposalIds. Not a newly inferred relationship.`, lane: 'sample-lineage' });
  }
  const ids = new Set(nodes.map(n => n.id));
  return { nodes, edges: edges.filter(e => ids.has(e.from) && ids.has(e.to)) };
}
