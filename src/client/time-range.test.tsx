import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { OutcomeTimeline } from './OutcomeTimeline';
import { changeScale, DEFAULT_RANGE, panRange, rangeURL, readTimeRange, TIME_SCALES } from './time-range';
test('all scales preserve center and URL context, malformed ranges fall back and pan is bounded', () => {
  for (const scale of TIME_SCALES) {
    const range = { ...DEFAULT_RANGE, scale };
    const url = rangeURL('https://example.test/outcomes?proposal=x&topic=y#evidence', range);
    expect(readTimeRange(url.search)).toEqual(range);
    expect(url.searchParams.get('proposal')).toBe('x');
    expect(url.hash).toBe('#evidence');
    expect(changeScale(range, 1).center).toBe(range.center);
  }
  expect(readTimeRange('?timeScale=bad&timeCenter=Infinity')).toEqual(DEFAULT_RANGE);
  expect(changeScale({ ...DEFAULT_RANGE, scale: 'day' }, -1).scale).toBe('day');
  expect(changeScale({ ...DEFAULT_RANGE, scale: 'decade' }, 1).scale).toBe('decade');
  expect(panRange(DEFAULT_RANGE, 100000).center).toBe(Date.UTC(2100, 0, 1));
});
test('static loading and empty presentation retain evidence separation', () => {
  const html = renderToStaticMarkup(<OutcomeTimeline entries={[]} />);
  for (const label of ['Historical measurements', 'Planned milestones', 'Synthetic future projections', 'No historical measurements', 'Advisory exploration only']) expect(html).toContain(label);
  expect(renderToStaticMarkup(<OutcomeTimeline loading />)).toContain('Loading timeline');
});
test('isolated interactive timeline inputs and history', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-outcome-timeline.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS timeline');
});
