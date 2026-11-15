import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { billCollection } from '../shared/bill-catalog';
import { billDependencies, dependencyStatus, type BillDependency } from '../shared/bill-dependencies';
import { BillSubway } from './BillSubway';
const [a, b] = billCollection.bills;
const edge: BillDependency = { id: 'test-only', prerequisite: a!.id, dependent: b!.id,
  prerequisiteRevision: a!.revision, dependentRevision: b!.revision, kind: 'funding',
  explanation: 'Hypothetical test fixture only.', source: { url: 'https://example.org/review', label: 'Test source', reviewedOn: '2026-11-01', reviewBy: '2026-12-01' } };
test('no dependencies inferred from catalog membership', () => expect(billDependencies).toEqual([]));
test('dependency evidence fails closed for changed revisions, expired reviews and invalid sources', () => {
  expect(dependencyStatus(edge, billCollection.bills, '2026-11-15')).toBe('reviewed');
  expect(dependencyStatus(edge, billCollection.bills, '2026-12-02')).toBe('stale');
  expect(dependencyStatus({ ...edge, dependentRevision: 'changed' }, billCollection.bills, '2026-11-15')).toBe('stale');
  for (const url of ['javascript:alert(1)', 'http://example.org', '/missing', 'https://user:pass@example.org']) {
    expect(dependencyStatus({ ...edge, source: { ...edge.source, url } }, billCollection.bills, '2026-11-15')).toBe('unavailable');
  }
  expect(dependencyStatus(edge, [], '2026-11-15')).toBe('unavailable');
  expect(dependencyStatus({ ...edge, source: { ...edge.source, reviewedOn: '2026-02-30' } }, billCollection.bills, '2026-11-15')).toBe('unavailable');
});
test('text graph shows source-backed direction and withholds stale claims', () => {
  const props = { bills: billCollection.bills, selected: a!.id, select: () => {}, params: new URLSearchParams('view=subway'), edges: [edge] };
  const html = renderToStaticMarkup(<BillSubway {...props} today="2026-11-15" />);
  expect(html).toContain('https://example.org/review');
  expect(html).toContain('Hypothetical test fixture only.');
  const stale = renderToStaticMarkup(<BillSubway {...props} today="2026-12-02" />);
  expect(stale).toContain('withheld');
  expect(stale).not.toContain('Hypothetical test fixture only.');
  expect(renderToStaticMarkup(<BillSubway {...props} bills={[]} />)).toContain('No stations match');
});
