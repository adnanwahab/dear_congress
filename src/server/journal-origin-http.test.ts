import { expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDB, extract } from '../engine/engine';

test('journal origins survive restart and filtered HTTP/SSE reads preserve raw records', async () => {
  const db = emptyDB(); db.schemaVersion = 2;
  db.entries = ['sample', 'sim-a', 'sim-b', 'real'].map((id, i) => ({ id, author: 'Resident', text: 'Need groceries', createdAt: new Date(Date.UTC(2026, 10, 13, i)).toISOString(), extraction: extract('Need groceries'), corrected: false, ...(id === 'sample' ? { seeded: true } : id.startsWith('sim') ? { synthetic: true, source: 'world' } : {}) }));
  const path = join(tmpdir(), `dc-journal-origin-${crypto.randomUUID()}.json`);
  await Bun.write(path, JSON.stringify(db));
  const saved = { DB_PATH: process.env.DB_PATH, PORT: process.env.PORT };
  let server: { url: URL; stop: (force?: boolean) => void } | undefined;
  try {
    process.env.DB_PATH = path; process.env.PORT = '0';
    for (let restart = 0; restart < 2; restart++) {
      server = (await import(`../../server.ts?journal-origin=${crypto.randomUUID()}`)).server;
      const read = async (query: string) => (await fetch(new URL(`/api/entries${query}`, server!.url))).json();
      expect((await read('?origin=real')).entries.map((e: any) => e.id)).toEqual(['real']);
      const sims = await read('?origin=simulated&limit=1');
      if (restart === 0) { expect(sims.entries[0].repetition.count).toBe(2); expect(sims.nextCursor).toBeNull(); }
      expect((await read('')).total).toBe(4 + restart);
      expect((await read('?origin=sample')).entries[0].origin).toBe('sample');
      expect((await fetch(new URL('/api/entries?origin=unknown', server!.url))).status).toBe(400);
      const stream = await fetch(new URL('/api/entries/events?origin=simulated', server!.url), { signal: AbortSignal.timeout(5000) });
      const reader = stream.body!.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      const snapshot = JSON.parse(first.slice(6).trim());
      expect(snapshot.entries).toEqual((await read('?origin=simulated')).entries);
      if (restart === 0) {
        const published = await fetch(new URL('/api/publish_draft', server!.url), {
          method: 'POST', headers: { 'content-type': 'application/json', origin: server!.url.origin },
          body: JSON.stringify({ kind: 'journal', text: 'A new simulated experience', synthetic: true, source: 'world' }),
        });
        expect(published.status).toBe(200);
        expect((await published.json()).entry.origin).toBe('simulated');
        const update = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6).trim());
        expect(update.entries).toEqual((await read('?origin=simulated')).entries);
      }
      await reader.cancel();
      server!.stop(true); server = undefined;
    }
    const stored = await Bun.file(path).json();
    expect(stored.entries.slice(0, 4).map((e: any) => e.origin)).toEqual(['sample', 'simulated', 'simulated', 'real']);
    expect(stored.entries.slice(0, 4).map(({ origin, ...e }: any) => e)).toEqual(db.entries);
  } finally {
    server?.stop(true); await Bun.file(path).delete();
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
