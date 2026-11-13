import { expect, test } from 'bun:test';
import { verifyRelease } from './verify-release';
const sha = 'a'.repeat(40);
function fixture(commit = sha, pageCommit = sha, status = 200) {
  return (async (url: URL) => url.pathname === '/version'
    ? Response.json({ commit, builtAt: '2026-11-13T12:00:00.000Z' }, { status })
    : new Response(`<footer data-build-commit="${pageCommit}"></footer>`)) as typeof fetch;
}
test('release smoke accepts intended SHA and rejects drift, stale pages and failed API', async () => {
  await verifyRelease('https://example.test', sha, fixture());
  await expect(verifyRelease('https://example.test', sha, fixture('b'.repeat(40)))).rejects.toThrow('Deployed SHA');
  await expect(verifyRelease('https://example.test', sha, fixture(sha, 'b'.repeat(40)))).rejects.toThrow('Page and server');
  await expect(verifyRelease('https://example.test', sha, fixture(sha, sha, 503))).rejects.toThrow();
  await expect(verifyRelease('https://example.test', 'short', fixture())).rejects.toThrow();
  // The same verifier checks a restored older image against its older intended SHA.
  await verifyRelease('https://example.test', 'b'.repeat(40), fixture('b'.repeat(40), 'b'.repeat(40)));
});
