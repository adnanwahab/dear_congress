import { expect, test } from 'bun:test';
test('curiosity mission supports read-only exploration and recovery', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-curiosity-mission.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, err }).toEqual({ code: 0, err: '' });
  expect(out).toContain('Curiosity mission:');
});
