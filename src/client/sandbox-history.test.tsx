import { expect, test } from 'bun:test';
import { DEFAULT_WEIGHTS } from '../engine/engine';
import { createSandboxHistory, recordSandbox, restoreSandbox } from './sandbox-history';
import { renderToStaticMarkup } from 'react-dom/server';
import { SandboxHistory } from './SandboxHistory';

test('immutable snapshots preserve sibling branches and deterministic restoration', () => {
  const input = { weights: { ...DEFAULT_WEIGHTS }, lambda: .25, budget: 40, packageId: 'A', publicPost: 'excluded' };
  const root = createSandboxHistory(input);
  input.weights.support = 0;
  expect(root.nodes[0]!.snapshot.weights.support).toBe(DEFAULT_WEIGHTS.support);
  expect(root.nodes[0]!.snapshot).not.toHaveProperty('publicPost');
  const first = recordSandbox(root, { ...root.nodes[0]!.snapshot, budget: 60 }, 'Budget');
  const second = recordSandbox(first, { ...first.nodes[1]!.snapshot, packageId: 'B' }, 'Filter');
  const branch = recordSandbox(restoreSandbox(second, 0), { ...root.nodes[0]!.snapshot, lambda: .5 }, 'Penalty');
  expect(branch.nodes.map(n => n.parent)).toEqual([null, 0, 1, 0]);
  expect(restoreSandbox(branch, 2).nodes[2]!.snapshot).toEqual(second.nodes[2]!.snapshot);
  expect(recordSandbox(branch, branch.nodes[3]!.snapshot, 'No change')).toBe(branch);
  expect(restoreSandbox(branch, 999)).toBe(branch);
  expect(Object.isFrozen(branch.nodes[3]!.snapshot.weights)).toBe(true);
  const html = renderToStaticMarkup(<SandboxHistory history={restoreSandbox(branch, 0)} restore={() => {}} />);
  expect(html).toContain('Choose a redo branch');
  expect(html).toContain('Restore step 1');
  expect(html).toContain('Restore step 3');
  expect(html).toContain('role="status"');
});
