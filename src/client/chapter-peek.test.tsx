import { expect, test } from 'bun:test';
test('chapter peek keeps preview, navigation and submissions separate across input modes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-chapter-peek-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS chapter peek:');
});
