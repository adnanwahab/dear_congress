import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsensusTerrain, releaseTerrainCell, TERRAIN_GROUPS, TERRAIN_SCOPE } from './ConsensusTerrain';
import { ArgumentMap } from './ArgumentMap';
import { DEMO_ITEMS } from '../engine/demo';

test('release boundary suppresses small groups, rare cells and complementary counts', () => {
  for (const [size, counts] of [
    [9, { both: 0, constrained: 0, other: 9 }],
    [10, { both: 4, constrained: 6, other: 0 }],
    [10, { both: 5, constrained: 4, other: 1 }],
    [10, { both: 5, constrained: 5, other: 5 }],
    [10, { both: NaN, constrained: 5, other: 5 }],
    [10, { both: -1, constrained: 6, other: 5 }],
    [10.5, { both: 5.5, constrained: 5, other: 0 }],
  ] as const) expect(releaseTerrainCell(size, counts)).toBeNull();
  expect(releaseTerrainCell(10, { both: 5, constrained: 5, other: 0 })).toEqual({ both: 5, constrained: 5, other: 0 });
});

test('map exposes pair overlap, unresolved constraints, denominators and invented source', () => {
  const html = renderToStaticMarkup(<ConsensusTerrain scope={TERRAIN_SCOPE} />);
  for (const phrase of ['Synthetic preview', 'no real participants', 'not a representative poll', '33% support both', '50% support both', 'n=20', 'n=10', 'Denominator:', 'synthetic-transit-overlap:v1', 'equal weight', 'its size, cells and identifying labels are withheld', 'explicit consent', 'no network request']) expect(html).toContain(phrase);
  expect(html.match(/class="terrain-meter"/g)).toHaveLength(3);
  expect(html).toContain('role="status"');
  for (const group of TERRAIN_GROUPS) for (const cell of group.cells) expect(releaseTerrainCell(group.size, cell)).not.toBeNull();
});

test('only exact fictional proposal revision exposes terrain, preserving fixtures', () => {
  const item = DEMO_ITEMS.find(row => row.id === 'demo-transit')!;
  const before = JSON.stringify(DEMO_ITEMS);
  expect(renderToStaticMarkup(<ArgumentMap item={item} />)).toContain('Where policy goals overlap');
  for (const props of [{ item, namespace: 'repository-pr' }, { item: { ...item, proposedText: 'changed' } }, { item: { ...item, id: 'citizen-transit' } }]) {
    expect(renderToStaticMarkup(<ArgumentMap {...props} />)).not.toContain('Where policy goals overlap');
  }
  const unavailable = renderToStaticMarkup(<ConsensusTerrain scope="other" />);
  expect(unavailable).toContain('unavailable');
  expect(unavailable).not.toContain('n=20');
  expect(JSON.stringify(DEMO_ITEMS)).toBe(before);
});

test('aggregation controls change values without network, storage or votes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-consensus-terrain.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS terrain');
});
