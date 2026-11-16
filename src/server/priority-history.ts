import { computeDemand, POPULATION } from '../engine/engine';
import { NEEDS } from '../engine/catalog';
import { journalOrigin } from '../shared/journal-origin';
import { isPublicEntry } from '../shared/moderation';
import type { DB, SynthesisOutcomes } from '../engine/types';
import type { PrioritySample } from '../shared/priority-history';

/** Capture only when a persisted ranking or its denominator changes. No backfill. */
export function recordPriorities(db: DB, outcomes?: SynthesisOutcomes, now = new Date()) {
  const entries = db.entries.filter(e => isPublicEntry(e) && !e.synthetic);
  const needs = [...NEEDS, ...db.emergentNeeds];
  const demand = computeDemand(db, POPULATION, needs, entries, now.toISOString(), [], Object.fromEntries(Object.entries(outcomes?.needs ?? {}).map(([id, value]) => [id, value.severity])));
  const sample: PrioritySample = {
    recordedAt: now.toISOString(), source: 'dear-congress/shared-needs-v1',
    journals: entries.length,
    sampleJournals: entries.filter(e => journalOrigin(e) === 'sample').length,
    realJournals: entries.filter(e => journalOrigin(e) !== 'sample').length,
    simulatedPrior: POPULATION.length,
    allocations: Object.values(db.allocationByVoter).filter(a => Object.values(a).reduce((sum, n) => sum + n, 0) > 0).length,
    measuredOutcomes: !!outcomes,
    ranks: [...needs].sort((a, b) => demand[b.id]!.demand - demand[a.id]!.demand)
      .map((n, i) => ({ id: n.id, label: n.label, rank: i + 1, demand: demand[n.id]!.demand })),
  };
  const previous = db.priorityHistory?.at(-1);
  if (previous && JSON.stringify({ ...previous, recordedAt: '' }) === JSON.stringify({ ...sample, recordedAt: '' })) return;
  db.priorityHistory = [...(db.priorityHistory ?? []), sample].slice(-365);
}
