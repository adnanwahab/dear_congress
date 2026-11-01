import type { DB, NeedDef } from "../engine/types";

/** Labels that differ only in case, punctuation, spacing or "&"/"and" name the same need. */
export function normalizeNeedLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** The first need (catalog before emergent) whose label matches, if any. */
export function findNeedByLabel(label: string, needs: NeedDef[]): NeedDef | undefined {
  const key = normalizeNeedLabel(label);
  if (!key) return undefined;
  return needs.find((n) => normalizeNeedLabel(n.label) === key);
}

/**
 * Fold emergent needs that duplicate an earlier need's label into that need.
 * Journals, ideas, answers, goal votes and priority points move to the surviving need.
 * Returns duplicateId → survivingId for every need removed. Idempotent.
 */
export function mergeDuplicateNeeds(db: DB, catalog: NeedDef[]): Record<string, string> {
  const remap: Record<string, string> = {};
  const kept: NeedDef[] = [];
  for (const n of db.emergentNeeds ?? []) {
    const target = findNeedByLabel(n.label, [...catalog, ...kept]);
    if (target) remap[n.id] = target.id;
    else kept.push(n);
  }
  if (!Object.keys(remap).length) return remap;

  const to = (id: string) => remap[id] ?? id;

  for (const e of db.entries ?? []) {
    const best = new Map<string, number>();
    for (const n of e.extraction?.needs ?? []) best.set(to(n.id), Math.max(best.get(to(n.id)) ?? 0, n.confidence));
    if (e.extraction) e.extraction.needs = [...best].map(([id, confidence]) => ({ id, confidence })).sort((a, b) => b.confidence - a.confidence);
  }
  for (const a of db.answers ?? []) a.needId = to(a.needId);
  for (const p of db.emergent ?? []) p.needId = to(p.needId);

  // A voter's own vote on the surviving goal wins; otherwise their duplicate-goal vote carries over.
  const mergeGoals = (votes: Record<string, boolean>) => {
    for (const [from, target] of Object.entries(remap)) {
      if (!(from in votes)) continue;
      if (!(target in votes)) votes[target] = votes[from]!;
      delete votes[from];
    }
  };
  // Priority points add up, so a voter's total spend is unchanged.
  const mergePoints = (points: Record<string, number>) => {
    for (const [from, target] of Object.entries(remap)) {
      if (!(from in points)) continue;
      points[target] = (points[target] ?? 0) + points[from]!;
      delete points[from];
    }
  };
  for (const v of Object.values(db.goalVotesByVoter ?? {})) mergeGoals(v);
  for (const v of Object.values(db.allocationByVoter ?? {})) mergePoints(v);
  if (db.goalVotes) mergeGoals(db.goalVotes);
  if (db.allocation) mergePoints(db.allocation);

  db.emergentNeeds = kept;
  return remap;
}
