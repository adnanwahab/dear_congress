import { expect, test } from 'bun:test';
import counties from './data/counties.json';
import { countyVote, improvePlan, INITIAL_PLAN, requirements } from './county-simulation';
test('every modeled county has unique FIPS and drawable geography', () => {
  expect(counties).toHaveLength(3144);
  expect(new Set(counties.map(c => c.id)).size).toBe(counties.length);
  expect(counties.every(c => c.path.startsWith('M'))).toBe(true);
  expect(counties.some(c => c.state === 'AK')).toBe(true);
  expect(counties.some(c => c.state === 'HI')).toBe(true);
});
test('revisions resolve objections for every county, with no forced unanimous vote', () => {
  const ids = counties.map(c => c.id);
  let plan = [...INITIAL_PLAN];
  expect(ids.every(id => countyVote(id, plan).status === 'object')).toBe(true);
  let previous = 0;
  for (let i = 0; i < 9; i++) {
    plan = improvePlan(plan, ids);
    const agree = ids.filter(id => countyVote(id, plan).status === 'agree').length;
    expect(agree).toBeGreaterThanOrEqual(previous);
    previous = agree;
  }
  expect(previous).toBe(counties.length);
  expect(ids.every(id => requirements(id).every((need, i) => plan[i]! >= need))).toBe(true);
  expect(improvePlan(plan, ids)).toEqual(plan);
});

test('unevaluated or missing scenario inputs never become dissent or agreement', () => {
  expect(countyVote('48201', INITIAL_PLAN, false).status).toBe('unevaluated');
  expect(countyVote('', INITIAL_PLAN).status).toBe('unevaluated');
  expect(countyVote('48201', []).status).toBe('unevaluated');
  expect(countyVote('48201', [NaN, 100, 100, 100]).status).toBe('unevaluated');
  expect(countyVote('48201', [0, 0, 0, 0]).status).toBe('object');
  expect(countyVote('48201', [100, 100, 100, 100]).status).toBe('agree');
});
