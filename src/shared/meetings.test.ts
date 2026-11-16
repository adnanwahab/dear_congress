import { expect, test } from 'bun:test';
import { parseMeetings, meetingCalendar, meetingFreshness } from './meetings';
import { meetingsResponse } from '../server/meetings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const record = { id: 'test:123', title: 'Synthetic test notice', jurisdiction: 'Houston', topics: ['Transit'], organizer: 'Test organizer', verifiedBy: 'Test reviewer', sourceUrl: 'https://example.org/notice', checkedAt: '2026-11-14T12:00:00Z', startsAt: '2026-11-20T15:00:00-06:00', agenda: null };
test('snapshot rejects unreviewed, unsafe, duplicate and ambiguous-time records', () => {
  expect(parseMeetings([record])).toEqual([record]);
  for (const change of [{ verifiedBy: '' }, { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://example.org/\r\nBEGIN:VALARM' }, { startsAt: '2026-11-20' }, { checkedAt: 'bad' }, { agenda: { text: 'x', sourceUrl: 'http://example.org' } }]) expect(() => parseMeetings([{ ...record, ...change }])).toThrow();
  expect(() => parseMeetings([record, record])).toThrow();
});
test('unknown time never exports; freshness distinguishes old and future checks', () => {
  expect(() => meetingCalendar({ ...record, startsAt: null })).toThrow();
  expect(meetingFreshness(record, Date.parse('2026-11-15T12:00:00Z'))).toContain('stale');
  expect(meetingFreshness(record, 0)).toContain('unavailable');
});
test('calendar converts timezone, escapes injected content, folds UTF8 and requires reminder opt-in', () => {
  const m = { ...record, title: 'Town\nBEGIN:VALARM,;' + 'é'.repeat(100) };
  const plain = meetingCalendar(m);
  expect(plain).toContain('DTSTART:20261120T210000Z');
  expect(plain).not.toContain('\r\nBEGIN:VALARM');
  expect(plain).toContain('Town\\nBEGIN:VALARM\\,\\;');
  expect(meetingCalendar(record, true)).toContain('\r\nBEGIN:VALARM\r\n');
  for (const line of plain.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
});
test('read API is empty without configuration and fails closed on corrupt data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'meetings-'));
  try {
    const path = join(dir, 'snapshot.json');
    expect(await (await meetingsResponse(path)).json()).toEqual({ meetings: [] });
    await Bun.write(path, JSON.stringify([record]));
    const good = await meetingsResponse(path); expect(good.headers.get('cache-control')).toBe('no-store'); expect((await good.json()).meetings).toEqual([record]);
    await Bun.write(path, '{'); expect((await meetingsResponse(path)).status).toBe(503);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
