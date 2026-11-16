import { expect, test } from 'bun:test';
import { ServiceSLOs, SLO_WINDOW_MS, observeServiceHandler } from './service-slos';
import { createPublicSecurity, publicHandler } from './public-security';
import { createStatsHTTP } from './launch-stats-http';
import { LaunchStats } from './launch-stats';

test('10 minute nearest-rank p95, genuine 503s, blocked denominator and expiry', () => {
  let now = 0; const s = new ServiceSLOs(() => now);
  for (let n = 1; n <= 20; n++) s.response('POST /api/journal', n * 100, 200);
  s.response('POST /api/journal', 5000, 503, true);
  let row = s.snapshot().rows[0]!;
  expect(row.p95).toBe(1900); expect(row.count).toBe(20); expect(row.blocked).toBe(1); expect(row.failures).toBe(0);
  now = 1; s.response('POST /api/journal', 10, 503);
  expect(s.snapshot().rows[0]!.failures).toBe(1);
  now = SLO_WINDOW_MS;
  expect(s.snapshot().rows[0]!.count).toBe(1); expect(s.snapshot().complete).toBe(true);
  now++; expect(s.snapshot().rows).toEqual([]); expect(s.html()).toContain('No samples — unknown');
});
test('warmup, bounded overflow and blocked-only samples never imply compliance', () => {
  let now = 0; const s = new ServiceSLOs(() => now, 1);
  s.save('blocked'); s.save('failed');
  expect(s.snapshot().complete).toBe(false); expect(s.snapshot().rows[0]!.failureRate).toBeNull();
  expect(s.html()).toContain('Incomplete window');
  now = SLO_WINDOW_MS; expect(s.snapshot().complete).toBe(true);
});
test('actual paused submissions carry explicit classification; real server failures remain failures', async () => {
  const security = createPublicSecurity({ PUBLIC_SUBMISSIONS_ENABLED: '0' });
  let ran = false;
  const response = await publicHandler(security, '/api/journal', 'POST', new Request('https://local/api/journal', { method: 'POST' }), '127.0.0.1', () => { ran = true; return new Response(); });
  expect(ran).toBe(false); expect(response.status).toBe(503); expect(response.headers.get('x-service-outcome')).toBe('blocked');
});
test('save reports reject extra content, cross-origin and invalid reports without cookies', async () => {
  const stats = new LaunchStats(':memory:'); const s = new ServiceSLOs();
  const http = createStatsHTTP({ stats, token: 'secret', healthy: () => true, record: run => run(), operations: () => s.html() });
  const request = (body: unknown, origin = 'https://local') => new Request('https://local/api/save-outcome', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    expect((await http.saveOutcome(request({ outcome: 'failed' }, 'https://other'), 'peer', o => s.save(o))).status).toBe(403);
    expect((await http.saveOutcome(request({ outcome: 'failed', text: 'private' }), 'peer', o => s.save(o))).status).toBe(400);
    const result = await http.saveOutcome(request({ outcome: 'failed' }), 'peer', o => s.save(o));
    expect(result.status).toBe(204); expect(result.headers.get('set-cookie')).toBeNull();
    expect(s.snapshot().rows[0]!.failures).toBe(1);
    expect(http.admin(new Request('https://local/admin/stats')).status).toBe(401);
    expect(await http.admin(new Request('https://local/admin/stats', { headers: { authorization: 'Bearer secret' } })).text()).toContain('Service SLOs');
  } finally { stats.close(); }
});

test('handler observation retains responses and errors even when recording fails', async () => {
  const s = new ServiceSLOs(); const response = new Response('saved');
  expect(await observeServiceHandler(s, '/api/votes', () => response)()).toBe(response);
  const error = new Error('server failure');
  await expect(observeServiceHandler(s, '/api/votes', () => { throw error; })()).rejects.toBe(error);
  expect(s.snapshot().rows[0]!.failures).toBe(1);
  s.response = () => { throw Error('collector failed'); };
  expect(await observeServiceHandler(s, '/api/votes', () => response)()).toBe(response);
  await expect(observeServiceHandler(s, '/api/votes', () => { throw error; })()).rejects.toBe(error);
});
