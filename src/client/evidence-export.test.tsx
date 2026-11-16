import { expect, test } from 'bun:test';

test('evidence controls provide offline copy and failed download/print recovery', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-evidence-export-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS evidence export');
});
