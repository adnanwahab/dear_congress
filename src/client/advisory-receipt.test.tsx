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

test('plain-text receipt allowlists public fields and requires stance opt-in', () => {
  const draft = { proposalId: 'sample & one', title: 'Sample proposal', revision: 'text-12345678', stance: 1, cookieId: 'SECRET_COOKIE', journal: 'PRIVATE_JOURNAL' };
  for (const stance of [-1, 0, 1]) {
    const input = { ...draft, stance };
    const text = advisoryReceiptText(input);
    expect(text).toContain('Viewed text revision: text-12345678');
    expect(text).toContain('Options viewed: Support; Oppose; Not sure.');
    expect(text).toContain('not an official ballot');
    expect(text).toContain('https://civic-synthesis.fly.dev/votes?proposal=sample%20%26%20one');
    expect(text).not.toContain('Server confirmed advisory choice:');
    expect(text).not.toContain('SECRET_COOKIE');
    expect(text).not.toContain('PRIVATE_JOURNAL');
    expect(advisoryReceiptText(input, true)).toContain(`Server confirmed advisory choice: ${stance === 1 ? 'Support' : stance === -1 ? 'Oppose' : 'Not sure'}`);
  }
  expect(advisoryReceiptText({ ...draft, revision: undefined })).toContain('unavailable (earlier saved choice)');
});
