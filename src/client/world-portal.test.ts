import { expect, test } from 'bun:test';
test('portal retains source context and focus without network writes', () => {
  const result = Bun.spawnSync(['bun', 'scripts/verify-world-portal.tsx'], { cwd: process.cwd() });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
});
