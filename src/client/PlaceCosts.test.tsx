import { test, expect } from 'bun:test';
test('static comparator preserves focus, selection, history, empty datasets and stale evidence with reduced motion', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-place-costs-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, err }).toEqual({ code: 0, err: '' }); expect(out).toContain('PASS place costs');
});
