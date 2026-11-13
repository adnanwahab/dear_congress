import { expect, test } from 'bun:test';
test('journal supports consent and removable manual categories without inference', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-journal-manual-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS manual journal');
});
