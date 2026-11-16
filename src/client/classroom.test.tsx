import { test, expect } from 'bun:test';
import { renderPage } from '../server/pages';
test('classroom has a direct anonymous lesson route', async () => {
  const response = renderPage('<html><head><title>App</title></head><body><div id="root"></div></body></html>', '/classroom', []);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Fictional classroom lesson');
});
test('standalone App lesson opens and simulates without API, stream or storage writes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-classroom-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS classroom');
});
