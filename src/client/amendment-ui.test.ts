import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
test('amendment DOM walkthrough and recovered route integration', () => {
  const result = Bun.spawnSync([process.execPath, 'scripts/verify-amendments-ui.tsx'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env }, stdout: 'pipe', stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  expect(new TextDecoder().decode(result.stdout)).toContain('PASS amendment creation');
  expect(result.exitCode).toBe(0);
});
