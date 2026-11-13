import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkflowScreen from './WorkflowScreen';
import { PageSkeleton } from './LoadingSkeleton';
import type { Stage } from '../shared/civic-stages';
import { CIVIC_STAGES } from '../shared/civic-stages';

test('every navigation stage reserves cards while data is pending without actionable votes', () => {
  const previous = globalThis.window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '', pathname: '/votes' } } });
  try {
    for (const stage of CIVIC_STAGES) {
      const html = renderToStaticMarkup(<WorkflowScreen stage={stage.route.slice(1) as Stage} request={() => new Promise(() => {})} />);
      expect(html).toContain(`data-skeleton-stage="${stage.route.slice(1)}"`);
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain('Loading sample proposals…');
      expect(html).not.toContain('aria-pressed=');
    }
  } finally { Object.defineProperty(globalThis, 'window', { configurable: true, value: previous }); }
});

test('code loading uses route-specific layouts, including national outline before county module arrives', () => {
  for (const stage of CIVIC_STAGES) {
    expect(renderToStaticMarkup(<PageSkeleton path={stage.route} />)).toContain(`data-skeleton-stage="${stage.route.slice(1)}"`);
  }
  const map = renderToStaticMarkup(<PageSkeleton path="/map" />);
  expect(map).toContain('national-outline');
  expect(map).toContain('pathLength="1"');
  expect(map).toContain('county-workspace');
  expect(map).not.toContain('county-shape');
  expect(renderToStaticMarkup(<PageSkeleton path="/journal" />)).toContain('journal-grid');
});

test('reduced motion disables all loading motion and outline and county arrival animate only paint', async () => {
  const css = await Bun.file(new URL('./loading-skeleton.css', import.meta.url)).text();
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  expect(reduced).toContain('animation: none; display: none');
  expect(reduced).toContain('stroke-dashoffset: 0');
  expect(reduced).toContain('.county-shape { animation: none; }');
  expect(css).toContain('from { fill-opacity: 0; }');
});
