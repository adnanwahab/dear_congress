import { createHash } from "node:crypto";
import type { DB, SynthesisOutcomes } from "../engine/types";
import { createPublicPlan } from "./public-plan";
import { SnapshotError } from "./simulation-snapshot";
import { buildIdentity } from "./build-identity";

/** Input contract only: no receiving-model or result-determinism claim. */
export function createPolicyComparison(db: DB, body: unknown, outcomes?: SynthesisOutcomes) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SnapshotError("body must be an object");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !["a", "b", "seed"].includes(key))) throw new SnapshotError("Only a, b and seed are supported; this pilot uses default synthesis settings");
  if (!["A", "B", "C"].includes(input.a as string) || !["A", "B", "C"].includes(input.b as string)) throw new SnapshotError("Select package IDs A, B or C");
  const seed = input.seed === undefined ? 42 : input.seed;
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new SnapshotError("seed must be a uint32");
  // Exactly one detached synthesis captures both worlds without advancing plan history.
  const source = createPublicPlan(db, { outcomes });
  const content = {
    schemaVersion: "dear-congress-comparison-input.v1",
    sourceRepository: buildIdentity.repository,
    sourceRevision: buildIdentity.commit,
    synthesis: { weights: "DEFAULT_WEIGHTS", lambda: 0.25, budgetB: 40, includeSynthetic: false },
    worlds: [input.a, input.b].map(id => source.packages.find(pkg => pkg.id === id)!),
    seed,
    // Versioned explicit draw identities; a consumer must use keyed draws per run.
    seedSchedule: "uint32-seed-plus-index.v1",
    runSeeds: Array.from({ length: 100 }, (_, i) => (seed + i) >>> 0),
    horizons: [1, 5, 10],
    costUnits: source.provenance.costUnits,
    outcomes: "unknown: receiving model not integrated; no measured outcomes exported",
    modelVersion: null,
  };
  const inputHash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return { id: `cmp_${inputHash}`, inputHash, content };
}
export type PolicyComparison = ReturnType<typeof createPolicyComparison>;

export function storePolicyComparison(db: DB, comparison: PolicyComparison) {
  db.policyComparisons ??= [];
  if (db.policyComparisons.some(item => item.id === comparison.id)) return;
  // Fail explicitly rather than evicting a previously shared replay.
  if (db.policyComparisons.length >= 500) throw new SnapshotError("Comparison storage is full; existing replays retained", 409);
  db.policyComparisons.push(comparison);
}
