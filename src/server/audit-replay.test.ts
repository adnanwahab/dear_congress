import { expect, test } from "bun:test";
import sample from "../../data/audit-samples/transit-v1.json";
import { canonicalJSON, replaySnapshot, snapshotId } from "./audit-replay";
import { auditSampleResponse } from "./audit-samples";
import { scoreAggregate } from "../engine/aggregate-score";

const copy = () => structuredClone(sample);
function resign(bundle: ReturnType<typeof copy>) { bundle.snapshotId = snapshotId(bundle.payload); return bundle; }

test("frozen fabricated sample reproduces tally and actual synthesis score arithmetic", () => {
  const report = replaySnapshot(sample, sample.snapshotId);
  expect(report).toMatchObject({ total: 100, score: 0.599, changeCost: 0.083, signature: "unsigned" });
  expect(scoreAggregate(sample.payload.parts, sample.payload.weights, 0.25, 2)).toEqual({ score: 0.599, changeCost: 0.083 });
  expect(replaySnapshot(JSON.parse(canonicalJSON(sample)))).toEqual(report);
  expect(canonicalJSON({b: 2, a: 1})).toBe(canonicalJSON({a: 1, b: 2}));
});

test("reject tampering, wrong retained ID, unsupported rules and source/revision substitution", () => {
  const changed = copy(); changed.payload.counts.support++;
  expect(() => replaySnapshot(changed)).toThrow();
  expect(() => replaySnapshot(sample, "0".repeat(64))).toThrow();
  for (const [key, value] of [["rules", "aggregate-score.v2"], ["schema", "unknown"], ["repository", "other/repo"], ["kind", "pull-request"], ["processedAt", "2026-02-30T00:00:00.000Z"]]) {
    const bundle = copy(); (bundle.payload as Record<string, unknown>)[key!] = value;
    expect(() => replaySnapshot(resign(bundle))).toThrow();
  }
  for (const key of ["id", "version", "title"] as const) {
    const bundle = copy(); bundle.payload.proposal[key] = "substituted";
    expect(() => replaySnapshot(resign(bundle))).toThrow();
  }
});

test("fail closed on extra private fields at every level, suppressed and invalid input", () => {
  for (const path of [[], ["payload"], ["payload", "proposal"], ["payload", "counts"], ["payload", "parts"], ["payload", "weights"], ["payload", "expected"]]) {
    const bundle = copy(); let target: any = bundle;
    for (const key of path) target = target[key];
    target.journal = "PRIVATE_CANARY";
    expect(() => replaySnapshot(bundle)).toThrow();
  }
  for (const invalid of [-1, 1.5, Number.NaN, Infinity, null, "60", 1_000_000_001]) {
    const bundle = copy(); (bundle.payload.counts as any).support = invalid;
    expect(() => replaySnapshot(bundle)).toThrow();
  }
  const missing = copy(); delete (missing.payload.parts as any).welfare;
  expect(() => replaySnapshot(missing)).toThrow();
  const mismatch = copy(); mismatch.payload.expected.score = 0.6;
  expect(() => replaySnapshot(resign(mismatch))).toThrow("Replay mismatch");
  expect(() => canonicalJSON({ hidden: undefined })).toThrow();
});

test("zero tally is explicit", () => {
  const bundle = copy(); bundle.payload.counts = { support: 0, oppose: 0, unsure: 0 };
  bundle.payload.parts.support = 0;
  bundle.payload.expected = { total: 0, ...scoreAggregate(bundle.payload.parts, bundle.payload.weights, 0.25, 2) };
  expect(replaySnapshot(resign(bundle)).total).toBe(0);
});

test("public API serves stable addressable sample bytes and refuses unknown IDs", async () => {
  const index = await auditSampleResponse().json();
  expect(index.samples[0].snapshotId).toBe(sample.snapshotId);
  const first = auditSampleResponse(sample.snapshotId);
  expect(first.headers.get("cache-control")).toBe("no-store");
  const bytes = await first.text();
  expect(bytes).toBe(await auditSampleResponse(sample.snapshotId).text());
  expect(replaySnapshot(JSON.parse(bytes), sample.snapshotId).score).toBe(0.599);
  expect(auditSampleResponse("../db.json").status).toBe(404);
  expect(auditSampleResponse("0".repeat(64)).status).toBe(404);
  for (const privateField of ["journal", "voter", "sourceText", "cookie", "ownerHash", "IP", "comments"]) expect(bytes).not.toContain(`"${privateField}"`);
});

test("CLI independently reads frozen public bytes offline and exits nonzero on failure", async () => {
  const run = async (id: string) => {
    const proc = Bun.spawn([process.execPath, "scripts/audit-replay.ts", "data/audit-samples/transit-v1.json", id], { stdout: "pipe", stderr: "pipe" });
    return { status: await proc.exited, out: await new Response(proc.stdout).text(), err: await new Response(proc.stderr).text() };
  };
  const good = await run(sample.snapshotId);
  expect(good.status).toBe(0); expect(JSON.parse(good.out).total).toBe(100);
  const bad = await run("0".repeat(64));
  expect(bad.status).toBe(1); expect(bad.out).toBe(""); expect(bad.err).toContain("Audit replay failed");
});
