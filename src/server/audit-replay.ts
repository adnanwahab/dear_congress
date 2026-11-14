import { createHash } from "node:crypto";
import { scoreAggregate } from "../engine/aggregate-score";
import type { ScoreParts, Weights } from "../engine/types";

const COMPONENTS = ["support", "welfare", "fairness", "feasibility", "reversibility", "evidence"] as const;

/** Canonical subset: plain JSON objects, sorted ASCII keys, finite numbers, UTF-8.
 * Arrays retain their order. This is a versioned local format, not RFC 8785.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  throw new Error("Unsupported canonical JSON value");
}
export function snapshotId(payload: unknown) {
  return createHash("sha256").update(canonicalJSON(payload), "utf8").digest("hex");
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error("Invalid snapshot fields");
  return value as Record<string, unknown>;
}
function literal(value: unknown, expected: string) {
  if (value !== expected) throw new Error("Unsupported snapshot version or source");
}
function number(value: unknown, max = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new Error("Invalid snapshot number");
  return value;
}
function components(value: unknown): Weights {
  const fields = object(value, COMPONENTS);
  return Object.fromEntries(COMPONENTS.map(key => [key, number(fields[key])])) as unknown as Weights;
}

/** Reject rather than reflect unknown fields, including accidentally embedded private data.
 * Only fabricated sample snapshots are supported; this is not a production exporter.
 */
export function replaySnapshot(input: unknown, expectedId?: string) {
  const bundle = object(input, ["snapshotId", "payload"]);
  const p = object(bundle.payload, ["schema", "rules", "repository", "kind", "dataClass", "processedAt", "proposal", "counts", "parts", "weights", "lambda", "changeLevel", "expected"]);
  literal(p.schema, "dear-congress-audit-sample.v1");
  literal(p.rules, "aggregate-score.v1");
  literal(p.repository, "adnanwahab/dear_congress");
  literal(p.kind, "fabricated-civic-proposal");
  literal(p.dataClass, "fabricated; no real participation or official evidence");
  if (typeof p.processedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.processedAt)
    || !Number.isFinite(Date.parse(p.processedAt)) || new Date(p.processedAt).toISOString() !== p.processedAt) throw new Error("Invalid processing time");
  const proposal = object(p.proposal, ["id", "version", "title"]);
  literal(proposal.id, "audit-sample-transit");
  literal(proposal.version, "1");
  literal(proposal.title, "Fabricated evening bus pilot");
  const counts = object(p.counts, ["support", "oppose", "unsure"]);
  const tally = Object.fromEntries(["support", "oppose", "unsure"].map(key => {
    const value = number(counts[key], 1_000_000_000);
    if (!Number.isSafeInteger(value)) throw new Error("Invalid tally count");
    return [key, value];
  })) as Record<"support" | "oppose" | "unsure", number>;
  const total = tally.support + tally.oppose + tally.unsure;
  const parts: ScoreParts = components(p.parts);
  // The sample uses support/all responses; no synthetic priors or private denominators.
  if (parts.support !== Math.round((total ? tally.support / total : 0) * 1000) / 1000) throw new Error("Support does not match tally");
  const weights = components(p.weights);
  const result = scoreAggregate(parts, weights, number(p.lambda), number(p.changeLevel, 6));
  const expected = object(p.expected, ["total", "score", "changeCost"]);
  if (expected.total !== total || expected.score !== result.score || expected.changeCost !== result.changeCost) throw new Error("Replay mismatch");
  const id = snapshotId(p);
  if (bundle.snapshotId !== id || (expectedId !== undefined && expectedId !== id)) throw new Error("Snapshot digest mismatch");
  return {
    snapshotId: id, processedAt: p.processedAt, verification: "reproduced-sample-arithmetic",
    signature: "unsigned", sourceAuthenticity: "unverified-fabricated-sample",
    scope: "Tally and aggregate component score only; not component derivation or package selection",
    total, ...result,
  };
}
