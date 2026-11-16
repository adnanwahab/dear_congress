import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CivicFestival } from './CivicFestival';
import { DEMO_ITEMS, type DemoPayload } from '../engine/demo';

const render = (data: DemoPayload | null, failed = false) => renderToStaticMarkup(<CivicFestival data={data} failed={failed} retry={() => {}} />);
test('learning remains available during loading, failure and an empty sample feed', () => {
  expect(render(null)).toContain('Loading the sample walkthrough');
  const failed = render(null, true);
  expect(failed).toContain('role="alert"');
  expect(failed).toContain('Retry walkthrough');
  expect(failed).toContain('Reveal the answer');
  expect(render({ items: [] } as unknown as DemoPayload)).toContain('No sample proposal is available');
});
test('sessions preserve sample identity and separate official, hypothetical and advisory activity', () => {
  const html = render({ items: [DEMO_ITEMS[0]] } as unknown as DemoPayload);
  expect(html).toContain('/feed?proposal=demo-housing');
  expect(html).toContain('Fictional sample:');
  expect(html).toContain('https://www.loc.gov/events/');
  expect(html).toContain('Hypothetical gathering');
  expect(html).toContain('Public event discussion is unavailable');
  expect(html).toContain('no rewards for ideology, real votes');
  expect(html).not.toContain('<form');
  expect(html).not.toContain('/api/votes');
  expect(html.match(/<summary>/g)?.length).toBe(5);
});
