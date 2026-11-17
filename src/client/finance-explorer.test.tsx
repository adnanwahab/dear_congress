import { expect, test } from 'bun:test';
test('finance UI preserves search focus, selection, text parity, history and source warnings without writes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-finance-explorer-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS finance explorer');
});
test('waterfall is static and reduced-motion explicitly disables effects', async () => {
  const css = await Bun.file('src/client/finance-explorer.css').text();
  expect(css).toContain('prefers-reduced-motion: reduce');
  expect(css).toContain('animation: none');
  expect(css).toContain('transition: none');
});
