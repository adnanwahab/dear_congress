import { expect, test } from 'bun:test';
import { installErrorReporting } from './error-reporting';

test('browser diagnostics omit secrets, suppress referrers/cookies and bound volume', () => {
  const callbacks = new Map<string, () => void>();
  const requests: RequestInit[] = [];
  const browser = {
    location: { pathname: '/topics/private-politics', search: '?journal=secret', hash: '#identity' },
    addEventListener: (name: string, callback: () => void) => callbacks.set(name, callback),
    fetch: (url: string, init: RequestInit) => { expect(url).toBe('/api/error-report'); requests.push(init); return Promise.resolve(new Response()); },
  };
  installErrorReporting(browser as unknown as Window, 'a'.repeat(40));
  callbacks.get('error')!();
  callbacks.get('unhandledrejection')!();
  for (let i = 0; i < 20; i++) callbacks.get('error')!();
  expect(requests).toHaveLength(10);
  expect(JSON.parse(String(requests[0]!.body))).toEqual({ buildSha: 'a'.repeat(40), routeTemplate: '/topics/:id', category: 'error' });
  expect(JSON.stringify(requests)).not.toMatch(/private-politics|journal|secret|identity/);
  for (const request of requests) {
    expect(request.credentials).toBe('omit');
    expect(request.referrerPolicy).toBe('no-referrer');
  }
});
