import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { billCollection } from "../shared/bill-catalog";
import { CatalogBallotStore } from "./catalog-ballots";
import { catalogBallotHandlers } from "./catalog-ballots-api";

const secret = "test-catalog-amendment-cookie-secret-is-very-long";
const first = billCollection.bills.find(b => b.id === "HFL-042")!;
const other = billCollection.bills.find(b => b.id === "HFL-021")!;
const visitorA = randomUUID(), visitorB = randomUUID();
const origin = "https://civic.example";
const text = "Include part-time workers and publish clear minimum sick-time accrual rules.";
const sample = (requestId = randomUUID(), body = text) =>
  ({ revision: first.revision, requestId, text: body, confirmForReview: true });
const setup = (fn: (path: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-amendments-"));
  try { fn(join(dir, "catalog.sqlite")); }
  finally { rmSync(dir, { force: true, recursive: true }); }
};

test("amendments are saved for review, revision-bound, idempotent, private and durable", () => setup(path => {
  let store = new CatalogBallotStore(path, { secret });
  const payload = sample();
  try {
    expect(store.ownAmendments(first.id, visitorA).amendments).toHaveLength(0);
    const created = store.submitAmendment(first.id, payload, visitorA);
    expect(created.saved).toBe(true);
    expect(created.replayed).toBe(false);
    expect(created.amendment.status).toBe("pending_review");
    expect(created.amendment.text).toBe(text);
    expect(created.amendment.revision).toBe(first.revision);
    expect(created.amendment.jurisdiction).toBe(first.jurisdiction);
    expect(created.receipt.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.submitAmendment(first.id, payload, visitorA).receipt.id).toBe(created.receipt.id);
    expect(() => store.submitAmendment(first.id, sample(payload.requestId, text + " Extra."), visitorA))
      .toThrow("idempotency_key_reused");
    expect(store.ownAmendments(first.id, visitorB).amendments).toHaveLength(0);
    expect(store.ownAmendments(other.id, visitorA).amendments).toHaveLength(0);
    expect(store.pendingAmendmentsForReviewer(first.id).map(x => x.id)).toEqual([created.amendment.id]);
    expect(store.status(first.id).counts).toBeNull();
    expect(store.draftStatus(first.id).counts.total).toBe(0);
    expect((store.db.query("SELECT COUNT(*) n FROM catalog_publications").get() as {n:number}).n).toBe(0);
    const row = store.db.query("SELECT owner_hash,body,body_hash FROM catalog_amendments").get() as {
      owner_hash: string; body: string; body_hash: string;
    };
    expect(row.owner_hash).not.toBe(visitorA);
    expect(row.owner_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.body).toBe(text);
    expect(row.body_hash).toMatch(/^[a-f0-9]{64}$/);
    store.close();
    store = new CatalogBallotStore(path, { secret });
    const restored = store.ownAmendments(first.id, visitorA).amendments;
    expect(restored).toHaveLength(1);
    expect(restored[0]!.id).toBe(created.amendment.id);
    expect(restored[0]!.text).toBe(text);
    expect(store.submitAmendment(first.id, payload, visitorA).replayed).toBe(true);
  } finally { store.close(); }
}));

test("withdrawal requires the originating browser and scrubs the private text", () => setup(path => {
  const store = new CatalogBallotStore(path, { secret });
  try {
    const saved = store.submitAmendment(first.id, sample(), visitorA);
    const id = saved.amendment.id;
    const withdrawal = { revision: first.revision, requestId: randomUUID() };
    expect(() => store.withdrawAmendment(first.id, id, withdrawal, visitorB)).toThrow("amendment_not_found");
    expect(() => store.withdrawAmendment(other.id, id, withdrawal, visitorA)).toThrow("amendment_not_found");
    expect(() => store.withdrawAmendment(first.id, id, { ...withdrawal, revision: other.revision }, visitorA))
      .toThrow("stale_amendment_revision");
    const removed = store.withdrawAmendment(first.id, id, withdrawal, visitorA);
    expect(removed.saved).toBe(true);
    expect(removed.replayed).toBe(false);
    expect(store.withdrawAmendment(first.id, id, withdrawal, visitorA).receipt.id).toBe(removed.receipt.id);
    expect(store.withdrawAmendment(first.id, id, { ...withdrawal, requestId: randomUUID() }, visitorA).replayed).toBe(true);
    expect(store.pendingAmendmentsForReviewer(first.id)).toHaveLength(0);
    expect(store.ownAmendments(first.id, visitorA).amendments).toMatchObject([{ id, text: "", status: "withdrawn" }]);
    const record = store.db.query("SELECT body,body_hash,withdrawn_at FROM catalog_amendments WHERE id=?")
      .get(id) as { body: string; body_hash: string; withdrawn_at: number | null };
    expect(record.body).toBe("");
    expect(record.body_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(record.withdrawn_at).not.toBeNull();
    const events = store.db.query("SELECT action FROM catalog_amendment_events WHERE amendment_id=? ORDER BY rowid")
      .all(id) as { action: string }[];
    expect(events.map(x => x.action)).toEqual(["submit", "withdraw"]);
  } finally { store.close(); }
}));

test("amendment input validation, privacy and stale revisions fail closed", () => setup(path => {
  const store = new CatalogBallotStore(path, { secret });
  try {
    for (const bad of [
      { ...sample(), revision: "stale" },
      { ...sample(), confirmForReview: false },
      { ...sample(), text: "too short" },
      { ...sample(), text: "x".repeat(4001) },
      { ...sample(), text: "First line with an invalid\u0000control character." },
      { ...sample(), requestId: "not-a-uuid" },
      { ...sample(), copiedJournalText: "private" },
    ]) expect(() => store.submitAmendment(first.id, bad, visitorA)).toThrow();
    expect(() => store.submitAmendment(first.id, sample(), "spoofed")).toThrow("browser_identity_required");
    expect(() => store.submitAmendment("HFL-999", sample(), visitorA)).toThrow("catalog_bill_not_found");
    expect((store.db.query("SELECT COUNT(*) n FROM catalog_amendments").get() as {n:number}).n).toBe(0);
    expect((store.db.query("SELECT COUNT(*) n FROM catalog_amendment_events").get() as {n:number}).n).toBe(0);
    for (let i=0; i<20; i++) store.submitAmendment(first.id, sample(), visitorA);
    expect(() => store.submitAmendment(first.id, sample(), visitorA)).toThrow("active_amendment_limit_reached");
    expect(store.ownAmendments(first.id, visitorA).amendments).toHaveLength(20);
  } finally { store.close(); }
}));

test("HTTP adapter only returns own amendments and rejects spoofed writes without origin", async () => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-amendments-http-"));
  const store = new CatalogBallotStore(join(dir, "catalog.sqlite"), { secret });
  const api = catalogBallotHandlers(store, {
    adminToken: "", publisherId: "", expectedOrigin: () => origin,
  });
  const target = origin + "/api/catalog-bills/" + first.id + "/amendments";
  const req = (method: string, body?: unknown, headers: Record<string,string> = {}) =>
    new Request(target, { method, headers: { ...(body ? {"content-type":"application/json"} : {}), ...headers },
      ...(body ? {body:JSON.stringify(body)} : {}) });
  try {
    const unauthorized = await api.amendments(req("GET"), first.id);
    expect(unauthorized.status).toBe(401);
    const publicNoOrigin = await api.submitAmendment(req("POST", sample(), {
      "x-voter-id": visitorA,
    }), first.id);
    expect(publicNoOrigin.status).toBe(403);
    const badOrigin = await api.submitAmendment(req("POST", sample(), {
      origin: "https://evil.example", "x-voter-id": visitorA,
    }), first.id);
    expect(badOrigin.status).toBe(403);
    const created = await api.submitAmendment(req("POST", sample(), {
      origin, "x-voter-id": visitorA,
    }), first.id);
    expect(created.status).toBe(200);
    const save = await created.json() as { saved: boolean; amendment: { id: string }; receipt: { id: string } };
    expect(save.saved).toBe(true);
    expect(save.receipt.id).toBeTruthy();
    expect((await (await api.amendments(req("GET", undefined, {"x-voter-id":visitorA}), first.id)).json() as {
      amendments: unknown[];
    }).amendments).toHaveLength(1);
    expect((await (await api.amendments(req("GET", undefined, {"x-voter-id":visitorB}), first.id)).json() as {
      amendments: unknown[];
    }).amendments).toHaveLength(0);
    const withdrawal = new Request(target + "/" + save.amendment.id + "/withdraw", {
      method: "POST", headers: { origin, "x-voter-id": visitorA, "content-type": "application/json" },
      body: JSON.stringify({ revision: first.revision, requestId: randomUUID() }),
    });
    const result = await api.withdrawAmendment(withdrawal, first.id, save.amendment.id);
    expect(result.status).toBe(200);
    expect((await result.json() as { saved: boolean }).saved).toBe(true);
    expect((await (await api.amendments(req("GET", undefined, {"x-voter-id":visitorA}), first.id)).json() as {
      amendments: Array<{status:string}>;
    }).amendments[0]?.status).toBe("withdrawn");
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
