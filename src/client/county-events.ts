import counties from './data/counties.json';
import { countyVote, improvePlan, INITIAL_PLAN } from './county-simulation';

export type CountyEvent = { id: string; countyId: string; revision: number; before: string; after: string };
/** Exact deterministic status transitions, not inferred resident events or wall-clock observations. */
export function countyEvents(revision: number): CountyEvent[] {
  const events: CountyEvent[] = [];
  let plan = [...INITIAL_PLAN];
  const ids = counties.map(c => c.id);
  for (let r = 2; r <= Math.min(20, revision); r++) {
    const next = improvePlan(plan, ids);
    for (const c of counties) {
      const before = countyVote(c.id, plan, r > 2).status;
      const after = countyVote(c.id, next).status;
      if (before !== after) events.push({ id: `county-fips-v1:r${r}:${c.id}`, countyId: c.id, revision: r, before, after });
    }
    plan = next;
  }
  return events;
}
