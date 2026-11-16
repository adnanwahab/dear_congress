import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDB } from './src/engine/engine';

test('HTTP journal aliases dedupe concurrent writes and replay votes after restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'she-938-'));
  const path = join(dir, 'db.json');
  await Bun.write(path, JSON.stringify(emptyDB()));
  let child: ReturnType<typeof Bun.spawn> | undefined;
  const start = async () => {
    child = Bun.spawn([process.execPath, 'server.ts'], { env: { PATH: process.env.PATH!, DB_PATH: path, PORT: '0', NODE_ENV: 'production', ANON_COOKIE_SECRET: 'local-test-secret-at-least-32-characters', OPENAI_API_KEY: '', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '', PUBLIC_IP_LIMIT: '1000', PUBLIC_ID_LIMIT: '1000', PUBLIC_JOURNAL_LIMIT: '1000' }, stdout: 'pipe', stderr: 'inherit' });
    const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
    let output = '';
    const timer = setTimeout(() => child?.kill(), 20000);
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) throw Error('server exited before readiness');
        output += new TextDecoder().decode(part.value);
        const match = output.match(/running at (http:\/\/\S+)/);
        if (match) { const url = new URL(match[1]!); url.hostname = '127.0.0.1'; void (async () => { while (!(await reader.read()).done) {} })(); return url; }
      }
    } finally { clearTimeout(timer); }
  };
  const stop = async () => { child?.kill(); await child?.exited; };
  try {
    let url = await start();
    const identity = await fetch(new URL('/api/state', url));
    const cookie = identity.headers.get('set-cookie')!.split(';')[0]!;
    const post = (route: string, body: unknown, key?: string) => fetch(new URL(route, url), { method: 'POST', headers: { cookie, origin: url.origin, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, body: JSON.stringify(body) });
    const measurements = [];
    for (const [route, body] of [
      ['/api/journal', { text: 'Reliable buses for commuting' }],
      ['/api/entries', { text: 'Safe housing for families' }],
      ['/api/publish_draft', { kind: 'journal', text: 'Clean drinking water' }],
      ['/api/entries', { text: 'Contact me at resident@example.com' }],
    ] as const) {
      const before = (await Bun.file(path).json()).entries.length;
      const key = crypto.randomUUID(); const started = performance.now();
      const responses = await Promise.all(Array.from({ length: 8 }, () => post(route, body, key)));
      const outcomes = await Promise.all(responses.map(async r => ({ status: r.status, body: await r.text() })));
      expect(outcomes[0]!.status).toBe(body.text.includes('@') ? 202 : 200);
      for (const outcome of outcomes) expect(outcome).toEqual(outcomes[0]!);
      expect((await Bun.file(path).json()).entries.length - before).toBe(1);
      measurements.push({ route, attempts: 8, created: 1, elapsedMs: +(performance.now() - started).toFixed(2) });
      await stop(); url = await start();
      const replay = await post(route, body, key);
      expect({ status: replay.status, body: await replay.text() }).toEqual(outcomes[0]!);
      expect((await post(route, { ...body, text: 'Different request' }, key)).status).toBe(409);
    }
    const before = (await Bun.file(path).json()).entries.length;
    const baselineStart = performance.now();
    await Promise.all(Array.from({ length: 8 }, () => post('/api/journal', { text: 'Baseline bus service' })));
    expect((await Bun.file(path).json()).entries.length - before).toBe(8);
    measurements.push({ route: '/api/journal without key', attempts: 8, created: 8, elapsedMs: +(performance.now() - baselineStart).toFixed(2) });
    const key = crypto.randomUUID();
    expect((await post('/api/votes', { allocation: { housing: 10 } }, key)).status).toBe(200);
    expect((await post('/api/votes', { allocation: { housing: 20 } }, crypto.randomUUID())).status).toBe(200);
    const allocations = (await Bun.file(path).json()).allocationByVoter;
    await stop(); url = await start();
    expect((await post('/api/votes', { allocation: { housing: 10 } }, key)).status).toBe(200);
    expect((await Bun.file(path).json()).allocationByVoter).toEqual(allocations);
    console.log('SHE-938 local reliability measurements', JSON.stringify(measurements));
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
}, 60000);
