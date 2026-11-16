// Local serial microbenchmark only. Synthetic archive; no HTTP listener or network access.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refreshBill, readBills } from '../src/server/legislation/import';
import { createPublicReadCache } from '../src/server/public-read-cache';
import { createPublicSecurity, publicHandler } from '../src/server/public-security';
const root = await mkdtemp(join(tmpdir(), 'SHE-926-cache-'));
try {
  const raw = JSON.stringify({ bill: { congress: 119, type: 'HR', number: '123', originChamber: 'House', title: 'Synthetic benchmark bill', introducedDate: '2025-01-03', sponsors: [], latestAction: { actionDate: '2025-01-03', text: 'Synthetic introduction' } } });
  await refreshBill(root, 119, 'hr', 123, 'local-fixture-only', async () => new Response(raw));
  const rows = [];
  for (const mode of ['before', 'validate', 'short'] as const) {
    let reads = 0, bytes = 0, notModified = 0, failures = 0, etag = '';
    const times: number[] = [];
    const cache = createPublicReadCache(mode === 'before' ? 'off' : mode);
    const security = createPublicSecurity({});
    for (let i = 0; i < 100; i++) {
      const req = new Request('https://local/api/legislation', { headers: etag ? { 'if-none-match': etag } : {} });
      const produce = async () => { reads++; return Response.json({ bills: await readBills(root), coverage: 'metadata-only' }); };
      const start = performance.now();
      const res = mode === 'before'
        ? await publicHandler(security, '/api/legislation', 'GET', req, 'local', produce)
        : await cache.respond(req, produce);
      bytes += (await res.arrayBuffer()).byteLength;
      times.push(performance.now() - start);
      if (res.status === 304) notModified++;
      if (![200, 304].includes(res.status)) failures++;
      etag = res.headers.get('etag') ?? '';
    }
    times.sort((a, b) => a - b);
    rows.push({ mode, requests: 100, archiveReads: reads, responseBodyBytes: bytes, notModified, failures, medianMs: +times[50]!.toFixed(3), p95Ms: +times[95]!.toFixed(3) });
  }
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), scope: 'serial in-process synthetic archive, warm OS cache, no network; short run <15 seconds', rows }, null, 2));
} finally { await rm(root, { recursive: true, force: true }); }
