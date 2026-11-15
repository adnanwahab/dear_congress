import { expect, test } from 'bun:test';
import { sampleTextRevision } from './AdvisoryReceipt';
import { DEMO_ITEMS } from '../engine/demo';
test('viewed text identifier isolates proposal and text changes from tally changes', () => {
  const item = DEMO_ITEMS[0]!;
  expect(sampleTextRevision({ ...item, support: item.support + 1 })).toBe(sampleTextRevision(item));
  expect(sampleTextRevision({ ...item, proposedText: item.proposedText + ' revised' })).not.toBe(sampleTextRevision(item));
  expect(sampleTextRevision({ ...item, id: 'different' })).not.toBe(sampleTextRevision(item));
});
test('receipt integrated interaction states', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-advisory-receipt-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS receipt');
});
