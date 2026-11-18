import { test, expect } from 'bun:test';
import { topicNeighborhood, neighborhoodLayout } from '../shared/topic-neighborhood';
import { topicHub } from '../shared/topic-hubs';
import { NEEDS as needs, PROPOSALS as proposals } from '../engine/catalog';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposalProvenance } from './ProposalProvenance';
import type { DemoItem } from '../engine/demo';

test('graph uses explicit typed edges, ignores dangling IDs and never includes journal text', () => {
  const hub = topicHub('housing', needs, proposals, [])!;
  hub.stories.push({ id: 'fixture', text: 'private prose', needIds: [hub.needs[0]!.id, 'missing'], proposalIds: ['missing'] });
  const graph = topicNeighborhood(hub);
  expect(JSON.stringify(graph)).not.toContain('private prose');
  expect(graph.edges.every(e => graph.nodes.some(n => n.id === e.from) && graph.nodes.some(n => n.id === e.to))).toBe(true);
  expect(graph.nodes.find(n => n.id === 'source:fixture')?.detail).toContain('Freshness not assessed');
  const layout = neighborhoodLayout(graph.nodes, graph.edges);
  expect(layout).toEqual(neighborhoodLayout(graph.nodes, graph.edges));
  expect(layout.every(p => Number.isFinite(p.x) && p.x >= 90 && p.x <= 810 && p.y >= 35 && p.y <= 605)).toBe(true);
  expect(topicNeighborhood({ ...hub, needs: [], proposals: [], stories: [] })).toEqual({ nodes: [], edges: [] });
});
test('neighborhood interaction, history restoration, empty data, reduced motion and no writes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-topic-neighborhood-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS neighborhood UI');
});

test('stale background evidence stays visibly unverified and keeps its source link', () => {
  const item = { sourceUrl: 'https://example.org/background', jurisdiction: 'City', background: { checkedAt: '2000-01-01', publisher: 'Example publisher', name: 'Old background', scope: 'Background only.' } } as DemoItem;
  const html = renderToStaticMarkup(<ProposalProvenance item={item} />);
  expect(html).toContain('Source not available / not checked');
  expect(html).toContain('https://example.org/background');
  expect(html).toContain('Sample scenario / not introduced bill');
});
