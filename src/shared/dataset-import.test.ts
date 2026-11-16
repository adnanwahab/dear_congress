import { expect, test } from 'bun:test';
import { acceptImport, IMPORT_EXAMPLES, parseCsv, validateImport } from './dataset-import';
const good = { ...IMPORT_EXAMPLES['Sourced specimen']!, retrieved: '2026-11-14' };
test('citation-complete specimen passes structural checks; conflicts and missing sources fail closed', () => {
  expect(validateImport(good).errors).toEqual([]);
  expect(validateImport(IMPORT_EXAMPLES['Conflicting specimen']!).errors.join(' ')).toContain('conflicts');
  expect(validateImport(IMPORT_EXAMPLES['Missing-source specimen']!).errors.join(' ')).toContain('HTTPS source');
  for (const kind of ['editorial inference', 'user claim', 'synthetic estimate'] as const)
    expect(validateImport({ ...good, kind }).errors.join(' ')).toContain('Only primary-source');
});
test('CSV accepts quoted commas/newlines and rejects ambiguous, oversized or malformed schemas', () => {
  expect(parseCsv('a,b\r\n"one,two","three\nfour"')).toEqual([['a','b'],['one,two','three\nfour']]);
  for (const csv of ['a,a\n1,2', 'a,b\n1', 'a,b\n"open,2', 'a,b\n"x"junk,2', 'a,b\n1,2"', 'x'.repeat(100001)]) expect(() => parseCsv(csv)).toThrow();
});
test('invalid numeric/date/mapping/scope/license/provenance blocks acceptance', () => {
  const patches = [{ source: 'javascript:alert(1)' }, { licenseUrl: 'http://example.com' }, { retrieved: '2026-02-30' }, { retrieved: '2999-01-01' }, { version: '' }, { limitations: '' }, { mapping: { ...good.mapping, value: 'unit' } }, { csv: good.csv.replace('331449281', 'NaN') }, { csv: good.csv.replace('2020-04-01', '2020-02-30') }, { expectedScope: 'Different population' }, { expectedUnit: '%' }, { csv: good.csv + '\n331449282,2020-04-01,persons,United States resident population' }];
  for (const patch of patches) { const draft = { ...good, ...patch }; expect(validateImport(draft).errors.length).toBeGreaterThan(0); expect(() => acceptImport(draft, 'Reviewer', true)).toThrow(); }
});
test('review requires explicit human attestation and snapshots exact metadata without publishing', () => {
  expect(() => acceptImport(good, '', true)).toThrow(); expect(() => acceptImport(good, 'Reviewer', false)).toThrow();
  const draft = structuredClone(good); const packet = acceptImport(draft, 'Reviewer', true);
  draft.csv = 'changed'; expect(packet.draft.csv).toBe(good.csv); expect(packet.published).toBe(false);
  expect(packet.repository).toBe('adnanwahab/dear_congress');
});
