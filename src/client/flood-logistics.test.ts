import { expect, test } from 'bun:test';
test('flood exercise resource limits, outcomes and participation isolation', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-flood-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS flood');
});
