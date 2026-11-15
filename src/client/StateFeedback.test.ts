import { expect, test } from 'bun:test';

test('semantic feedback dictionary and isolated DOM transitions', async () => {
  const run = Bun.spawn([process.execPath, 'test', './scripts/verify-state-feedback.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([run.exited, new Response(run.stdout).text(), new Response(run.stderr).text()]);
  expect({ code, output: code ? stdout + stderr : '' }).toEqual({ code: 0, output: '' });
});
