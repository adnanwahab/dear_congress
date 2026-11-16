import { expect, test } from 'bun:test';

test('detective practice reveals source and reasoning without civic writes and respects scope', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-fact-check-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS: all classifications');
});
