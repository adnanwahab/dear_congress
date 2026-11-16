import { expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDB } from './src/engine/engine';

test('debug and publication-label route logs exclude request header/body canaries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'she-945-'));
  const env = { ...process.env };
  let options: any;
  const logs: unknown[][] = [];
  const serve = spyOn(Bun, 'serve').mockImplementation(((o: any) => { options = o; return { url: new URL('http://localhost:8000'), stop() {} }; }) as any);
  const info = spyOn(console, 'log').mockImplementation((...args) => { logs.push(args); });
  const error = spyOn(console, 'error').mockImplementation((...args) => { logs.push(args); });
  const secret = 'CANARY_JOURNAL_TOKEN_URL_SECRET';
  try {
    Object.assign(process.env, { DB_PATH: join(dir, 'db.json'), DEBUG_REQUEST_LOGS: '1', ANON_COOKIE_SECRET: 'test-only-cookie-secret-longer-than-32-characters', PUBLIC_IP_LIMIT: '1000', PUBLIC_ID_LIMIT: '1000' });
    await Bun.write(process.env.DB_PATH!, JSON.stringify(emptyDB()));
    await import(`./server.ts?privateLogs=${crypto.randomUUID()}`);
    const headers = { referer: `https://example.test/${secret}?token=${secret}`, 'user-agent': secret, 'x-request-id': secret, 'fly-client-ip': secret, cookie: `voter=${secret}` };
    const debug = await options.routes['/api/debug/request'].GET(new Request(`http://localhost:8000/api/debug/request?key=${secret}`, { headers }), { requestIP: () => ({ address: '127.0.0.1' }) });
    expect(debug.status).toBe(200);
    expect(debug.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    const preflight = await options.routes['/api/publish_labels'].OPTIONS(new Request('http://localhost:8000/api/publish_labels', { method: 'OPTIONS', headers }), { requestIP: () => ({ address: '127.0.0.1' }) });
    expect(preflight.status).toBe(204);
    expect(JSON.stringify(logs)).not.toContain(secret);
    // Before-change reliability baseline: raw Referer and User-Agent exposed 2 fields.
    const before = JSON.stringify({ referer: headers.referer, userAgent: headers['user-agent'] });
    expect(before.split(secret).length - 1).toBe(3);
  } finally {
    serve.mockRestore(); info.mockRestore(); error.mockRestore();
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    await rm(dir, { recursive: true, force: true });
  }
});
