import { expect, test } from 'bun:test';
import { emptyDB } from './src/engine/engine';
import { DEMO_ITEMS, demoPayload, type DemoPayload } from './src/engine/demo';

test('demo dates roll forward and sample scenarios have usable reference links', () => {
  const sunday = demoPayload({}, '', new Date('2026-11-15T12:00:00Z'));
  expect(sunday.closesAt).toBe('2026-11-22T00:00:00.000Z');
  expect(DEMO_ITEMS.length).toBe(12);
  expect(new Set(DEMO_ITEMS.map(i => i.id)).size).toBe(12);
  for (const item of DEMO_ITEMS) expect(new URL(item.sourceUrl).protocol).toBe('https:');
});

test('demo voting is private, replaces prior votes, rejects invalid requests atomically, and survives restart', async () => {
  const path = `/tmp/civic-demo-test-${crypto.randomUUID()}.json`;
  const db = emptyDB(); db.schemaVersion = 2;
  await Bun.write(path, JSON.stringify(db));
  const previous = { ANON_COOKIE_SECRET: process.env.ANON_COOKIE_SECRET, DB_PATH: process.env.DB_PATH, PORT: process.env.PORT, DEBUG_REQUEST_LOGS: process.env.DEBUG_REQUEST_LOGS, OPENAI_API_KEY: process.env.OPENAI_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
  process.env.OPENAI_API_KEY = ''; process.env.GEMINI_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';
  process.env.ANON_COOKIE_SECRET = 'demo-integration-only-stable-secret-32-characters';
  process.env.DB_PATH = path; process.env.PORT = '0'; process.env.DEBUG_REQUEST_LOGS = '0';
  let server: { url: URL; stop(force?: boolean): void } | undefined;
  try {
    server = (await import(`./server.ts?demo-test=${crypto.randomUUID()}`)).server;
    const origin = server!.url;
    const cookies = new Map<string, string>();
    const request = async (voter: string, route: string, body?: unknown) => {
      const headers = new Headers({ 'content-type': 'application/json' });
      if (cookies.has(voter)) headers.set('cookie', cookies.get(voter)!);
      const response = await fetch(new URL(route, server!.url), { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const issued = response.headers.get('set-cookie')?.split(';')[0];
      if (issued) cookies.set(voter, issued);
      return response;
    };
    const get = (voter: string) => request(voter, '/api/demo');
    const post = (voter: string, body: unknown) => request(voter, '/api/votes', body);
    const vote = { proposalId: 'demo-housing', stance: 1, importance: .5, acceptCompromise: true, concern: '', changeMind: '' };
    expect((await fetch(new URL('/healthz', origin))).status).toBe(200);
    for (const route of ['/published','/feed','/votes','/draft','/sponsors','/outcomes','/journal','/api-docs','/map']) {
      expect((await fetch(new URL(route, origin))).status).toBe(200);
    }
    expect((await fetch(new URL('/api/reset', origin), { method: 'POST' })).status).toBe(404);
    const schemaRes = await fetch(new URL('/api/journal-client/schema', origin), { headers: { origin: 'https://journal.example' } });
    expect(schemaRes.headers.get('access-control-allow-origin')).toBeTruthy();
    expect((await schemaRes.json()).version).toBe(2);
    const streamRes = await fetch(new URL('/api/entries/events', origin), { headers: { origin: 'https://journal.example' } });
    expect(streamRes.headers.get('access-control-allow-origin')).toBeTruthy();
    expect(streamRes.headers.get('content-type')).toContain('text/event-stream');
    const streamReader = streamRes.body!.getReader();
    expect(new TextDecoder().decode((await streamReader.read()).value)).toContain('data:');
    await streamReader.cancel();

    const publish = (text: string) => fetch(new URL('/api/publish_draft', origin), { method: 'POST', headers: { 'content-type': 'application/json', 'x-voter-id': 'journal-client' }, body: JSON.stringify({ kind: 'journal', text, author: 'Integration sample', synthetic: true }) });
    expect((await publish('Sample: reliable buses would help with my commute.')).status).toBe(200);
    expect((await publish('Sample: childcare costs are too high for working families.')).status).toBe(200);
    const firstPage = await (await fetch(new URL('/api/entries?limit=1', origin))).json();
    expect(firstPage.entries).toHaveLength(1);
    expect(firstPage.total).toBe(2);
    expect(firstPage.nextCursor).toBe(firstPage.entries[0].id);
    const secondPage = await (await fetch(new URL('/api/entries?limit=1&cursor=' + encodeURIComponent(firstPage.nextCursor), origin))).json();
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.entries[0].id).not.toBe(firstPage.entries[0].id);
    expect(secondPage.nextCursor).toBeNull();
    expect((await fetch(new URL('/api/entries?limit=1000', origin))).status).toBe(400);
    expect((await publish('x'.repeat(10001))).status).toBe(400);

    expect((await post('alice', { votes: [vote] })).status).toBe(200);
    const ownRes = await get('alice');
    expect(ownRes.headers.get('cache-control')).toContain('no-store');
    const own = await ownRes.json() as DemoPayload;
    expect(own.votes['demo-housing']).toBe(1);
    expect(own.items[0]!.support).toBe(DEMO_ITEMS[0]!.support + 1);
    const other = await (await get('bob')).json() as DemoPayload;
    expect(other.votes).toEqual({});
    expect(other.items[0]!.support).toBe(own.items[0]!.support);
    expect((await post('alice', { votes: [{ ...vote, stance: -1 }] })).status).toBe(200);
    let changed = await (await get('alice')).json() as DemoPayload;
    expect(changed.items[0]!.support).toBe(DEMO_ITEMS[0]!.support);
    expect(changed.items[0]!.oppose).toBe(DEMO_ITEMS[0]!.oppose + 1);
    const persisted = await Bun.file(path).text();
    expect((await post('alice', { votes: [vote], allocation: { housing: -10 } })).status).toBe(400);
    expect((await post('alice', { votes: [{ ...vote, stance: 10 }] })).status).toBe(400);
    expect((await post('alice', null)).status).toBe(400);
    expect(await Bun.file(path).text()).toBe(persisted);
    // Concurrent accepted writes must leave a complete, parseable final snapshot.
    await Promise.all(Array.from({ length: 12 }, (_,i) => post(`parallel-${i}`, { votes: [vote] })));
    expect(Object.keys((await Bun.file(path).json()).votesByVoter).length).toBe(13);
    server!.stop(true);
    server = (await import(`./server.ts?demo-restart=${crypto.randomUUID()}`)).server;
    changed = await (await get('alice')).json() as DemoPayload;
    expect(changed.votes['demo-housing']).toBe(-1);
    expect(changed.items[0]!.support).toBe(DEMO_ITEMS[0]!.support + 12);
  } finally {
    server?.stop(true);
    for (const [key,value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await Bun.file(path).delete();
  }
});
