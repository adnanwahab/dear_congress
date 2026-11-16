import { expect, test } from 'bun:test';
test('optional evidence reads preserve control and handle unavailable states', async () => {
  const process = Bun.spawn([Bun.which('bun')!, 'scripts/verify-side-quest.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()]);
  expect({ code, err }).toEqual({ code: 0, err: '' });
  expect(out).toContain('Side quest:');
});
