import { test, expect } from 'bun:test';
test('causal domino interaction remains hypothetical and isolated', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-causal-domino-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS domino:');
});
