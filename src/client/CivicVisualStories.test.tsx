import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CivicVisualStories } from './CivicVisualStories';

test('landing exposes seven visual stories with an honest frequency caveat', () => {
  const html = renderToStaticMarkup(<CivicVisualStories />);
  expect(html).toContain('Everyone has something');
  expect(html).toContain('1,461 chances');
  expect(html).toContain('not measured outcomes'.toUpperCase());
  expect(html).toContain('More check-ins do not automatically produce more learning.');
  expect(html).toContain('Human review required');
  expect(html).toContain('A luminous consensus network');
  expect(html).toContain('An inspectable decision history');
});

test('only the selected interactive frame loads and it is sandboxed', () => {
  const html = renderToStaticMarkup(<CivicVisualStories />);
  expect((html.match(/<iframe/g) ?? []).length).toBe(1);
  expect(html).toContain('src="/visual-lab/latency"');
  expect(html).toContain('sandbox="allow-scripts"');
  expect(html).not.toContain('allow-same-origin');
  expect(html).toContain('referrerPolicy="no-referrer"');
});
