import { expect, test } from 'bun:test';
import { evidenceUpdateUrl } from './evidence-conditions';

test('private condition editing, citation failure recovery and scope isolation', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-evidence-conditions.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS private evidence cards');
});
test('evidence links reject unsafe schemes, credentials and relative URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', '/relative', 'https://user:secret@example.org', 'not a URL']) expect(evidenceUpdateUrl(value)).toBeNull();
  expect(evidenceUpdateUrl('https://example.org/report#table4')).toBe('https://example.org/report#table4');
});
