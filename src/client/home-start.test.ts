import { expect, test } from 'bun:test';
test('home start remains actionable when demo loading fails and retains safe destination context', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-home-start.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Home start:');
});
