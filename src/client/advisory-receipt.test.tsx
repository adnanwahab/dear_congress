import { expect, test } from 'bun:test';
import { advisoryReceiptText, sampleTextRevision } from './AdvisoryReceipt';
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

test('failed and withdrawn receipts retain the proposal and option without false save claims', () => {
  const draft = { proposalId: 'sample-one', title: 'Exact sample title', stance: 0 };
  const failed = advisoryReceiptText(draft, 'failed');
  expect(failed).toContain('Not sure');
  expect(failed).toContain('Exact sample title (sample-one)');
  expect(failed).toContain('Failed / outcome unknown');
  expect(failed).not.toContain('Server confirmed');
  expect(failed).toContain('acknowledgement: unknown');
  const withdrawn = advisoryReceiptText({ ...draft, withdraw: true }, 'confirmed', '2026-11-16T12:00:00.000Z');
  expect(withdrawn).toContain('Status: Withdrawn');
  expect(withdrawn).toContain('2026-11-16T12:00:00.000Z');
  expect(withdrawn).toContain('does not prove a unique person');
});
