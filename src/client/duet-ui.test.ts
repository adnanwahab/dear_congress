import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
test('private duet provenance and isolation walkthrough', () => {
  const result = Bun.spawnSync([process.execPath, 'scripts/verify-duet-ui.tsx'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env }, stdout: 'pipe', stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  expect(new TextDecoder().decode(result.stdout)).toContain('PASS duet provenance');
  expect(result.exitCode).toBe(0);
});
