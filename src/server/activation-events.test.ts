import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LaunchStats, observePublicResponse, statsPage } from './launch-stats';
import { createStatsHTTP } from './launch-stats-http';

test('aggregate activation persists separately, rolls over Chicago day, and renders limitations', () => {
  const dir = mkdtempSync(join(tmpdir(), 'activation-'));
  let now = Date.parse('2026-11-16T05:59:59Z');
  let stats = new LaunchStats(join(dir, 'stats.sqlite'), () => now);
  try {
    stats.activation('argument_opened'); stats.activation('argument_opened');
    stats.close(); stats = new LaunchStats(join(dir, 'stats.sqlite'), () => now);
    expect(stats.snapshot().activation.argument_opened).toBe(2);
    expect(stats.snapshot().votes).toBe(0);
    const html = statsPage(stats.snapshot(), true);
    for (const text of ['not unique people or first sessions', 'Self-selection and bots', 'not proven reading or comprehension', 'does not prove sharing or meaningful participation']) expect(html).toContain(text);
    now += 1000;
    expect(stats.snapshot().activation.argument_opened).toBe(0);
  } finally { stats.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('browser ingestion permits only fixed browser events, enforces origin and bounds without cookies', async () => {
  const stats = new LaunchStats(':memory:');
  const http = createStatsHTTP({ stats, token: '', healthy: () => true, record: run => run() });
  const send = (body: string, origin = 'https://local', method = 'POST') => http.activation(new Request('https://local/api/activation-event', { method, headers: { origin, 'content-type': 'application/json' }, ...(method === 'POST' ? { body } : {}) }), '127.0.0.1');
  try {
    for (const event of ['proposal_read', 'argument_opened', 'share_opened']) {
      const response = await send(JSON.stringify({ event }));
      expect(response.status).toBe(204);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    for (const body of ['{}', 'null', '{', 'x'.repeat(1025), '{"event":"choice_saved"}', '{"event":"landing"}', '{"event":"unknown"}', '{"event":"share_opened","identity":"private"}']) expect((await send(body)).status).toBe(400);
    expect((await send('{"event":"share_opened"}', 'https://evil.test')).status).toBe(403);
    expect((await send('', 'https://local', 'GET')).status).toBe(405);
    expect(stats.snapshot().activation).toMatchObject({ proposal_read: 1, argument_opened: 1, share_opened: 1, choice_saved: 0 });
    for (let i = 0; i < 120; i++) await send('{"event":"share_opened"}');
    expect((await send('{"event":"share_opened"}')).status).toBe(429);
  } finally { stats.close(); }
});

test('landing uses existing page view and choice events require accepted responses, excluding repository ballots', async () => {
  const stats = new LaunchStats(':memory:');
  const http = createStatsHTTP({ stats, token: '', healthy: () => true, record: run => run() });
  const observe = (path: string, body: unknown, result: unknown, status = 200) => observePublicResponse(stats, new Request(`https://local${path}`, { method: 'POST', headers: { 'x-voter-id': 'private-voter' }, body: JSON.stringify(body) }), Response.json(result, { status }), () => { throw Error('unexpected recording failure'); });
  try {
    await http.pageView(new Request('https://local/api/page-view', { method: 'POST', headers: { origin: 'https://local' }, body: '{"path":"/"}' }), '127.0.0.1');
    await observe('/api/votes', { votes: [{ proposalId: 'sample' }], withdrawVotes: ['other'], goalVotes: { goal: true }, allocation: { need: 10 } }, { ok: true });
    await observe('/api/votes', { votes: [{ proposalId: 'sample' }] }, { ok: true });
    await observe('/api/votes', { votes: [{ proposalId: 'sample' }] }, {}, 400);
    await observe('/api/citizen-proposals/citizen/vote', { choice: null }, { proposal: { id: 'citizen', ownVote: null } });
    await observe('/api/citizen-proposals/citizen/vote', { choice: 'support' }, { proposal: { id: 'citizen', ownVote: 'support' } });
    await observe('/api/hbl/vote', {}, { ok: true });
    expect(stats.snapshot().activation).toEqual({ landing: 1, proposal_read: 0, argument_opened: 0, choice_saved: 3, choice_withdrawn: 2, share_opened: 0 });
  } finally { stats.close(); }
});
