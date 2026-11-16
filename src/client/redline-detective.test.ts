import { expect, test } from 'bun:test';

test('detective reveals source-bound feedback only after a guess and keeps fixtures isolated', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-redline-detective-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS detective guesses');
});
