import { expect, test } from 'bun:test';
import { eventState, type CivicEvent } from '../shared/civic-events';
const now = Date.parse('2026-11-17T12:00:00Z');
const event: CivicEvent = { id: 'test-only', title: 'Hypothetical hearing fixture', institution: 'Fixture institution', committee: 'Fixture committee', date: '2026-11-18T12:00:00Z', status: 'confirmed', source: { url: 'https://example.org/fixture', publisher: 'Hypothetical source', checkedAt: '2026-11-17T10:00:00Z' }, topicIds: ['housing'], billIds: ['HFL-001'] };
test('only fresh sourced future dates are confirmed; failures remain explicit', () => {
  expect(eventState(event, now)).toBe('Confirmed');
  expect(eventState(event, now + 86400001)).toBe('Expired');
  expect(eventState({ ...event, date: '2026-12-01T12:00:00Z' }, now + 86400001)).toBe('Stale evidence');
  expect(eventState({ ...event, status: 'canceled' }, now)).toBe('Canceled');
  expect(eventState({ ...event, status: 'unverified' }, now)).toBe('Unverified');
  for (const url of ['javascript:alert(1)', 'https://user:password@example.org', 'bad']) expect(eventState({ ...event, source: { ...event.source, url } }, now)).toBe('Unverified');
  expect(eventState({ ...event, source: { ...event.source, checkedAt: '2026-11-19T12:00:00Z' } }, now)).toBe('Unverified');
});
test('selection, focus, static mode, empty state and history are read-only', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-civic-constellation.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
});
test('reduced motion hides ring and retains the equivalent semantic list', async () => {
  const css = await Bun.file('src/client/civic-constellation.css').text();
  expect(css).toContain('@media (prefers-reduced-motion: reduce) { .civic-orbit { display: none; } }');
  expect(css).not.toMatch(/animation\s*:|transition\s*:/);
});
