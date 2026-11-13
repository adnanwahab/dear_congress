// "Simulate realities": synthesize the plan ONCE, freeze it, and hand HappyBearLandia an
// opaque snapshot id. HBL then runs the same frozen plan in many paired futures.
// No journal text ever leaves Dear Congress in a snapshot or a URL.

import { DEFAULT_WEIGHTS, buildContext, synthesize } from "../engine/engine";
import type { DB, NeedDef, PackageResult, SimulationSnapshot, SynthesisOutcomes } from "../engine/types";

export const MAX_STORED_SNAPSHOTS = 500;
export const DEFAULT_RUNS = 100;
export const DEFAULT_YEARS = 10;

export class SnapshotError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Match the existing /world workload limits; reject malformed settings before storing. */
export function validateSimulationOptions(opts: { runs?: unknown; years?: unknown; seed?: unknown }) {
  const integer = (value: unknown, fallback: number, max: number, name: string) => {
    if (value === undefined) return fallback;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
      throw new SnapshotError(`${name} must be a positive whole number`);
    }
    return Math.min(max, value);
  };
  const runs = integer(opts.runs, DEFAULT_RUNS, 1000, "runs");
  const years = integer(opts.years, DEFAULT_YEARS, 10, "years");
  if (opts.seed !== undefined && (typeof opts.seed !== "number" || !Number.isInteger(opts.seed) || opts.seed < 0 || opts.seed > 4294967295)) {
    throw new SnapshotError("seed must be a whole number from 0 to 4294967295");
  }
  return { runs, years, seed: opts.seed as number | undefined };
}

export function findPackage(packages: PackageResult[], name: string): PackageResult | null {
  const needle = name.trim().toLowerCase();
  return packages.find((p) => p.id.toLowerCase() === needle || p.name.toLowerCase() === needle)
    ?? packages.find((p) => needle && p.name.toLowerCase().includes(needle))
    ?? null;
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

export function createSimulationSnapshot(
  db: DB,
  opts: { entryId?: string | null; packageName?: string; needs: NeedDef[]; outcomes?: SynthesisOutcomes; now?: Date },
): SimulationSnapshot {
  const entryId = opts.entryId?.trim() || null;
  const entry = entryId ? db.entries.find((e) => e.id === entryId) : null;
  if (entryId && !entry) throw new SnapshotError("journal entry not found", 404);

  // Same synthesis the Synthesize tab runs on real voices, but read-only: it must not
  // move db.lastPlan / challengerStreak just because someone pressed "simulate".
  const ctx = buildContext(db, undefined, { includeSynthetic: false, outcomes: opts.outcomes });
  const packages = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40, db.lastPlan, db.challengerStreak);
  const pkg = findPackage(packages, opts.packageName || "Balanced");
  if (!pkg) throw new SnapshotError(`no package named "${opts.packageName}"`);

  const labelOf = new Map(opts.needs.map((n) => [n.id, n.label]));
  const linked = entry?.extraction.needs ?? [];
  const total = linked.reduce((s, n) => s + Math.max(0, n.confidence), 0);
  const needs = linked.map((n) => ({
    id: n.id,
    label: labelOf.get(n.id) ?? n.id,
    weight: total > 0 ? round(Math.max(0, n.confidence) / total) : round(1 / linked.length),
  }));

  return {
    id: `sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    schemaVersion: 1,
    createdAt: (opts.now ?? new Date()).toISOString(),
    entryId,
    location: entry?.location ? { lat: entry.location.lat, lng: entry.location.lng } : null,
    needs,
    plan: {
      id: pkg.id,
      label: pkg.name,
      proposalIds: pkg.items.map((i) => i.proposal.id),
      items: pkg.items.map((i) => ({ id: i.proposal.id, title: i.proposal.title, needId: i.proposal.needId, costB: i.proposal.costB })),
      totalCostB: round(pkg.totalCost, 3),
      budgetB: pkg.budget,
    },
  };
}

export function storeSnapshot(db: DB, snapshot: SimulationSnapshot) {
  db.simulationSnapshots ??= [];
  db.simulationSnapshots.push(snapshot);
  if (db.simulationSnapshots.length > MAX_STORED_SNAPSHOTS) {
    db.simulationSnapshots.splice(0, db.simulationSnapshots.length - MAX_STORED_SNAPSHOTS);
  }
}

export function simulationUrl(
  hblUrl: string,
  snapshot: SimulationSnapshot,
  opts: { runs?: number; years?: number; seed?: number } = {},
): string {
  opts = validateSimulationOptions(opts);
  const seed = opts.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!;
  const q = new URLSearchParams({
    simulation: snapshot.id,
    runs: String(opts.runs ?? DEFAULT_RUNS),
    years: String(opts.years ?? DEFAULT_YEARS),
    seed: String(seed),
    autorun: "1",
  });
  return `${hblUrl.replace(/\/+$/, "")}/world?${q}`;
}
