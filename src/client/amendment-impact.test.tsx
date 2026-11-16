import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { impactCategories, impactExcerpt } from './amendment-impact';
import { AmendmentComparison } from './AmendmentEditor';

test('only explicit labeled statements receive exact line anchors, never inferred impacts', () => {
  const text = 'The program costs $10 million.\nCost: Unknown pending assessment\nEligibility: Residents\nCost: \n  Cost: <script>bad()</script>';
  expect(impactExcerpt(text, 'Cost')).toEqual([{line: 2, quote: 'Cost: Unknown pending assessment'}, {line: 5, quote: '  Cost: <script>bad()</script>'}]);
  expect(impactExcerpt(text, 'Scope')).toEqual([]);
  const html = renderToStaticMarkup(<AmendmentComparison before={text} after="Eligibility: All residents" beforeId="revision-a" afterId="revision-b" />);
  for (const category of impactCategories) expect(html).toContain(`${category} · Needs review`);
  expect(html).toContain('revision-a · line 2');
  expect(html).toContain('revision-b · line 1');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('No effect inferred');
  expect(html).toContain('not verified civic participation');
});
