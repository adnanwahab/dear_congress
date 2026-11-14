import { expect, test } from 'bun:test';
test('active WorkflowScreen advisory feedback and reload recovery', async () => {
  const result = Bun.spawn([process.execPath, 'scripts/verify-advisory-feedback.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([result.exited, new Response(result.stdout).text(), new Response(result.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Advisory feedback:');
});
