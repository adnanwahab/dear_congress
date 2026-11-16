import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, platform, arch, cpus } from 'node:os';
import { join } from 'node:path';
import { emptyDB, extract } from '../src/engine/engine';

// Deliberately no URL, path, credential, or load-size overrides. Never targets a live site.
const cases = [500, 5000].flatMap(entries => [16, 4].map(pool => ({ entries, pool })));
const caseIndex = process.argv.indexOf('--case');
if (caseIndex < 0) {
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const child = Bun.spawn([process.execPath, '--no-env-file', import.meta.path, '--case', String(i)], {
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', TMPDIR: tmpdir() },
      stdout: 'pipe', stderr: 'pipe',
    });
    const deadline = setTimeout(() => child.kill(), 120_000);
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      assert.equal(code, 0, stderr + stdout);
      const line = stdout.split('\n').find(line => line.startsWith('BENCH_RESULT '));
      assert.ok(line, stdout);
      results.push(JSON.parse(line.slice('BENCH_RESULT '.length)));
    } finally { clearTimeout(deadline); }
  }
  console.log(JSON.stringify({ syntheticOnly: true, transport: 'in-process real wrapped handlers; no HTTP sockets', createdAt: new Date().toISOString(), bun: Bun.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, requestsPerCase: 48, timeoutMs: 10_000, results }, null, 2));
} else {
  const selected = cases[Number(process.argv[caseIndex + 1])];
  assert.ok(selected, 'Unknown bounded case');
  const { entries, pool } = selected;
  const directory = await mkdtemp(join(tmpdir(), 'dc-advisory-bench-'));
  let server: { url: URL; stop(force?: boolean): void } | undefined;
  try {
    // Clear all inherited service credentials and environment configuration before importing router.
    for (const key of Object.keys(process.env)) if (!['PATH', 'HOME', 'TMPDIR'].includes(key)) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: 'production', PORT: '0', DB_PATH: join(directory, 'db.json'), HBL_DB_PATH: join(directory, 'hbl.sqlite'), STATS_DB_PATH: join(directory, 'stats.sqlite'), OUTCOMES_MODE: 'off', HBL_SINGLE_WRITER: '1', HBL_MERGE_ENABLED: '0', HBL_MERGE_DRY_RUN: '1', HBL_KILL_SWITCH: '1', ANON_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), ADMIN_TOKEN: crypto.randomUUID(), DEBUG_REQUEST_LOGS: '0' });
    const db = emptyDB(); db.schemaVersion = 2;
    db.entries = Array.from({length: entries}, (_, i) => ({ id: `synthetic-${i}`, author: 'Synthetic fixture', text: 'Synthetic benchmark: need reliable transit and affordable housing.', createdAt: '2026-11-15T00:00:00.000Z', extraction: extract('Need reliable transit and affordable housing'), corrected: false, synthetic: true, origin: 'simulated' as const }));
    await Bun.write(process.env.DB_PATH!, JSON.stringify(db));
    // Socket binding is unavailable in the task sandbox. Capture the real registered
    // handlers; retain their validation, rate limits, stats observation and disk saves.
    let routes: Record<string, Record<string, Function>> = {};
    let fallback: Function;
    const originalServe = Bun.serve;
    Bun.serve = ((options: any) => {
      routes = options.routes; fallback = options.fetch;
      return { url: new URL('http://127.0.0.1:3000'), stop() {} };
    }) as unknown as typeof Bun.serve;
    try { ({ server } = await import('../server')); } finally { Bun.serve = originalServe; }
    const base = new URL(server.url); base.hostname = '127.0.0.1';
    const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
      const req = new Request(new URL(path, base), { ...init, signal: AbortSignal.timeout(10_000) });
      const route = routes[path];
      const handler = typeof route === 'function' ? route : route?.[init.method ?? 'GET'] ?? fallback;
      assert.ok(handler, path);
      // Deadline detects a stall, but cannot cancel a mutation already accepted by the handler.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([
        Promise.resolve(handler(req, { requestIP: () => ({ address: '127.0.0.1' }) })),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('HandlerTimeout')), 10_000); }),
      ]); } finally { clearTimeout(timer); }
    };
    const vote = { proposalId: 'demo-housing', stance: 1, importance: 0.5, acceptCompromise: true, concern: '', changeMind: '' };
    const samples: { kind: string; ms: number; status: number; error?: string }[] = [];
    const acknowledgedEntries: string[] = [];
    let next = 0, maxPending = 0, sampling = true;
    const monitor = (async () => {
      while (sampling) {
        const html = await (await request('/admin/health', { headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } })).text();
        maxPending = Math.max(maxPending, Number(html.match(/pending\/active: <strong>(\d+)/)?.[1] ?? 0));
        await Bun.sleep(5);
      }
    })();
    const start = performance.now();
    await Promise.all(Array.from({ length: pool }, async () => {
      while (next < 48) {
        const index = next++;
        const kind = index % 2 ? 'journal' : 'votes';
        const begun = performance.now();
        try {
          const res = await request(`/api/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base.origin }, body: JSON.stringify(kind === 'votes' ? { votes: [vote] } : { text: `Synthetic benchmark journal ${index}: need reliable transit.` }) });
          const body = await res.json();
          samples.push({ kind, ms: performance.now() - begun, status: res.status });
          if (res.ok && kind === 'journal') acknowledgedEntries.push(body.id);
        } catch (error) { samples.push({ kind, ms: performance.now() - begun, status: 0, error: error instanceof Error ? error.name : 'unknown' }); }
      }
    }));
    const elapsedMs = performance.now() - start;
    sampling = false; await monitor;
    const stored = await Bun.file(process.env.DB_PATH!).json();
    assert.equal(samples.filter(s => s.status === 200).length, 48, JSON.stringify(samples));
    assert.equal(stored.entries.length, entries + 24);
    assert.deepEqual(stored.entries.slice(0, entries), db.entries, 'Original synthetic records changed');
    assert.ok(acknowledgedEntries.every(id => stored.entries.some((e: {id: string}) => e.id === id)), 'Acknowledged journal lost');
    assert.equal(Object.keys(stored.votesByVoter).length, 24);
    assert.ok(Object.values(stored.votesByVoter).every((votes: any) => JSON.stringify(votes['demo-housing']) === JSON.stringify(vote)), 'Acknowledged vote changed');
    const summary = (kind: string) => {
      const sorted = samples.filter(s => s.kind === kind).map(s => s.ms).sort((a,b) => a-b);
      const percentile = (p: number) => Number(sorted[Math.ceil(sorted.length * p) - 1]!.toFixed(2));
      return { count: sorted.length, p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99) };
    };
    console.log('BENCH_RESULT ' + JSON.stringify({ entries, pool, snapshotBytes: Bun.file(process.env.DB_PATH!).size, elapsedMs: Number(elapsedMs.toFixed(2)), requestsPerSecond: Number((48000 / elapsedMs).toFixed(2)), votes: summary('votes'), journal: summary('journal'), sampledMaxPendingWrites: maxPending, statuses: Object.fromEntries([...new Set(samples.map(s => s.status))].map(code => [code, samples.filter(s => s.status === code).length])), conflicts409: samples.filter(s => s.status === 409).length, clientErrors: samples.filter(s => s.status === 0).length, acknowledgedRecordsLost: 0, dbConnectionExhaustion: 'not applicable: JSON single writer; no pool' }));
  } finally {
    server?.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}
