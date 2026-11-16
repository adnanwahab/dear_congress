import { expect, spyOn, test } from 'bun:test';
import { withRequestLogContext, logPrivateEvent } from './private-logs';
import { createCitizenProposalHandlers } from './citizen-proposals';
import { mapAttempt } from '../client/optional-map';

const canaries = ['CANARY_JOURNAL_private_draft', 'CANARY_browser_vote_token', 'https://secret.example/CANARY_path?key=CANARY_query#CANARY_fragment'];

test('concurrent exception traces correlate responses without exception fields or identifiers', async () => {
  const logs: unknown[][] = [];
  const error = spyOn(console, 'error').mockImplementation((...args) => { logs.push(args); });
  const info = spyOn(console, 'log').mockImplementation((...args) => { logs.push(args); });
  try {
    const responses = await Promise.all(canaries.map(async secret => withRequestLogContext(async () => {
      logPrivateEvent(secret, { text: secret, referer: secret, remote: secret });
      await Promise.resolve();
      const exception = new Error(secret); exception.name = secret;
      throw exception;
    })));
    const ids = responses.map(r => r.headers.get('x-request-id'));
    expect(new Set(ids).size).toBe(canaries.length);
    for (const [i, response] of responses.entries()) {
      expect(response.status).toBe(500);
      expect(ids[i]).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.stringify(logs)).toContain(ids[i]!);
    }
    for (const secret of canaries) expect(JSON.stringify(logs)).not.toContain(secret);
  } finally { error.mockRestore(); info.mockRestore(); }
});

test('actual proposal persistence exception omits raw error and retains request correlation', async () => {
  const logs: unknown[][] = [];
  const error = spyOn(console, 'error').mockImplementation((...args) => { logs.push(args); });
  try {
    const handlers = createCitizenProposalHandlers({ getStore: () => { throw new Error(canaries.join(' ')); }, save: async () => {} });
    const response = await withRequestLogContext(() => handlers.list(new Request('http://localhost/?secret='+canaries[1])));
    expect(response.status).toBe(500);
    expect(JSON.stringify(logs)).toContain(response.headers.get('x-request-id')!);
    for (const secret of canaries) expect(JSON.stringify(logs)).not.toContain(secret);
  } finally { error.mockRestore(); }
});

test('client map trace drops unexpected runtime error input', () => {
  const logs: unknown[][] = [];
  const warn = spyOn(console, 'warn').mockImplementation((...args) => { logs.push(args); });
  try {
    for (const secret of canaries) mapAttempt(() => {}).fail(secret as 'resource');
    expect(logs).toHaveLength(canaries.length);
    for (const secret of canaries) expect(JSON.stringify(logs)).not.toContain(secret);
  } finally { warn.mockRestore(); }
});

test('publication label parser and submitted IDs never reach the trace sink', async () => {
  const { publishLabelsPost, publishLabelsOptions } = await import('./publish-labels');
  const { emptyDB } = await import('../engine/engine');
  const logs: unknown[][] = [];
  const info = spyOn(console, 'log').mockImplementation((...args) => { logs.push(args); });
  const deps = { db: emptyDB(), save: async () => {}, normalizeNeedIds: () => ({ submitted: canaries, valid: [], ignored: canaries }), logPublishEvent: logPrivateEvent, publishCorsHeaders: () => ({}) };
  try {
    for (const secret of canaries) {
      const headers = { referer: secret, 'fly-client-ip': secret, origin: secret, 'content-type': secret };
      publishLabelsOptions(new Request('http://localhost/', { method: 'OPTIONS', headers }), deps);
      for (const body of [secret, JSON.stringify({ entryId: secret, labels: canaries })]) {
        const response = await publishLabelsPost(new Request('http://localhost/', { method: 'POST', headers, body }), deps);
        expect(response.status).toBe(400);
      }
    }
    for (const secret of canaries) expect(JSON.stringify(logs)).not.toContain(secret);
  } finally { info.mockRestore(); }
});

test('request wrapper preserves redirect, stream and configured embed headers', async () => {
  const redirected = await withRequestLogContext(() => Response.redirect('https://example.test/'));
  expect(redirected.status).toBe(302);
  expect(redirected.headers.get('location')).toBe('https://example.test/');
  const streamed = await withRequestLogContext(() => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('event')); c.close(); } }), { headers: { 'content-security-policy': "frame-ancestors https://embed.example" } }));
  expect(streamed.headers.get('content-security-policy')).toBe('frame-ancestors https://embed.example');
  expect(await streamed.text()).toBe('event');
});
