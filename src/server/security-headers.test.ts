import { expect, test } from 'bun:test';
import { CSP, embedCsp, securityHeaders } from './public-security';

test('partner framing changes only ancestors, retaining the exact script hash and resource allowlists', () => {
  for (const ancestors of ["'self'", "'self' https://partner.example", '*', "'none'"]) {
    const policy = embedCsp(ancestors);
    expect(policy.replace(`frame-ancestors ${ancestors}`, "frame-ancestors 'self'")).toBe(CSP);
    expect(policy.match(/script-src ([^;]+)/)?.[1]).not.toContain("'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' https://happybearlandia.fly.dev");
    expect(policy).toContain("object-src 'none'");
  }
  for (const value of ['', "'self'; script-src 'unsafe-inline'", "'self'\r\nX-Test: yes"]) {
    expect(() => embedCsp(value)).toThrow();
  }
});

test('security wrapper preserves status, source redirects, cookies and bodies without forcing cross-origin isolation', async () => {
  const response = securityHeaders(new Response('source intact', { status: 302, headers: {
    location: 'https://www.congress.gov/', 'set-cookie': 'test=value; Secure', 'cache-control': 'no-store',
  } }));
  expect(response.status).toBe(302);
  expect(await response.text()).toBe('source intact');
  expect(response.headers.get('location')).toBe('https://www.congress.gov/');
  expect(response.headers.get('set-cookie')).toBe('test=value; Secure');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('cross-origin-opener-policy')).toBeNull();
  expect(response.headers.get('cross-origin-embedder-policy')).toBeNull();
  expect(response.headers.get('x-frame-options')).toBeNull();
});
