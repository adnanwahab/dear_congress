import { expect, test } from 'bun:test';
import { CIVIC_STAGES, stageRoute } from './civic-stages';
import { pageTitle } from './page-metadata';

test('six stages have ordered unique routes and consistent document titles', () => {
  expect(CIVIC_STAGES.map(s => s.title)).toEqual(['Published', 'Feed', 'Votes', 'Draft', 'Sponsors', 'Outcomes']);
  expect(CIVIC_STAGES.map(s => s.n)).toEqual([1,2,3,4,5,6]);
  expect(new Set(CIVIC_STAGES.map(s => s.route)).size).toBe(6);
  for (const s of CIVIC_STAGES) {
    expect(pageTitle(s.route)).toBe(`${s.title} | Civic Synthesis`);
    const url = new URL(stageRoute(s.next, 'proposal /?&雪'), 'https://example.com');
    expect(url.searchParams.get('proposal')).toBe('proposal /?&雪');
    expect(CIVIC_STAGES.some(next => next.route === url.pathname)).toBe(true);
  }
});
