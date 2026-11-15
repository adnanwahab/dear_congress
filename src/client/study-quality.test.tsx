import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudyQualityMatrix } from './StudyQualityMatrix';
import { STUDY_EVIDENCE, sortStudies, evidenceExport } from '../shared/study-evidence';
test('all sorts preserve source identities and pending review without mutating records', () => {
  const before = JSON.stringify(STUDY_EVIDENCE);
  for (const key of ['case', 'kind', 'design', 'sample', 'jurisdiction', 'outcome', 'date', 'limitations', 'conflicts'] as const) {
    const ascending = sortStudies(STUDY_EVIDENCE, key);
    expect(sortStudies(STUDY_EVIDENCE, key, true).map(r => r.id)).toEqual(ascending.map(r => r.id).reverse());
    expect(new Set(ascending.map(r => r.id)).size).toBe(4);
  }
  expect(JSON.stringify(STUDY_EVIDENCE)).toBe(before);
  const exported = JSON.parse(evidenceExport(STUDY_EVIDENCE));
  expect(exported.records).toEqual(STUDY_EVIDENCE);
  expect(exported.records.every((r: any) => r.history[0].reviewer === null)).toBe(true);
});
test('semantic matrix retains source, missing, conflicting and synthetic distinctions', () => {
  const html = renderToStaticMarkup(<StudyQualityMatrix />);
  for (const label of ['Primary source', 'Editorial inference', 'User claim', 'Synthetic estimate', 'No external source supplied', 'Pending human review', 'Conflicting interpretation', 'Limitations', 'Conflict disclosures', 'Available offline once loaded', 'aria-sort="ascending"', 'scope="row"', 'tabindex="0"']) expect(html).toContain(label);
});
test('sorting and export failures work independently of remote data', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-study-quality.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, err }).toEqual({ code: 0, err: '' });
  expect(out).toContain('PASS');
});
