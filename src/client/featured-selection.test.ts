import { expect, test } from 'bun:test';
test('featured proposal identity survives browsing, reload and history through advisory vote', async () => {
  const result = Bun.spawn([process.execPath, 'scripts/verify-featured-selection.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([result.exited, new Response(result.stdout).text(), new Response(result.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Featured selection:');
});
