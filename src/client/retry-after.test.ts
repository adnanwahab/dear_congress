import { expect, test } from 'bun:test';
import { MutationError, retryDeadline } from './mutation-status';

test('Retry-After parses seconds, HTTP dates and malformed/absent fallback deterministically', () => {
  const now = Date.UTC(2026, 10, 15);
  expect(retryDeadline(' 15 ', now)).toBe(now + 15000);
  expect(retryDeadline('0', now)).toBe(now);
  expect(retryDeadline(new Date(now + 90000).toUTCString(), now)).toBe(now + 90000);
  expect(retryDeadline(new Date(now - 1000).toUTCString(), now)).toBe(now);
  for (const value of [null, '', '-1', '1.5', 'tomorrow', '99999999999999999999999999']) {
    expect(retryDeadline(value, now)).toBe(now + 60000);
  }
  expect(new MutationError('raw upstream error', 429, '5').message).toContain('Too many requests. Try again after');
  expect(new MutationError('Forbidden', 403, null).message).toBe('Forbidden');
});
