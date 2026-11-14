import { expect, test } from 'bun:test';
import { filterProposals, proposalCardStyle, ProposalSearch } from './ProposalSearch';
import { DEMO_ITEMS } from '../engine/demo';
import { renderToStaticMarkup } from 'react-dom/server';

test('search scope, topic intersection, literal matching and empty payload', () => {
  const item = { ...DEMO_ITEMS[0]!, title: 'A [literal] proposal', summary: '<script>Example</script>', source: 'Unique publisher', jurisdiction: 'Test county' };
  const items = [item, { ...item, id: 'other', topic: 'Other', title: 'Other', summary: '', source: '', jurisdiction: '' }];
  for (const q of ['[LITERAL]', '<script>', ' unique publisher ', 'TEST COUNTY']) expect(filterProposals(items, q, 'All topics')).toEqual([item]);
  expect(filterProposals(items, 'proposal', 'Other')).toEqual([]);
  expect(filterProposals(items, '', 'All topics')).toHaveLength(2);
  expect(filterProposals([], '', 'All topics')).toEqual([]);
  const props = { items, query: 'no match', topic: 'All topics', setQuery() {}, setTopic() {}, loaded: true };
  expect(renderToStaticMarkup(<ProposalSearch {...props} />)).toContain('Showing 0 of 2 proposals');
  expect(renderToStaticMarkup(<ProposalSearch {...props} />)).toContain('Reset filters');
  expect(renderToStaticMarkup(<ProposalSearch {...props} loaded={false} />)).not.toContain('Reset filters');
  expect(renderToStaticMarkup(<ProposalSearch {...props} loaded={false} failed />)).toContain('Sample proposals unavailable');
});

test('integrated home, feed and published filtering handles debounce, interruption and reduced motion', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-proposal-search-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS home:'); expect(stdout).toContain('PASS feed:');
});

test('card names encode punctuation, Unicode and scope without title-name collisions', () => {
  const ids = ['a:b', 'a-b', 'a b', 'é', '😀', ''];
  const names = ids.flatMap(id => ['home', 'workflow'].map(scope => proposalCardStyle(scope, id).viewTransitionName!));
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(name).toMatch(/^proposal-card-[a-f0-9-]+$/);
});
