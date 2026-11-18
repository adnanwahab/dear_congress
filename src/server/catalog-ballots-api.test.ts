import { test, expect } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { billCollection, type CatalogBill } from "../shared/bill-catalog";
import { editorialGate, type EditorialReview } from "../shared/bill-editorial";
import { catalogBallotHandlers } from "./catalog-ballots-api";
import { CatalogBallotStore, type ReviewLookup } from "./catalog-ballots";

const id = "HFL-059", bill = billCollection.bills.find(b => b.id === id)!;
const origin = "https://civic.example";
const token = "test-admin-token-with-high-entropy-in-production";
const publisher = "Publisher: fixture human";
const secret = "stable-very-long-test-cookie-secret-2026";
const mockReview: ReviewLookup = (b: CatalogBill) => {
  const approval = { status: "approved", reviewer: "Human test reviewer", record: "fixture-review-record" };
  const row: EditorialReview = {
    id: b.id, revision: b.revision, jurisdiction: b.jurisdiction,
    author: "Test author", editor: "Test editor",
    legal: approval, evidence: approval, fiscal: approval, publication: approval,
  };
  return editorialGate(b, [row]);
};
const now = Date.parse("2026-11-18T15:00:00Z");
const body = {
  revision: bill.revision,
  opensAt: new Date(now - 30_000).toISOString(),
  closesAt: new Date(now + 60_000).toISOString(),
};
async function payload(response: Response) {
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}
function request(url: string, method: string, data?: unknown, headers: Record<string, string> = {}) {
  return new Request(origin + url, {
    method,
    headers: { ...(data !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
}

test("catalog HTTP publisher checks authorization and same origin before allowing a reviewed version", async () => {
  const directory = mkdtempSync(join(tmpdir(), "catalog-http-"));
  try {
    const store = new CatalogBallotStore(join(directory, "catalog.sqlite"), { secret, now: () => now, reviews: mockReview });
    const h = catalogBallotHandlers(store, { adminToken: token, publisherId: publisher, expectedOrigin: () => origin });
    const url = "/api/catalog-bills/" + id + "/publications";
    expect((await payload(await h.publish(request(url, "POST", body), id))).status).toBe(401);
    expect((await payload(await h.publish(request(url, "POST", body, { authorization: "Bearer " + token, origin: "https://evil.example" }), id))).status).toBe(403);
    const published = await payload(await h.publish(request(url, "POST", body, { authorization: "Bearer " + token, origin }), id));
    expect(published.status).toBe(200);
    expect(typeof published.body.publicationId).toBe("string");
    const status = await payload(await h.detail(request("/api/catalog-bills/" + id, "GET", undefined, { "x-voter-id": randomUUID() }), id));
    expect(status.body.state).toBe("open");
    expect(status.body.counts).toEqual({ support: 0, oppose: 0, unsure: 0, total: 0 });

    const fakeVisitor = randomUUID();
    const ballotBody = { revision: bill.revision, publicationId: published.body.publicationId, choice: "support", requestId: randomUUID() };
    const vote = await payload(await h.vote(request("/api/catalog-bills/" + id + "/ballot", "PUT", ballotBody, { "x-voter-id": fakeVisitor }), id));
    expect(vote.status).toBe(200);
    expect(vote.body.saved).toBe(true);
    const aggregates = await payload(await h.results(request("/api/catalog-bills/" + id + "/results", "GET"), id));
    expect(aggregates.body.counts).toEqual({ support: 1, oppose: 0, unsure: 0, total: 1 });
    expect(aggregates.body).not.toHaveProperty("ownChoice");
    store.close();
  } finally { rmSync(directory, { force: true, recursive: true }); }
});

test("production default review gate remains closed despite configured publisher credentials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "catalog-http-closed-"));
  try {
    const store = new CatalogBallotStore(join(directory, "catalog.sqlite"), { secret });
    const h = catalogBallotHandlers(store, { adminToken: token, publisherId: publisher, expectedOrigin: () => origin });
    const response = await payload(await h.publish(request("/api/catalog-bills/" + id + "/publications", "POST", body, { authorization: "Bearer " + token, origin }), id));
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("human_review_incomplete");
    expect((await payload(await h.results(request("/api/catalog-bills/" + id + "/results", "GET"), id))).body.counts).toBeNull();
    store.close();
  } finally { rmSync(directory, { force: true, recursive: true }); }
});
