import { expect, test } from 'bun:test';
import { changelog } from './changelog';
import { buildIdentity } from './build-identity';

const request = new Request('https://example.test/changelog');
test('release history distinguishes unknown and mismatched previews from documented releases', async () => {
  for (const commit of [null, 'b'.repeat(40)]) {
    const response = changelog(request, { ...buildIdentity, commit });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    const html = await response.text();
    expect(html).toContain('does not match');
    expect(html).toContain('Operational incident status remains unknown');
    expect(html).toContain('datetime="2026-11-14"');
    expect(html).toContain('795c6944dc4055499562d674b98db9837d8f1db9');
    expect(html).toContain('src/client/bill-catalog.css');
    expect(html).toContain('Hosted results'.toLowerCase());
    expect(html).toContain('do not establish government action');
    expect(html).not.toContain('<script');
  }
});
test('exact source match is qualified and HEAD has no body', async () => {
  const html = await changelog(request, { ...buildIdentity, commit: '795c6944dc4055499562d674b98db9837d8f1db9' }).text();
  expect(html).toContain('matches the documented release commit');
  expect(html).toContain('not a live reliability check');
  expect(await changelog(new Request(request, { method: 'HEAD' })).text()).toBe('');
});
