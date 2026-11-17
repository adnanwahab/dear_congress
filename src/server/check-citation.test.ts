import { expect, test } from 'bun:test';
import { checkCitation } from './check-citation';
import { citationAvailability } from '../shared/citation-availability';
const item = { id: 'demo-test', sourceUrl: 'https://example.org/context' };
const now = new Date('2026-11-17T12:00:00Z');
test('records HTTP outcomes without following redirects or verifying substance', async () => {
  for (const status of [200, 301, 302, 404, 403, 500, 503]) {
    const request = (async (_url: unknown, init: RequestInit) => {
      expect(init.redirect).toBe('manual'); expect(init.credentials).toBe('omit');
      return new Response(null, { status });
    });
    const check = await checkCitation(item, 'Test operator', request, now);
    expect(check.status).toBe(status);
    expect(Object.keys(check).sort()).toEqual(['attemptedAt', 'itemId', 'operator', 'reason', 'status', 'url']);
    const text = citationAvailability(item, [check], now.getTime())!;
    expect(text).toContain(`HTTP ${status}`); expect(text).toContain(now.toISOString());
    if (status >= 300 && status < 400) expect(text).toContain('destination not checked');
    if (status >= 400) expect(text).toContain('Unavailable');
    expect(citationAvailability(item, [check], now.getTime() + 31 * 86400000)).toContain('Stale check');
    expect(citationAvailability({ ...item, id: 'other' }, [check])).toBeNull();
    expect(citationAvailability({ ...item, sourceUrl: 'https://example.org/changed' }, [check])).toBeNull();
  }
});
test('network failure retains uncertainty and attempted date; bad metadata fails closed', async () => {
  const check = await checkCitation(item, 'Operator', (async () => { throw Error('timeout'); }), now);
  expect(check.status).toBeNull();
  expect(citationAvailability(item, [check], now.getTime())).toContain('Network error or timeout');
  for (const attemptedAt of ['bad', '2027-01-01']) expect(citationAvailability(item, [{ ...check, attemptedAt }], now.getTime())).toContain('invalid');
  await expect(checkCitation(item, '')).rejects.toThrow();
  await expect(checkCitation({ ...item, sourceUrl: 'http://localhost' }, 'Operator')).rejects.toThrow();
});
