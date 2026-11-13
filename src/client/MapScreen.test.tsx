import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import MapScreen from './MapScreen';
import { CountyCountMethodology, modeledCountyPercent } from './CountyCountMethodology';

test('map separates modeled coverage and support from unavailable verified participation', () => {
  const html = renderToStaticMarkup(<MapScreen />);
  expect(html).toContain('counties in geographic dataset');
  expect(html).toContain('Real verified county participation: unavailable');
  expect(html).toContain('Real county support and its measured denominator are also unavailable');
  expect(html).toContain('Before evaluation, zero agreements means no scenarios have been evaluated, not dissent.');
  expect(html).toContain('Synthetic scenario status legend');
  expect(html).toContain('Data origin');
  expect(html).toContain('not representative or legally binding');
  expect(html).not.toContain('counties participating');
  expect(html).not.toContain('Every county votes');
  const titles = [...html.matchAll(/<title>(.*?)<\/title>/g)].map(match => match[1]!);
  expect(titles).toHaveLength(3144);
  expect(titles.every(title => title.includes('Not evaluated') && title.includes('no resident ballots'))).toBe(true);
  expect(html).not.toContain('Real data</button>');
});

test('map methodology defines its population and never invents survey or real participation estimates', () => {
  const html = renderToStaticMarkup(<MapScreen />);
  expect(html).toContain('<summary>How is agreement calculated?</summary>');
  expect(html).toContain('Revision 1: 0 / 3,144 county models');
  expect(html).toContain('3,144 / 3,144 bundled shapes');
  expect(html).toContain('territories are excluded');
  expect(html).toContain('Nonresponse is unknown');
  expect(html).toContain('not collected by this map');
  expect(html).toContain('No real observations are added');
  expect(html).toContain('withholding of small groups before publication');
  expect(html).toContain('design effects cannot be estimated');
  expect(html).not.toContain('95%');
  expect(modeledCountyPercent(1, 4)).toBe('25.0%');
  expect(modeledCountyPercent(0, 4)).toBe('0.0%');
  expect(modeledCountyPercent(0, 0)).toBe('No county models');
  const empty = renderToStaticMarkup(<CountyCountMethodology supported={0} total={0} revision={1} />);
  expect(empty).toContain('No county models');
  expect(empty).not.toContain('NaN');
  expect(empty).not.toContain('0.0%');
});

test('integrated map counts stay scoped to the current revision and all bundled models', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-county-counts-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS county counts:');
});
