import { expect, test } from 'bun:test';
import { auditLinks, missingTargets, sourceTargets } from './link-audit';

test('crawler discovers internal links, reports soft 404s and never expands external sources', async () => {
  const calls: string[] = [];
  const request = (async (input: string | URL | Request, options?: RequestInit) => {
    const url = String(input); calls.push(url);
    expect(options?.redirect).toBe('manual');
    expect(options?.method).toBeUndefined();
    const path = new URL(url).pathname;
    if (path === '/') return new Response('<a href="/broken">bad</a><a href="https://unreviewed.example/">skip</a><a href="/feed?private=value">skip query</a>', { headers: { 'content-type': 'text/html' } });
    if (path === '/broken') return new Response('', { status: 404 });
    if (missingTargets.includes(path)) return new Response('', { status: path.startsWith('/live/') ? 200 : 404 });
    return new Response('<a href="https://unreviewed.example/expanded">skip</a>');
  }) as typeof fetch;
  const report = await auditLinks('https://site.example', request, async () => {});
  expect(report.failed).toBe(true);
  expect(report.results.find(r => r.url.endsWith('/broken'))).toMatchObject({ owner: '/', problem: 'unexpected-status' });
  expect(report.results.find(r => r.url.endsWith('/live/00000000'))?.problem).toBe('unexpected-200');
  expect(calls.filter(u => !u.startsWith('https://site.example'))).toEqual(sourceTargets.map(t => t.url));
  expect(calls.some(u => u.includes('?'))).toBe(false);
});

test('network failures and redirects remain visible review findings', async () => {
  const request = (async (input: string | URL | Request) => {
    if (String(input).endsWith('/')) throw new Error('not retained');
    return new Response('', { status: 302, headers: { location: 'https://unreviewed.example' } });
  }) as typeof fetch;
  const report = await auditLinks('https://site.example', request, async () => {});
  expect(report.failed).toBe(true);
  expect(report.results.some(r => r.problem === 'network-or-timeout')).toBe(true);
  expect(report.results.some(r => r.problem === 'redirect-review')).toBe(true);
  expect(JSON.stringify(report)).not.toContain('not retained');
});
