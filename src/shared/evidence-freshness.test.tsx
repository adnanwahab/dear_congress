import { expect, test } from 'bun:test';
import { CALENDAR_EVIDENCE, EVIDENCE_CASES, dateValue, evidenceExport, reviewDue, reviewWarning, safeEvidenceUrl } from './evidence-freshness';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvidenceCalendar } from '../client/EvidenceCalendar';

test('review boundaries never determine truth and invalid dates stay unknown', () => {
  const row = EVIDENCE_CASES[0]!;
  expect(reviewDue(row)).toBe('2026-12-14');
  expect(reviewWarning(row, '2026-12-06')).toBe('Review scheduled');
  expect(reviewWarning(row, '2026-12-07')).toBe('Review due within 7 days');
  expect(reviewWarning(row, '2026-12-14')).toBe('Review due within 7 days');
  expect(reviewWarning(row, '2026-12-15')).toBe('Review overdue');
  expect(reviewWarning(row, '2026-11-01')).toBe('Review date unknown');
  for (const value of ['2026-02-31', '2026-13-01', '', '2026-1-1']) expect(dateValue(value)).toBeNull();
  expect(reviewDue({ ...row, reviewDays: NaN })).toBeNull();
  expect(reviewWarning(EVIDENCE_CASES[2]!, '2026-11-14')).toBe('Review date unknown');
});

test('exports retain identity, dates, limitations and pending review without manufacturing dates', () => {
  const result = JSON.parse(evidenceExport(CALENDAR_EVIDENCE, '2026-11-14'));
  expect(result.evidence).toHaveLength(CALENDAR_EVIDENCE.length);
  expect(result.evidence[0].review[0].state).toBe('Pending human review');
  expect(result.evidence[2].retrieved).toBeNull();
  expect(result.evidence[3].sourceId).toBe('demo-housing');
  expect(result.evidence[3].published).toBeNull();
  expect(result.evidence.every((r: any) => r.limitations && r.sourceId)).toBe(true);
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.org', 'http://example.org']) expect(safeEvidenceUrl(url)).toBeNull();
});

test('agenda and ledger provide source kinds, dates, status and network-independent fallbacks', () => {
  for (const state of ['ready', 'loading', 'offline', 'error'] as const) {
    const html = renderToStaticMarkup(<EvidenceCalendar asOf="2026-11-14" state={state} />);
    for (const text of ['Primary source', 'Editorial inference', 'User claim', 'Synthetic estimate', 'Calendar agenda', 'Source missing or unavailable', 'Unknown', 'browser’s Print', 'Review overdue']) expect(html).toContain(text);
    expect(html).toContain('type="month"');
    expect(html).not.toContain('Human reviewed');
  }
});

test('DOM interactions support month selection, touch-sized native controls and copy/print fallbacks', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-evidence-calendar-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS');
});
