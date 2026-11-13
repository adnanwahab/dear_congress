import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS, demoPayload } from '../engine/demo';
import { freshness, ProposalProvenance, sourceUrl } from './ProposalProvenance';

test('every stable sample keeps its source and shows publisher, jurisdiction and unknown freshness', () => {
  expect(DEMO_ITEMS).toHaveLength(12);
  for (const item of DEMO_ITEMS) {
    const html = renderToStaticMarkup(<ProposalProvenance item={item} />);
    expect(html).toContain('Sample scenario / not introduced bill');
    expect(html).toContain(`Scenario jurisdiction: ${item.jurisdiction}`);
    expect(html).toContain('Publisher:');
    expect(html).toContain('Source not available / not checked');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('does not establish the scenario');
    expect(sourceUrl(item)).toBe(item.sourceUrl);
    expect(item.background?.publisher).toBeTruthy();
  }
  const payload = demoPayload({ browser: { 'demo-housing': { stance: 1 } } }, 'browser', new Date('2026-11-13'));
  expect(payload.items[0]!.support).toBe(DEMO_ITEMS[0]!.support);
  expect(payload.items[0]!.background?.checkedAt).toBeNull();
});

test('missing, unsafe, stale and invalid references cannot acquire a current checked date', () => {
  const item = DEMO_ITEMS[0]!;
  const now = Date.parse('2026-11-13T12:00:00Z');
  for (const checkedAt of [null, 'nonsense', '2020-01-01', '2027-01-01', '2026-02-31']) {
    expect(freshness({ ...item, background: { ...item.background!, checkedAt } }, now)).toBe('Source not available / not checked');
  }
  expect(freshness({ ...item, background: { ...item.background!, checkedAt: '2026-11-12' } }, now)).toBe('Source checked 2026-11-12');
  for (const source of ['', 'javascript:alert(1)', 'https://user:password@example.com']) {
    const broken = { ...item, sourceUrl: source, background: undefined };
    const html = renderToStaticMarkup(<ProposalProvenance item={broken} />);
    expect(html).not.toContain('<a ');
    expect(html).toContain('Source not available');
  }
});

test('integrated workflow retains source provenance through API retry and all civic stages', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-provenance-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  for (const stage of ['published', 'feed', 'votes', 'draft']) expect(stdout).toContain(`PASS ${stage}:`);
});
