import { expect, test } from 'bun:test';
import { permalinkPage } from './permalink-page';
import { samplePermalink, officialPermalink } from '../shared/permalinks';
import { DEMO_ITEMS } from '../engine/demo';
import { createHash } from 'node:crypto';
import snapshots from '../generated/sample-permalinks.json';
const shell = '<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
test('every current sample has an immutable public snapshot without browser choices', async () => {
  for (const item of DEMO_ITEMS) {
    const snapshot = snapshots.find(s => s.item.id === item.id)!;
    expect(JSON.stringify(snapshot.item)).toBe(JSON.stringify(item));
    expect(snapshot.revision).toBe(createHash('sha256').update(JSON.stringify(snapshot.item)).digest('hex'));
    const path = samplePermalink(item.id);
    expect(path).not.toContain('?');
    const response = (await permalinkPage(shell, path, '/tmp/no-she830-archive'))!;
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(item.title.replaceAll('&', '&amp;'));
    expect(html).toContain(snapshot.revision);
    expect(html).toContain('Fictional sample scenario / not introduced bill');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('ownVote');
  }
});
test('unknown or malformed source identities and revisions return HTTP 404', async () => {
  for (const path of ['/samples/missing', '/samples/demo-rent/../x', officialPermalink('congress-gov:119:hr:1', 'a'.repeat(64)), '/official-records/invalid/x']) {
    expect((await permalinkPage(shell, path, '/tmp/no-she830-archive'))?.status).toBe(404);
  }
});

test('official snapshot keeps the original title after source corrections', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { refreshBill, readBills } = await import('./legislation/import');
  const root = await mkdtemp(join(tmpdir(), 'she830-'));
  const raw = (title: string) => JSON.stringify({ bill: { congress: 119, type: 'HR', number: '123', originChamber: 'House', title, introducedDate: '2025-01-03', sponsors: [], latestAction: { actionDate: '2025-01-03', text: 'Introduced' } } });
  try {
    await refreshBill(root, 119, 'hr', 123, 'test-key', async () => new Response(raw('Original synthetic title')), () => new Date('2026-01-01'));
    const original = (await readBills(root))[0]!;
    const path = officialPermalink(original.id, original.sourceHash);
    await refreshBill(root, 119, 'hr', 123, 'test-key', async () => new Response(raw('Corrected synthetic title')), () => new Date('2026-01-02'));
    const response = (await permalinkPage(shell, path, root))!;
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Original synthetic title');
    expect(html).not.toContain('Corrected synthetic title');
    expect(html).toContain('current legal status and measured outcomes unverified');
    expect(html).toContain(original.sourceHash);
    expect((await permalinkPage(shell, officialPermalink('wrong-source', original.sourceHash), root))?.status).toBe(404);
  } finally { await rm(root, { recursive: true, force: true }); }
});
