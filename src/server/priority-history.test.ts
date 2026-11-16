import { expect, test } from 'bun:test';
import { emptyDB, buildContext } from '../engine/engine';
import { recordPriorities } from './priority-history';
import { validPrioritySamples } from '../shared/priority-history';

test('captures current model ranks prospectively, deduplicates unchanged input and preserves ballots', () => {
  const db = emptyDB();
  db.allocationByVoter.PRIVATE_ID = { housing: 100 };
  const original = structuredClone(db);
  recordPriorities(db, undefined, new Date('2026-11-14T00:00:00Z'));
  expect(validPrioritySamples(db.priorityHistory)).toBe(true);
  expect(db.priorityHistory).toHaveLength(1);
  const sample = db.priorityHistory![0]!;
  const ctx = buildContext(original);
  expect(sample.ranks.map(r => r.id)).toEqual([...ctx.needs].sort((a,b) => ctx.demand[b.id]!.demand - ctx.demand[a.id]!.demand).map(n => n.id));
  for (const rank of sample.ranks) expect(rank.demand).toBe(ctx.demand[rank.id]!.demand);
  expect(sample.allocations).toBe(1);
  expect(JSON.stringify(sample)).not.toContain('PRIVATE_ID');
  recordPriorities(db, undefined, new Date('2026-11-15T00:00:00Z'));
  expect(db.priorityHistory).toHaveLength(1);
  expect({ ...db, priorityHistory: undefined }).toEqual({ ...original, priorityHistory: undefined });
  db.allocationByVoter.PRIVATE_ID = { transit: 100 };
  recordPriorities(db, undefined, new Date('2026-11-16T00:00:00Z'));
  expect(db.priorityHistory).toHaveLength(2);
  expect(db.priorityHistory![0]).toEqual(sample);
  expect(validPrioritySamples([{...sample, ranks: [{id:'a', label:'a',rank:2,demand:NaN}]}])).toBe(false);
});
