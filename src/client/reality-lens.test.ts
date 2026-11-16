import { expect, test } from 'bun:test';

test('shared reality lens preserves route data and browser preferences', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-reality-lens.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Reality lens:');
});
