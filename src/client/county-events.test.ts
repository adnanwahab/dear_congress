import { expect, test } from 'bun:test';
import { countyEvents } from './county-events';
import counties from './data/counties.json';
import { countyVote, improvePlan, INITIAL_PLAN } from './county-simulation';

test('logged events bind exact county identities and revisions to model status transitions', () => {
  expect(countyEvents(1)).toEqual([]);
  const events = countyEvents(10);
  expect(new Set(events.map(e => e.id)).size).toBe(events.length);
  let plan = [...INITIAL_PLAN];
  for (let revision = 2; revision <= 10; revision++) {
    const next = improvePlan(plan, counties.map(c => c.id));
    const expected = counties.filter(c => countyVote(c.id, plan, revision > 2).status !== countyVote(c.id, next).status);
    const bucket = events.filter(e => e.revision === revision);
    expect(bucket.map(e => e.countyId)).toEqual(expected.map(c => c.id));
    for (const event of bucket) {
      expect(event.before).toBe(countyVote(event.countyId, plan, revision > 2).status);
      expect(event.after).toBe(countyVote(event.countyId, next).status);
    }
    plan = next;
  }
  expect(countyEvents(2)).toHaveLength(counties.length);
  expect(countyEvents(100)).toEqual(countyEvents(20));
});
