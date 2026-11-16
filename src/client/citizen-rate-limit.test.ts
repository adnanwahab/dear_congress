import { expect, test } from 'bun:test';
import { request } from './CitizenProposals';
import { MutationError } from './mutation-status';

test('citizen publish, advisory vote and comment preserve Retry-After even on non-JSON rejection', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('Busy proxy', { status: 429, headers: { 'Retry-After': '30' } }); }) as unknown as typeof fetch;
  try {
    for (const path of ['/api/citizen-proposals', '/api/citizen-proposals/example/vote', '/api/citizen-proposals/example/comments']) {
      try { await request(path, { text: 'Unsent text' }); throw new Error('Expected rejection'); }
      catch (error) {
        expect(error).toBeInstanceOf(MutationError);
        expect((error as MutationError).status).toBe(429);
        expect((error as MutationError).retryAfter).toBe('30');
        expect((error as Error).message).toContain('Try again after');
      }
    }
    expect(calls).toBe(3);
  } finally { globalThis.fetch = original; }
});
