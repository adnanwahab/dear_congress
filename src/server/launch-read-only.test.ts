import { test, expect } from 'bun:test';
import { launchReadOnly, pausedWrite, readOnlyShell, READ_ONLY_NOTICE } from './launch-read-only';

test('owner configuration defaults off and fails closed for invalid values', () => {
  for (const value of [undefined, '', '0', ' false ']) expect(launchReadOnly(value)).toBe(false);
  for (const value of ['1', 'true', 'typo']) expect(launchReadOnly(value)).toBe(true);
});
test('all mutation methods are rejected before the supplied handler can run', async () => {
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    const req = new Request('http://localhost/api/journal', { method, body: 'invalid json' });
    const res = pausedWrite(req, true)!;
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('retry-after')).toBe('60');
    expect((await res.json()).code).toBe('writes_paused');
    expect(req.bodyUsed).toBe(false);
    expect(pausedWrite(req, false)).toBeUndefined();
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS']) expect(pausedWrite(new Request('http://localhost', { method }), true)).toBeUndefined();
});
test('notice lives outside React root and preserves sample labels and source links', () => {
  const shell = '<body><div id="root"></div><a href="https://www.congress.gov">Fictional sample source</a></body>';
  const paused = readOnlyShell(shell, true);
  expect(paused).toContain(READ_ONLY_NOTICE);
  expect(paused).toContain('role="status"');
  expect(paused).toContain('<a href="https://www.congress.gov">Fictional sample source</a>');
  expect(readOnlyShell(shell, false)).toBe(shell);
});
