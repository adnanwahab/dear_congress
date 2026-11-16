import { expect, test } from 'bun:test';
import { MutationError } from './mutation-status';
import { writeFailure, retryDeadline } from './write-failure';
test('timeout, HTTP throttling, server failure and transport errors have distinct copy', () => {
  expect(writeFailure(Error(), true)).toContain('timed out');
  expect(writeFailure(new MutationError('', 429, '60'))).toContain('Too many requests');
  expect(writeFailure(new MutationError('', 503, null))).toContain('5xx');
  expect(writeFailure(new TypeError())).toContain('network error');
  expect(retryDeadline(new MutationError('', 429, '60'))).toBeGreaterThan(Date.now() + 59000);
});
