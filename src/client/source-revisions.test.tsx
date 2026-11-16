import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceRevisionAlert } from './SourceRevisionAlert';
import { SYNTHETIC_METRICS } from '../shared/policy-measurements';
test('initial loading is announced and correction disabled until hashes exist', () => {
  const html = renderToStaticMarkup(<SourceRevisionAlert sourceId="wait" measurement={SYNTHETIC_METRICS[0]!.history[1]!} />);
  expect(html).toContain('role="status"');
  expect(html).toContain('Preparing local snapshot hashes');
  expect(html).toContain('disabled');
  expect(html).toContain('synthetic demonstration');
});
test('local offline correction keeps published claim and copyable snapshot history', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-source-revisions.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS local correction');
});
