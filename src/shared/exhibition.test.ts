import { expect, test } from 'bun:test';
import { billCollection } from './bill-catalog';
import { exhibitDocument, PANEL_ROLES, readExhibit } from './exhibition';
const bill = billCollection.bills[0]!;
const exhibit = { version: 1 as const, panels: PANEL_ROLES.map(role => ({ role, id: bill.id, revision: bill.revision })) };
test('exhibit pins every role and catalog revision and rejects stale/empty/foreign sources', () => {
  expect(readExhibit(JSON.stringify(exhibit))).toEqual(exhibit);
  for (const value of [null, '{}', '{', JSON.stringify({ ...exhibit, panels: [] }), JSON.stringify({ ...exhibit, panels: exhibit.panels.map(p => ({ ...p, revision: 'stale' })) }), JSON.stringify({ ...exhibit, panels: exhibit.panels.map(p => ({ ...p, id: 'official-1' })) }), JSON.stringify({ ...exhibit, panels: exhibit.panels.map(p => ({ ...p, role: 'question' })) })]) expect(readExhibit(value)).toBeNull();
});
test('portable static embed preserves claims, labels, sources and native navigation without active content', () => {
  const html = exhibitDocument(exhibit, 'https://example.org');
  expect(html).toContain('Hypothetical');
  expect(html).toContain('Evidence not yet assessed');
  expect(html).toContain('no measured results');
  expect(html).toContain(`https://example.org/bills/${bill.id}`);
  expect(html).toContain(bill.revision);
  expect(html).toContain('tabindex="0"');
  expect(html).toContain('href="#results"');
  expect(html).not.toMatch(/<script|<form|<iframe|animation|fetch\(/);
  expect(() => exhibitDocument(exhibit, 'javascript:alert(1)')).toThrow();
});
test('exhibition DOM covers checks, selection, history, empty search, focus and static rendering', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-exhibition-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
});
