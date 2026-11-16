import { emptyDB, extract, DEFAULT_WEIGHTS } from '../src/engine/engine';
import { SEED_JOURNALS } from '../src/engine/catalog';
import { computeSynthesis, type SynthesisJob } from '../src/server/synthesis-compute';
import { runSynthesis } from '../src/server/synthesis-runner';

// Local synthetic fixture only. No HTTP, persistent writes, identities or public traffic.
const db = emptyDB();
const count = Number(process.env.SYNTH_BENCH_ENTRIES ?? 5000);
const extraction = SEED_JOURNALS.map(entry => extract(entry.text));
db.entries = Array.from({ length: count }, (_, index) => {
  const seed = index % SEED_JOURNALS.length;
  return { ...SEED_JOURNALS[seed]!, id: `benchmark-fixture-${index}`, createdAt: '2023-11-14T00:00:00Z',
    extraction: extraction[seed]!, corrected: false, seeded: true };
});
const base: SynthesisJob = { db, parsed: { entries: [] }, now: 1700000000000,
  measuredOutcomes: {}, parsedOutcomes: {}, OUTCOMES_MODE: 'shadow', previousUsed: {}, challengerStreakUsed: {} };
for (const compare of [false, true]) {
  for (const execution of ['inline', 'worker']) {
    const durations: number[] = [], delays: number[] = [];
    for (let index = 0; index < 5; index++) {
      const job = { ...base, compare, weights: { ...DEFAULT_WEIGHTS, welfare: index * .1 } };
      let last = performance.now(), maxDelay = 0;
      const timer = setInterval(() => { const now = performance.now(); maxDelay = Math.max(maxDelay, now - last - 5); last = now; }, 5);
      const start = performance.now();
      if (execution === 'inline') computeSynthesis(job); else await runSynthesis(job);
      durations.push(performance.now() - start);
      await Bun.sleep(10); clearInterval(timer); delays.push(maxDelay);
    }
    console.log(JSON.stringify({ fixtureEntries: count, compare, execution, samples: 5,
      totalMs: durations.map(x => +x.toFixed(1)), maxEventLoopDelayMs: delays.map(x => +x.toFixed(1)),
      delaysOver50ms: delays.filter(x => x > 50).length }));
  }
}
