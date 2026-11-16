import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyDB } from "./src/engine/engine";
import { DEMO_ITEMS } from "./src/engine/demo";
import { reportRevision, reportUrl } from "./src/shared/error-reports";

type RunningServer = { url: URL; stop: () => Promise<void> };

function deadline<T>(promise: Promise<T>, milliseconds: number, message: () => string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message())), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** A fresh process proves persistence and avoids changing the test runner's env/module cache. */
async function startServer(dbPath: string): Promise<RunningServer> {
  let logs = "";
  let announce!: (url: URL) => void;
  let fail!: (error: Error) => void;
  let announced = false;
  const ready = new Promise<URL>((resolve, reject) => { announce = resolve; fail = reject; });
  const child = Bun.spawn([process.execPath, "server.ts"], {
    cwd: import.meta.dir,
    env: {
      PATH: process.env.PATH ?? "",
      DB_PATH: dbPath,
      PORT: "0",
      NODE_ENV: "production",
      ANON_COOKIE_SECRET: "integration-only-cookie-secret-at-least-32-chars",
      ADMIN_TOKEN: "integration-reset-admin",
      DEBUG_REQUEST_LOGS: "0",
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  async function collect(stream: ReadableStream<Uint8Array>, detectReady = false) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let stdout = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        logs = (logs + chunk).slice(-12_000);
        if (detectReady && !announced) {
          stdout += chunk;
          const match = stdout.match(/Civic Synthesis prototype running at (https?:\/\/\S+)/);
          if (match) {
            const url = new URL(match[1]!);
            url.hostname = "127.0.0.1";
            announced = true;
            announce(url);
          }
        }
      }
    } finally { reader.releaseLock(); }
  }

  const streams = Promise.all([collect(child.stdout, true), collect(child.stderr)]);
  void streams.catch((error) => fail(error instanceof Error ? error : new Error(String(error))));
  void child.exited.then((code) => {
    if (!announced) fail(new Error(`Child server exited with ${code} before starting.\n${logs}`));
  });

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null) child.kill("SIGTERM");
    try { await deadline(child.exited, 2_000, () => "Child did not stop after SIGTERM"); }
    catch { child.kill("SIGKILL"); await child.exited; }
    await streams;
  }

  try {
    const url = await deadline(ready, 15_000, () => `Child server did not become ready.\n${logs}`);
    return { url, stop };
  } catch (error) { await stop(); throw error; }
}

test('reporting router protects triage, retains private reports across restart and demo reset', async () => {
  const root = await mkdtemp(join(tmpdir(), 'she-895-'));
  const dbPath = join(root, 'db.json');
  await Bun.write(dbPath, JSON.stringify(emptyDB()));
  let server = await startServer(dbPath);
  const target = { kind: 'sample', id: DEMO_ITEMS[0]!.id, revision: await reportRevision(JSON.stringify(DEMO_ITEMS[0])) };
  const body = { ...target, reason: 'PRIVATE-REPORT-TEXT: missing source evidence', idempotencyKey: crypto.randomUUID() };
  const read = (path: string, auth = false) => fetch(new URL(path, server.url), { headers: auth ? { authorization: 'Basic ' + btoa(':integration-reset-admin') } : {} });
  const post = (path: string, data: unknown, auth = false, origin?: string) => fetch(new URL(path, server.url), { method: 'POST', headers: { 'content-type': 'application/json', origin: origin ?? server.url.origin, ...(auth ? { authorization: 'Bearer integration-reset-admin' } : {}) }, body: JSON.stringify(data) });
  try {
    expect((await read(reportUrl(target))).status).toBe(200);
    expect((await read('/admin/error-reports')).status).toBe(401);
    expect((await post('/api/admin/error-reports', {})).status).toBe(401);
    expect((await post('/api/error-reports', body, false, 'https://foreign.example')).status).toBe(403);
    expect((await post('/api/error-reports', body)).status).toBe(201);
    expect(await (await read('/admin/error-reports', true)).text()).toContain(body.reason);
    expect(await (await read('/api/state')).text()).not.toContain(body.reason);
    expect(await (await read('/api/citizen-proposals')).text()).not.toContain(body.reason);
    const decision = { id: body.idempotencyKey, expectedVersion: 1, status: 'reviewing', correctionNote: 'Source review requested' };
    expect((await post('/api/admin/error-reports', decision, true, 'https://foreign.example')).status).toBe(403);
    expect((await post('/api/admin/error-reports', decision, true)).status).toBe(200);
    expect((await post('/api/reset', {}, true)).status).toBe(200);
    await server.stop(); server = await startServer(dbPath);
    const queue = await read('/admin/error-reports', true);
    expect(queue.headers.get('cache-control')).toBe('no-store');
    const html = await queue.text();
    expect(html).toContain(body.reason); expect(html).toContain('Source review requested');
    const stored = JSON.parse(await Bun.file(dbPath).text()).errorReports[0];
    expect(Object.keys(stored).sort()).toEqual(['id','target','snapshot','reason','createdAt','status','correctionNote','version','history'].sort());
  } finally { await server.stop(); await rm(root, { recursive: true, force: true }); }
}, 40000);
