import { test, expect } from 'bun:test';
import { billCollection } from './bill-catalog';
import { ARRIVAL_MODEL, ARRIVAL_NOTE, arrivalSpan, cycleStart, estimateArrivals, formatArrival, ordinal, remainingStages } from './bill-eta';
import type { EditorialReview } from './bill-editorial';
import ledger from '../../content/bill-collections/eudaimonia-100-reviews.json';

const SUNDAY = new Date('2026-11-22T17:00:00Z');
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

test('every curated draft gets an ordered, deterministic arrival estimate', () => {
  const estimates = estimateArrivals(SUNDAY);
  expect(estimates.size).toBe(billCollection.bills.length);
  expect(estimates.size).toBe(110);
  for (const bill of billCollection.bills) {
    const e = estimates.get(bill.id)!;
    expect(e.model).toBe(ARRIVAL_MODEL.id);
    expect(e.cycleStart).toBe('2026-11-23');
    expect(day(e.earliest)).toBeLessThanOrEqual(day(e.expected));
    expect(day(e.expected)).toBeLessThanOrEqual(day(e.latest));
    expect(e.stages.map(s => s.key)).toEqual(['assignment', 'review', 'publication', 'ballot']);
    expect(e.stages.every(s => !s.done && s.expected)).toBe(true);
    expect(e.stages.at(-1)!.expected).toBe(e.expected);
  }
  expect(estimateArrivals(SUNDAY)).toEqual(estimates);
});

test('each category queues its drafts one a week in ID order', () => {
  const estimates = estimateArrivals(SUNDAY);
  expect(estimates.get('HFL-001')).toMatchObject({ queuePosition: 0, queueSize: 10, startsOn: '2026-11-23', expected: '2027-01-04', earliest: '2026-12-20', latest: '2027-02-08' });
  expect(estimates.get('HFL-010')).toMatchObject({ queuePosition: 9, startsOn: '2027-01-25', expected: '2027-03-08' });
  expect(estimates.get('HFL-101')).toMatchObject({ queuePosition: 0, expected: '2027-01-04' });
  for (const category of billCollection.categories) {
    const inCategory = billCollection.bills.filter(b => b.category === category).map(b => estimates.get(b.id)!);
    expect(inCategory.map(e => e.queuePosition)).toEqual([...Array(10).keys()]);
    for (let i = 1; i < inCategory.length; i++) expect(day(inCategory[i]!.expected)).toBeGreaterThan(day(inCategory[i - 1]!.expected));
  }
  expect(arrivalSpan(estimates.values())).toEqual({ first: '2027-01-04', last: '2027-03-08' });
});

test('the review cycle starts on the next Monday, or today on a Monday', () => {
  expect(new Date(cycleStart(new Date('2026-11-23T23:59:00Z'))).toISOString().slice(0, 10)).toBe('2026-11-23');
  expect(new Date(cycleStart(new Date('2026-11-24T00:00:00Z'))).toISOString().slice(0, 10)).toBe('2026-11-30');
  expect(new Date(cycleStart(SUNDAY)).toISOString().slice(0, 10)).toBe('2026-11-23');
});

test('recorded human progress shortens the estimate; missing, duplicate or stale records fail closed', () => {
  const bill = billCollection.bills[0]!;
  const ok = { status: 'approved', reviewer: 'Human reviewer', record: 'docs/reviews/human-record.md' };
  const row = ledger.find(r => r.id === bill.id)! as EditorialReview;
  const reviewed: EditorialReview = { ...row, author: 'Author', editor: 'Editor', legal: ok, evidence: ok, fiscal: ok };
  const ready: EditorialReview = { ...reviewed, publication: ok };
  const others = (ledger as EditorialReview[]).filter(r => r.id !== bill.id);
  expect([...remainingStages(bill, [reviewed, ...others])]).toEqual(['publication', 'ballot']);
  expect([...remainingStages(bill, [ready, ...others])]).toEqual(['ballot']);
  const estimates = estimateArrivals(SUNDAY, billCollection.bills, [ready, ...others]);
  expect(estimates.get(bill.id)).toMatchObject({ queuePosition: null, expected: '2026-11-30', earliest: '2026-11-30', latest: '2026-11-30' });
  expect(estimates.get('HFL-002')).toMatchObject({ queuePosition: 0, queueSize: 9, expected: '2027-01-04' });
  for (const records of [[], [ready, ready], [{ ...ready, revision: 'stale' }], [{ ...ready, jurisdiction: 'city' }],
    [{ ...ready, author: ' ' }], [{ ...ready, legal: { ...ok, record: '' } }], [{ ...ready, fiscal: { ...ok, status: 'pending' } }]])
    expect(remainingStages(bill, records).size).toBeGreaterThan(1);
  expect([...remainingStages(bill, [{ ...ready, editor: null }])]).toEqual(['assignment', 'publication', 'ballot']);
});

test('estimates are pure and never touch the catalog or review ledger', () => {
  const before = JSON.stringify([billCollection, ledger]);
  estimateArrivals(new Date('2027-06-01T00:00:00Z'));
  expect(JSON.stringify([billCollection, ledger])).toBe(before);
});

test('formatting is UTC and locale-stable; the note disclaims schedules and enactment', () => {
  expect(formatArrival('2027-01-04')).toBe('Jan 4, 2027');
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
  for (const text of ['Planning estimate', 'Not a schedule', 'a commitment', 'prediction of enactment', 'official status']) expect(ARRIVAL_NOTE).toContain(text);
});
