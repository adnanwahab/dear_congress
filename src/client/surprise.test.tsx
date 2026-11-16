import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS } from '../engine/demo';
import { discoveryPool, nextDiscovery, type Discovery } from './surprise';
import { SurpriseExplorer } from './SurpriseExplorer';

test('discovery preserves identities and links and exhausts the pool before repeating', () => {
  const pool = discoveryPool(DEMO_ITEMS);
  const seen: string[] = [];
  let previous: Discovery | undefined;
  for (let i = 0; i < pool.length; i++) {
    const next = nextDiscovery(pool, seen, previous, () => .5)!;
    expect(seen).not.toContain(next.id);
    seen.push(next.id); previous = next;
    const original = DEMO_ITEMS.find(item => item.id === next.proposalId)!;
    expect(next.href).toBe(next.kind === 'sample' ? `/feed?proposal=${original.id}` : original.sourceUrl);
  }
  expect(new Set(seen).size).toBe(pool.length);
  expect(nextDiscovery(pool, seen, previous)!.id).not.toBe(previous!.id);
  expect(new Set(pool.map(p => p.topic)).size).toBeGreaterThan(5);
  expect(new Set(pool.map(p => p.kind)).size).toBe(2);
  expect(nextDiscovery([], [])).toBeUndefined();
  expect(nextDiscovery([pool[0]!], [pool[0]!.id], pool[0])).toBe(pool[0]);
});

test('prefers changes across dimensions and does not create unsafe background links', () => {
  const pool = discoveryPool(DEMO_ITEMS);
  const first = pool[0]!;
  const next = nextDiscovery(pool, [first.id], first, () => 0)!;
  expect(next.kind).not.toBe(first.kind);
  expect(next.topic).not.toBe(first.topic);
  expect(next.jurisdiction).not.toBe(first.jurisdiction);
  expect(next.proposalId).not.toBe(first.proposalId);
  expect(discoveryPool([{ ...DEMO_ITEMS[0]!, sourceUrl: 'javascript:alert(1)' }])).toHaveLength(1);
});

test('explorer exposes loading, failure and empty states', () => {
  const render = (loaded: boolean, failed: boolean) => renderToStaticMarkup(<SurpriseExplorer items={[]} loaded={loaded} failed={failed} />);
  expect(render(false, false)).toContain('Loading topics');
  expect(render(false, true)).toContain('Explorer unavailable');
  expect(render(true, false)).toContain('No topics are available');
  expect(render(true, false)).toContain('disabled');
});

test('interactive exploration keeps focus and cycles without persistence or requests', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-surprise.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, err] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ code, err }).toEqual({ code: 0, err: '' });
});
