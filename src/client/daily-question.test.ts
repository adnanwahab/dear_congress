import { expect, test } from 'bun:test';
test('daily question reuses saved choices without issuing writes', async () => {
  const process = Bun.spawn([Bun.which('bun')!, 'scripts/verify-daily-question.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()]);
  expect({ code, err }).toEqual({ code: 0, err: '' });
  expect(out).toContain('Daily question:');
});
