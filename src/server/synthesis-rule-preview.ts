import { buildContext, DEFAULT_WEIGHTS, emptyDB, extract, packageOptions, scoreAll, synthesizePackage } from '../engine/engine';
import { SEED_JOURNALS } from '../engine/catalog';
import { normalizeWeights } from '../shared/synthesis-rule';
import { boundedJson, PublicInputError } from './public-security';

const FIXTURE_TIME = '2026-11-01T12:00:00.000Z';
function boundedNumber(value: unknown, name: string, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`${name} must be a number between 0 and ${max}.`);
  return value;
}

/** Fixture-only: has no reference to a live database, writer, ballot or activation service. */
export function previewSynthesisRule(body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !['weights', 'lambda', 'budget'].includes(key))) throw new Error('Only weights, lambda and budget may be previewed.');
  const candidate = {
    weights: normalizeWeights(body.weights),
    lambda: boundedNumber(body.lambda, 'Institutional-change penalty', 1),
    budget: boundedNumber(body.budget, 'Budget (USD billions)', 150),
  };
  const baseline = { weights: normalizeWeights(DEFAULT_WEIGHTS), lambda: .25, budget: 40 };
  const fixture = emptyDB();
  fixture.entries = SEED_JOURNALS.map((entry, i) => ({ ...entry, id: `rule-fixture-${i}`, createdAt: FIXTURE_TIME, extraction: extract(entry.text), corrected: false, seeded: true }));
  const ctx = buildContext(fixture, undefined, { now: FIXTURE_TIME, includeSynthetic: false });
  const before = packageOptions(baseline.weights.raw, baseline.lambda, baseline.budget);
  const after = packageOptions(candidate.weights.raw, candidate.lambda, candidate.budget);
  const packages = before.map((base, index) => {
    const next = after[index]!;
    const oldPlan = synthesizePackage(ctx, base), newPlan = synthesizePackage(ctx, next);
    const oldSelected = new Set(oldPlan.items.map(item => item.proposal.id));
    const newSelected = new Set(newPlan.items.map(item => item.proposal.id));
    const oldRows = scoreAll(ctx, base.weights, base.lambda);
    const newRows = new Map(scoreAll(ctx, next.weights, next.lambda).map(row => [row.p.id, row]));
    return {
      id: base.id, name: base.name,
      baseline: { weights: normalizeWeights(base.weights), lambda: base.lambda, budget: base.budget, spend: oldPlan.totalCost },
      candidate: { weights: normalizeWeights(next.weights), lambda: next.lambda, budget: next.budget, spend: newPlan.totalCost },
      options: oldRows.map(old => {
        const next = newRows.get(old.p.id)!;
        return { id: old.p.id, title: old.p.title, baselineScore: old.score, candidateScore: next.score,
          delta: Number((next.score - old.score).toFixed(6)), baselineSelected: oldSelected.has(old.p.id), candidateSelected: newSelected.has(old.p.id), rightsBlocked: !!old.p.rightsIssue };
      }),
    };
  });
  return { schemaVersion: 'synthesis-rule-sandbox.v1', fixture: 'public seed journals + deterministic simulated population; no live resident inputs', fixtureTime: FIXTURE_TIME,
    status: 'Advisory sandbox only. No vote, approval or activation is recorded.', baseline, candidate, packages };
}
export type RulePreview = ReturnType<typeof previewSynthesisRule>;

export async function handleRulePreview(req: Request): Promise<Response> {
  try {
    return Response.json(previewSynthesisRule(await boundedJson(req, 4096)), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof PublicInputError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
