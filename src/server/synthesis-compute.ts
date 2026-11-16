import { buildContext, synthesize, packageOptions, diffPackages, DEFAULT_WEIGHTS } from '../engine/engine';
import { attachIdeaReports } from '../engine/idea-report';
import type { DB, JournalEntry, Weights, SynthesisOutcomes } from '../engine/types';
import { measuredPreviewByPackage, mergeOutcomes, type OutcomesMode } from './outcomes';

export interface SynthesisJob {
  db: DB;
  weights?: Weights; lambda?: number; budget?: number; includeSynthetic?: boolean; compare?: boolean;
  parsed: { entries: JournalEntry[] };
  now: string | number;
  baseOutcomes?: SynthesisOutcomes;
  measuredOutcomes: SynthesisOutcomes;
  parsedOutcomes: { outcomes?: SynthesisOutcomes };
  previousUsed: DB['lastPlan']; challengerStreakUsed: DB['challengerStreak'];
  OUTCOMES_MODE: OutcomesMode;
}

/** Pure request snapshot: never reads or writes the live database. */
export function computeSynthesis(job: SynthesisJob) {
  const { db, weights, lambda, budget, includeSynthetic, compare, parsed, now, baseOutcomes,
    measuredOutcomes, parsedOutcomes, previousUsed, challengerStreakUsed, OUTCOMES_MODE } = job;
  if (compare === true) {
    const ctxReal = buildContext(db, undefined, {
      includeSynthetic: false,
      extraEntries: parsed.entries,
      now,
      outcomes: baseOutcomes,
    });
    const ctxBlended = buildContext(db, undefined, {
      includeSynthetic: true,
      extraEntries: parsed.entries,
      now,
      outcomes: baseOutcomes,
    });
    const real = synthesize(ctxReal, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
    const blended = synthesize(ctxBlended, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
    const pkgOpts = packageOptions(weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
    attachIdeaReports(ctxReal, real, pkgOpts);
    attachIdeaReports(ctxBlended, blended, pkgOpts, { fitTests: false });

    let measuredPreview: Record<string, { items: string[]; diff: { added: string[]; removed: string[]; moneyMovedB: number } }> = {};
    if (OUTCOMES_MODE === "shadow") {
      const measuredCtxReal = buildContext(db, undefined, {
        includeSynthetic: false,
        extraEntries: parsed.entries,
        now,
        outcomes: mergeOutcomes(measuredOutcomes, parsedOutcomes.outcomes),
      });
      const measuredReal = synthesize(measuredCtxReal, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
      measuredPreview = measuredPreviewByPackage(real, measuredReal);
    }

    return { payload: { real, blended, diff: diffPackages(real, blended), measuredPreview, outcomesMode: OUTCOMES_MODE }, plans: real };
  }

  const ctx = buildContext(db, undefined, {
    includeSynthetic: includeSynthetic === true,
    extraEntries: parsed.entries,
    now,
    outcomes: baseOutcomes,
  });
  const results = synthesize(ctx, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
  attachIdeaReports(ctx, results, packageOptions(weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed));

  if (OUTCOMES_MODE === "shadow") {
    const measuredCtx = buildContext(db, undefined, {
      includeSynthetic: includeSynthetic === true,
      extraEntries: parsed.entries,
      now,
      outcomes: mergeOutcomes(measuredOutcomes, parsedOutcomes.outcomes),
    });
    const measured = synthesize(measuredCtx, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
    const preview = measuredPreviewByPackage(results, measured);
    for (const pkg of results) pkg.measuredPreview = preview[pkg.id];
  }

  return { payload: results, plans: results };
}
