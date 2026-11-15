import { expect, test } from 'bun:test';
import { explainAssembly } from './amendment-jigsaw';

test('both geographic choices allow coherent clauses without ideological scoring', () => {
  expect(explainAssembly({ scope: 0, eligibility: 0, authority: 0, funding: 0, date: 0 }).complete).toBe(true);
  expect(explainAssembly({ scope: 1, eligibility: 1, authority: 1, funding: 1, date: 1 }).complete).toBe(true);
});
test('missing slots and geographic, authority and timing conflicts explain repair', () => {
  expect(explainAssembly({}).missing).toHaveLength(5);
  const result = explainAssembly({ scope: 1, eligibility: 0, authority: 0, funding: 1, date: 0 });
  expect(result.complete).toBe(false);
  expect(result.conflicts).toHaveLength(3);
  expect(result.conflicts.join(' ')).toContain('funding is available');
});
