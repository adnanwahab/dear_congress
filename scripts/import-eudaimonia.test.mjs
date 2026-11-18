import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parseCollection } from './import-eudaimonia.mjs';
const source = await readFile(new URL('../content/bill-collections/eudaimonia-100.md', import.meta.url), 'utf8');
const generated = JSON.parse(await readFile(new URL('../src/generated/eudaimonia-100.json', import.meta.url), 'utf8'));
test('complete deterministic catalog, stable revisions and exact category ranges', () => {
  const data = parseCollection(source);
  expect(data).toEqual(generated);
  expect(parseCollection(source)).toEqual(data);
  expect(data.bills).toHaveLength(110);
  expect(data.categories).toHaveLength(11);
  for (let i = 0; i < 110; i++) {
    expect(data.bills[i].id).toBe(`HFL-${String(i+1).padStart(3,'0')}`);
    expect(data.bills[i].category).toBe(data.categories[Math.floor(i/10)]);
    expect(data.bills[i].revision).toMatch(/^[a-f0-9]{64}$/);
  }
  expect(data.bills[100]?.title).toBe('Global Water and Sanitation Compact');
  expect(data.bills[109]?.title).toBe('Peaceful Conflict Prevention and Displacement Protection Act');
  expect(data.bills[37]?.title).toBe('Civic Reasoning and Media Literacy Act');
  expect(data.bills[70]?.proposedChange).toContain('paper-backed');
  expect(data.bills[89]?.proposedChange).toContain('independent validation');
  expect(data.bills.slice(100).every(b => b.category === 'Global cooperation and future institutions')).toBe(true);
  const edited = parseCollection(source.replace('Eligible people miss benefits', 'Some eligible people miss benefits'));
  expect(edited.bills[0].revision).not.toBe(data.bills[0].revision);
  expect(edited.bills.slice(1)).toEqual(data.bills.slice(1));
});
for (const [name, transform] of [
  ['wrong category assignment', s => s.replace('## Housing and livable cities', '## Wrong category')],
  ['missing record', s => s.replace(/### HFL-110:[\s\S]*?(?=## Appendix)/, '')],
  ['duplicate ID', s => s.replace('### HFL-110:', '### HFL-109:')],
  ['duplicate title', s => s.replace('Future Generations Protection Act', 'Automatic Benefits Enrollment Act')],
  ['missing field', s => s.replace('* **Jurisdiction:** federal\n', '')],
  ['duplicate field', s => s.replace('* **Jurisdiction:** federal', '* **Jurisdiction:** federal\n* **Jurisdiction:** federal')],
  ['unknown field', s => s.replace('**Problem:**', '**Unknown:**')],
  ['invalid jurisdiction', s => s.replace('**Jurisdiction:** federal', '**Jurisdiction:** worldwide')],
  ['hostile HTML', s => s.replace('Eligible people', '<script>alert(1)</script>Eligible people')],
  ['hostile link', s => s.replace('Eligible people', '[click](javascript:alert(1)) Eligible people')],
  ['inline code', s => s.replace('Eligible people', '`alert(1)` Eligible people')],
  ['entity markup', s => s.replace('Eligible people', '&#60;script&#62; Eligible people')],
  ['length overflow', s => s.replace('Eligible people', 'a'.repeat(2001))],
  ['metadata policy change', s => s.replace('votes: advisory_only', 'votes: binding')],
  ['unexpected record text', s => s.replace('### HFL-002:', 'not a field\n### HFL-002:')],
]) test(`reject ${name}`, () => expect(() => parseCollection(transform(source))).toThrow());
