import { expect, test } from 'bun:test';
import { emptyDB, extract, DEFAULT_WEIGHTS } from '../engine/engine';
import { computeSynthesis, type SynthesisJob } from './synthesis-compute';
import { runSynthesis } from './synthesis-runner';

export function fixtureJob(compare = true): SynthesisJob {
  const db = emptyDB();
  db.entries = ['Rent is too high!', 'Flooding has destroyed my home!'].map((text, index) => ({
    id: `fixture-${index}`, text, author: 'Sample', synthetic: index === 1, seeded: true,
    createdAt: '2023-11-14T00:00:00Z', extraction: extract(text), corrected: false,
  }));
  return { db, weights: DEFAULT_WEIGHTS, parsed: { entries: [] }, now: 1700000000000,
    measuredOutcomes: { needs: { flooding: { severity: 1 } } }, parsedOutcomes: {}, OUTCOMES_MODE: 'shadow', compare,
    previousUsed: { A: ['h_vouchers'] }, challengerStreakUsed: {} };
}

test('workers preserve exact comparison, outcomes, scores, identities and ordinary results', async () => {
  for (const compare of [false, true]) {
    const job = fixtureJob(compare);
    const before = structuredClone(job);
    expect(await runSynthesis(job)).toEqual(computeSynthesis(job));
    expect(job).toEqual(before);
  }
});

test('cancelled and overloaded work rejects; capacity recovers after termination', async () => {
  const controller = new AbortController();
  const first = runSynthesis(fixtureJob(), controller.signal);
  const second = runSynthesis(fixtureJob(), controller.signal);
  const failures = [first.catch(error => error.message), second.catch(error => error.message)];
  const overloaded = runSynthesis(fixtureJob()).catch(error => error.message);
  controller.abort();
  expect(await overloaded).toContain('busy');
  expect(await Promise.all(failures)).toEqual(['Synthesis cancelled', 'Synthesis cancelled']);
  await expect(runSynthesis(fixtureJob(), controller.signal)).rejects.toThrow('cancelled');
  expect((await runSynthesis(fixtureJob())).plans.length).toBe(3);
});

test('worker compute errors release capacity without a synchronous retry', async () => {
  const job = fixtureJob();
  job.db = null as any;
  await expect(runSynthesis(job)).rejects.toThrow();
  expect((await runSynthesis(fixtureJob())).plans.length).toBe(3);
});
