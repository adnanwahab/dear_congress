import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { compareClaims, claimUrl, compassExport, COMPASS_CASES } from '../shared/claim-provenance';
import { ContradictionCompass } from './ContradictionCompass';
const a = COMPASS_CASES[1].claims[0];
test('compares all four explicit fields without selecting truth or crossing scope', () => {
  for (const field of ['date', 'definition', 'status', 'reported value'] as const) {
    expect(compareClaims([{ ...a, fields: { [field]: 'a' } }, { ...a, id: 'b', fields: { [field]: 'b' } }]).conflicts).toEqual([field]);
  }
  expect(compareClaims([a, { ...a, scope: 'other' }]).status).toContain('Not comparable');
  expect(compareClaims([a, { ...a, period: 'other' }]).status).toContain('Not comparable');
  expect(compareClaims([a, { ...a, kind: 'user claim' }]).status).toBe('Missing source');
  expect(compareClaims([a, a]).conflicts).toEqual([]);
  expect(compareClaims([a, { ...a, fields: {} }]).conflicts).toEqual([]);
});
test('missing and unsafe links remain missing; export retains both exact revisions', () => {
  const original = JSON.stringify(COMPASS_CASES);
  expect(compareClaims(COMPASS_CASES[2].claims).status).toBe('Missing source');
  for (const url of ['javascript:alert(1)', 'https://user:secret@example.com', 'bad']) expect(claimUrl({ ...a, url })).toBeNull();
  const exported = JSON.parse(compassExport(COMPASS_CASES[1].claims));
  expect(exported.claims).toEqual(COMPASS_CASES[1].claims);
  expect(exported.assessment.conflicts).toEqual(['status', 'reported value']);
  expect(JSON.stringify(COMPASS_CASES)).toBe(original);
});
test('static offline and print fallback includes sources, dates, review, and native controls', () => {
  const html = renderToStaticMarkup(<ContradictionCompass />);
  for (const text of ['Source supplied', 'Conflict — human review needed', 'Missing source', 'pending human review', '2026-11-14', 'Limitations:', 'Copyable export / print fallback', 'External links require connectivity', 'Revision and human-review history', 'Editorial inference']) expect(html).toContain(text);
  expect(html).toContain('<summary>');
  expect(html).toContain('<button');
  expect(html).toContain('https://www.senate.gov/civics/constitution_item/constitution.htm');
});


test('DOM interactions preserve offline text and handle export failure', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-compass-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS compass interactions');
});
