import { expect, test } from 'bun:test';
import { verifyRelease } from './verify-release';
const sha = 'a'.repeat(40);
function fixture(broken = '', status = 200, body?: string) {
  return (async (url: URL, options: RequestInit) => {
    expect(options.redirect).toBe('error');
    expect(options.cache).toBe('no-store');
    if (url.pathname === broken) return new Response(body ?? 'private data must never be recorded', { status });
    if (url.pathname === '/version') return Response.json({ commit: sha, builtAt: '2026-11-13T12:00:00.000Z', environment: 'production', repository: 'https://github.com/adnanwahab/dear_congress' });
    if (url.pathname === '/privacy') return new Response('Delete an entry or withdraw a vote', { headers: { 'content-type': 'text/html' } });
    if (url.pathname === '/release-parity-unknown-route') return new Response('Not found', { status: 404 });
    return new Response(`<div id="root"></div><footer data-build-commit="${sha}"></footer>`, { headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;
}
test('parity accepts intended build and rejects stale identity, missing routes, stale shell and soft 404', async () => {
  expect((await verifyRelease('https://example.test', sha, fixture())).passed).toBe(true);
  expect((await verifyRelease('https://example.test', 'b'.repeat(40), fixture())).passed).toBe(false);
  for (const path of ['/privacy', '/account', '/version', '/']) {
    for (const status of [404, 503]) {
      const report = await verifyRelease('https://example.test', sha, fixture(path, status));
      expect(report.passed).toBe(false);
      expect(JSON.stringify(report)).not.toContain('private data');
    }
  }
  expect((await verifyRelease('https://example.test', sha, fixture('/account'))).passed).toBe(false);
  expect((await verifyRelease('https://example.test', sha, fixture('/release-parity-unknown-route'))).passed).toBe(false);
});
test('network failures are redacted and invalid inputs fail closed', async () => {
  const report = await verifyRelease('https://example.test', sha, (async () => { throw new Error('secret'); }) as typeof fetch);
  expect(report.passed).toBe(false);
  expect(JSON.stringify(report)).not.toContain('secret');
  await expect(verifyRelease('https://user:secret@example.test', sha, fixture())).rejects.toThrow();
  await expect(verifyRelease('https://example.test', 'short', fixture())).rejects.toThrow();
});
