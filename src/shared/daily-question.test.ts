import { expect, test } from 'bun:test';
import { demoPayload } from '../engine/demo';
import { chicagoDate, dailyQuestion, nextChicagoDay } from './daily-question';

test('Chicago daily boundaries include both DST day lengths', () => {
  for (const [start, end] of [
    ['2026-11-14T05:59:59Z', '2026-11-14T06:00:00Z'],
    ['2026-03-08T06:00:00Z', '2026-03-09T05:00:00Z'],
    ['2026-11-01T05:00:00Z', '2026-11-02T06:00:00Z'],
  ]) {
    expect(new Date(nextChicagoDay(new Date(start!))).toISOString()).toBe(new Date(end!).toISOString());
  }
  expect(chicagoDate(new Date('2026-11-14T05:59:59Z'))).toBe('2026-11-13');
  expect(chicagoDate(new Date('2026-11-14T06:00:00Z'))).toBe('2026-11-14');
});

test('selection is stable by ID, rotates locally, and never uses expired/unknown windows', () => {
  const now = new Date('2026-11-13T18:00:00Z');
  const data = demoPayload({}, 'visitor', now);
  const selected = dailyQuestion(data, now)!;
  expect(dailyQuestion({ ...data, items: [...data.items].reverse() }, now)?.id).toBe(selected.id);
  expect(dailyQuestion(data, new Date('2026-11-14T06:00:00Z'))?.id).not.toBe(selected.id);
  expect(dailyQuestion({ ...data, items: [] }, now)).toBeUndefined();
  expect(dailyQuestion({ ...data, closesAt: now.toISOString() }, now)).toBeUndefined();
  expect(dailyQuestion({ ...data, closesAt: 'invalid' }, now)).toBeUndefined();
});
