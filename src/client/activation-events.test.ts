import { expect, test } from 'bun:test';
test('browser interactions send only fixed anonymous events and survive delivery failures', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-activation-events.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Activation browser events verified');
});
