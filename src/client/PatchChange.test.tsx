import { expect, test } from 'bun:test';

test('patch playback keeps final text, replays and respects motion preferences and proposal changes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-patch-change-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS replay');
});
