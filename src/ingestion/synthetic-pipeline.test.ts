import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyntheticPipeline, IngestError, type Scope, type SyntheticEvent } from "./synthetic-pipeline";
const scope: Scope = { tenant: "synthetic-a", region: "synthetic-east", subject: "synthetic-user" };
const event = (generation = 1, key = "event-1"): SyntheticEvent => ({ key, sourceId: key, generation, synthetic: true, text: "Rent is expensive and the bus is late." });
function rejects(run: () => unknown, status: number) {
  try { run(); throw new Error("Expected rejection"); } catch (error) { expect(error).toBeInstanceOf(IngestError); expect((error as IngestError).status).toBe(status); }
}
test("durable receipts survive restart, payload conflicts reject, and replay counts once", () => {
  const dir = mkdtempSync(join(tmpdir(), "she320-"));
  let p = new SyntheticPipeline(join(dir, "synthetic.sqlite"));
  try {
    rejects(() => p.enqueue(scope, event()), 403);
    expect(p.grant(scope)).toBe(1);
    const receipt = p.enqueue(scope, event());
    p.close(); p = new SyntheticPipeline(join(dir, "synthetic.sqlite"));
    expect(p.enqueue(scope, event())).toEqual({ receipt: receipt.receipt, duplicate: true });
    rejects(() => p.enqueue(scope, { ...event(), text: "Different text" }), 409);
    rejects(() => p.enqueue(scope, { ...event(), sourceId: "different-source" }), 409);
    expect(p.processOne(scope)).toBe(true);
    const snapshot = p.snapshot(scope);
    expect(snapshot.aggregates.length).toBeGreaterThan(0);
    expect(snapshot.payloads).toBe(0);
    expect(p.processOne(scope)).toBe(false);
    p.enqueue(scope, event());
    expect(p.snapshot(scope)).toEqual(snapshot);
  } finally { p.close(); rmSync(dir, { recursive: true, force: true }); }
});
test("withdrawal removes queued and derived data, fences replay, and leaves other scopes intact", () => {
  const p = new SyntheticPipeline(":memory:");
  const others = [{ ...scope, tenant: "synthetic-b" }, { ...scope, region: "synthetic-west" }, { ...scope, subject: "synthetic-other" }];
  try {
    for (const s of [scope, ...others]) { p.grant(s); p.enqueue(s, event()); p.processOne(s); p.enqueue(s, event(1, "queued")); }
    const expected = others.map(s => p.snapshot(s));
    p.withdraw(scope);
    expect(p.snapshot(scope)).toMatchObject({ aggregates: [], payloads: 0, states: [{ status: "deleted", count: 2 }] });
    expect(p.processOne(scope)).toBe(false);
    rejects(() => p.enqueue(scope, event()), 403);
    const generation = p.grant(scope);
    rejects(() => p.enqueue(scope, event()), 403);
    rejects(() => p.enqueue(scope, event(generation)), 409);
    p.enqueue(scope, event(generation, "new-event"));
    p.processOne(scope);
    expect(p.snapshot(scope).aggregates.length).toBeGreaterThan(0);
    expect(others.map(s => p.snapshot(s))).toEqual(expected);
  } finally { p.close(); }
});
test("backpressure preserves receipts, isolates scopes and leaves deletion available", () => {
  let time = 100;
  const p = new SyntheticPipeline(":memory:", { pendingPerScope: 1, oldestMs: 1000 }, () => time);
  try {
    p.grant(scope); const accepted = p.enqueue(scope, event());
    rejects(() => p.enqueue(scope, event(1, "overflow")), 429);
    expect(p.enqueue(scope, event()).receipt).toBe(accepted.receipt);
    const other = { ...scope, tenant: "synthetic-b" }; p.grant(other); p.enqueue(other, event());
    p.withdraw(scope); expect(p.snapshot(scope).payloads).toBe(0);
    time += 1000;
    rejects(() => p.enqueue(other, event(1, "too-old")), 429);
    p.processOne(other); p.enqueue(other, event(1, "after-drain"));
  } finally { p.close(); }
});
test("schema, consent generation and contact safeguards fail closed without provider egress", () => {
  const p = new SyntheticPipeline(":memory:");
  try {
    p.grant(scope);
    rejects(() => p.enqueue({ ...scope, tenant: "real" }, event()), 403);
    rejects(() => p.enqueue(scope, { ...event(), synthetic: false } as unknown as SyntheticEvent), 400);
    rejects(() => p.enqueue(scope, { ...event(), generation: NaN }), 400);
    expect(() => p.enqueue(scope, { ...event(), text: "x".repeat(10001) })).toThrow();
    expect(p.snapshot(scope).states).toEqual([]);
    p.enqueue(scope, { ...event(), text: "Contact dummy@example.invalid about rent." });
    p.processOne(scope);
    expect(p.snapshot(scope)).toMatchObject({ states: [{ status: "held", count: 1 }], aggregates: [], payloads: 0 });
    expect(JSON.stringify(p.snapshot(scope))).not.toContain("dummy@example.invalid");
  } finally { p.close(); }
});

test("failed durable acceptance and contribution transactions leave no partial writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "she320-fault-"));
  const path = join(dir, "synthetic.sqlite");
  const p = new SyntheticPipeline(path);
  const faults = new Database(path);
  try {
    p.grant(scope);
    faults.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'injected disk failure'); END");
    expect(() => p.enqueue(scope, event())).toThrow("injected disk failure");
    expect(p.snapshot(scope).states).toEqual([]);
    faults.exec("DROP TRIGGER fail_audit");
    p.enqueue(scope, event());
    faults.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'injected commit failure'); END");
    expect(() => p.processOne(scope)).toThrow("injected commit failure");
    expect(p.snapshot(scope)).toMatchObject({ states: [{ status: "queued", count: 1 }], payloads: 1, aggregates: [] });
    expect(() => p.withdraw(scope)).toThrow("injected commit failure");
    expect(p.enqueue(scope, event()).duplicate).toBe(true);
    faults.exec("DROP TRIGGER fail_audit");
    expect(p.processOne(scope)).toBe(true);
    expect(p.snapshot(scope).aggregates.every(row => row.count === 1)).toBe(true);
  } finally { faults.close(); p.close(); rmSync(dir, { recursive: true, force: true }); }
});
