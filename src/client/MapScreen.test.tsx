import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import MapScreen from './MapScreen';

test('map separates modeled coverage and support from unavailable verified participation', () => {
  const html = renderToStaticMarkup(<MapScreen />);
  expect(html).toContain('county shapes modeled · 100% of bundled shapes');
  expect(html).toContain('Real verified county participation: unavailable');
  expect(html).toContain('Real county support and its measured denominator are also unavailable');
  expect(html).toContain('Initial support is 0/3,144; no resident ballots are counted');
  expect(html).toContain('Illustrative model status legend');
  expect(html).toContain('Data origin');
  expect(html).toContain('not representative or legally binding');
  expect(html).not.toContain('counties participating');
  expect(html).not.toContain('Every county votes');
  const titles = [...html.matchAll(/<title>(.*?)<\/title>/g)].map(match => match[1]!);
  expect(titles).toHaveLength(3144);
  expect(titles.every(title => title.includes('Model requests changes') && title.includes('no resident ballots'))).toBe(true);
  expect(html).not.toContain('Real data</button>');
});
