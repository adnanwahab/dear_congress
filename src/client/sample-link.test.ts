import { expect, test } from 'bun:test';
test('sample link native, copy, cancel, denial and manual recovery preserve privacy', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-sample-link.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Sample link interactions passed');
});
