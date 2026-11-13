import { expect, test } from 'bun:test';

test('deep-linked civic stages recover and preserve proposal context', async () => {
  const result = Bun.spawn([process.execPath, 'scripts/verify-stage-states.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([result.exited, new Response(result.stdout).text(), new Response(result.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Stage states:');
});
