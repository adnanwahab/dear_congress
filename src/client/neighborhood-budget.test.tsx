import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NeighborhoodBudget } from './NeighborhoodBudget';
import { coveredBlocks, place, spent } from './neighborhood-budget';

test('finite budget rejects overspending and refunds replacement without mutating prior allocations', () => {
  const first = place([], 0, 'hub').allocations;
  const full = place(first, 8, 'play').allocations;
  expect(spent(full)).toBe(100);
  expect(place(full, 4, 'shade').allocations).toBe(full);
  expect(place(full, 0, 'shade').allocations).toEqual([{ block: 8, project: 'play' }, { block: 0, project: 'shade' }]);
  expect(first).toEqual([{ block: 0, project: 'hub' }]);
  for (const block of [-1, 9, NaN, 0.5]) expect(place(full, block, 'shade').allocations).toBe(full);
  expect(place(full, 0, 'external-data').allocations).toBe(full);
});
test('coverage uses clipped Manhattan distance and deduplicates overlap', () => {
  expect(coveredBlocks([])).toEqual([]);
  expect(coveredBlocks([{ block: 0, project: 'shade' }])).toEqual([0, 1, 3]);
  expect(coveredBlocks([{ block: 4, project: 'hub' }])).toHaveLength(9);
  expect(coveredBlocks([{ block: 0, project: 'shade' }, { block: 1, project: 'play' }])).toEqual([0, 1, 2, 3, 4]);
});
test('demo has native placement alternatives, declared assumptions and no submission', () => {
  const html = renderToStaticMarkup(<NeighborhoodBudget />);
  expect(html).toContain('not actual addresses');
  expect(html).toContain('not measured users');
  expect(html).toContain('neighborhood-budget-v1');
  expect(html).toContain('Use vertical block list');
  expect(html).toContain('Nothing is submitted, funded or counted as verified civic participation');
  expect(html.match(/Place Shade trees at/g)).toHaveLength(9);
  expect(html).not.toContain('<form');
});
test('DOM placement, drop rejection, removal and clear use the same local ledger', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-neighborhood-budget.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
});
