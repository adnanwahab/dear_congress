import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DATA_GAPS, exportGaps, filterGaps } from '../shared/data-gaps';
import { DataGapsAtlas } from './DataGapsAtlas';

test('research cases retain evidence class, dates, limitations and pending review in exports', () => {
  const exported = JSON.parse(exportGaps(DATA_GAPS));
  expect(exported.records).toEqual(DATA_GAPS);
  expect(new Set(DATA_GAPS.flatMap(r => r.claims.map(c => c.kind))).size).toBe(4);
  for (const row of DATA_GAPS) {
    expect(row.history.at(-1)?.review).toBe('Pending human review');
    expect(row.question.endsWith('?') || row.question.includes('?')).toBe(true);
    for (const claim of row.claims) { expect(claim.period).toBeTruthy(); expect(claim.limitations).toBeTruthy(); }
  }
  expect(DATA_GAPS[0]!.claims[0]!.source!.url).toContain('/2023/acs/acs1/groups/B08303');
  expect(DATA_GAPS[2]!.claims[0]!.observedAt).toBeNull();
});
test('combined filters never replace missing cases with zero or imply comprehensive coverage', () => {
  const filters = { jurisdiction: 'Harris County, Texas', topic: 'Accessibility', category: 'Missing source', query: 'step-free' };
  expect(filterGaps(DATA_GAPS, filters).map(r => r.id)).toEqual(['step-free-missing']);
  expect(filterGaps(DATA_GAPS, { ...filters, query: 'not present' })).toEqual([]);
  const html = renderToStaticMarkup(<DataGapsAtlas />);
  for (const text of ['never good outcomes', 'not a comprehensive', 'None registered', 'Fictional', 'Source inspected', 'Export text and print fallback', 'Pending human review']) expect(html).toContain(text);
  expect(html).not.toContain('role="grid"'); // Native controls and document reading order, no custom keyboard grid.
});
test('atlas stays available during loading/offline and filters/export fallback work', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-data-gaps.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' }); expect(stdout).toContain('PASS loading');
});
