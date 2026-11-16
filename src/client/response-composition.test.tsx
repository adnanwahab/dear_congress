import { expect, test } from 'bun:test';
import { composition, compositionReport, CASES } from '../shared/response-composition';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResponseComposition } from './ResponseComposition';

test('self-selection changes percentages without changing group preferences; empty denominator is unknown', () => {
  expect(composition([1, 1]).percentages).toEqual(['50.0%', '35.0%', '15.0%']);
  expect(composition([3, 1]).percentages).toEqual(['65.0%', '22.5%', '12.5%']);
  expect(composition([0, 0]).percentages.every(p => p.includes('Undefined'))).toBe(true);
  for (const weights of [[NaN, 1], [-1, 1], [6, 1], [1]]) expect(() => composition(weights)).toThrow();
});
test('every exported case retains provenance and limitations without inventing missing sources', () => {
  for (const c of CASES) {
    const report = JSON.parse(compositionReport([1, 1], c.id, []));
    expect(report.case.source).toBe(c.source);
    expect(report.review).toBe('pending human review');
    expect(report.authored).toBe('2026-11-14');
    expect(report.limitations).toContain('not public opinion');
  }
  const html = renderToStaticMarkup(<ResponseComposition />);
  for (const text of ['Primary source:', 'Editorial inference', 'synthetic estimate', 'Missing-source case', 'readOnly', 'aria-live="polite"']) expect(html.toLowerCase()).toContain(text.toLowerCase());
});
test('interactive controls, loading/offline independence and export/print failure fallbacks', async () => {
  const proc = Bun.spawn([process.execPath, 'scripts/verify-response-composition.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  expect(err).toBe(''); expect(out).toContain('PASS'); expect(code).toBe(0);
});
