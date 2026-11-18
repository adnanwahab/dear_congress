import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { billCollection, type CatalogBill } from "../shared/bill-catalog";
import { editorialGate, type EditorialReview } from "../shared/bill-editorial";
import { CatalogBallotError, CatalogBallotStore, type ReviewLookup } from "./catalog-ballots";

const secret = "test-cookie-secret-is-stable-for-restart-check";
const browser1 = randomUUID(), browser2 = randomUUID();
const bill = billCollection.bills.find(b => b.id === "HFL-059")!;
const activeReview = (b: CatalogBill): EditorialReview => {
  const approved = { status: "approved", reviewer: "Test reviewer", record: "tests/fixture-reviewed-record.md" };
  return { id: b.id, revision: b.revision, jurisdiction: b.jurisdiction,
    author: "Test author", editor: "Test editor",
    legal: approved, evidence: approved, fiscal: approved, publication: approved };
};
const reviews: ReviewLookup = b => editorialGate(b, [activeReview(b)]);
const start = Date.parse("2026-11-18T12:00:00Z");
const window = () => ({
  revision: bill.revision,
  opensAt: new Date(start + 119_000).toISOString(),
  closesAt: new Date(start + 60 * 60_000).toISOString(),
});
function tempDb(run: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "catalog-ballots-"));
  try { run(join(dir, "catalog.sqlite")); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const make = (path: string, opts: { reviews?: ReviewLookup; now?: () => number } = {}) =>
  new CatalogBallotStore(path, { secret, now: opts.now ?? (() => start + 120_000), reviews: opts.reviews });
const errorCode = (run: () => unknown, code: string) =>
  expect(run).toThrow(new RegExp(code));

test("initial 100-bill catalog cannot publish or accept votes; counts are not invented", () => tempDb(path => {
  const store = make(path);
  for (const b of billCollection.bills) {
    const state = store.status(b.id);
    expect(state.state).toBe("awaiting_review");
    expect(state.counts).toBeNull();
  }
  errorCode(() => store.publish(bill.id, window(), "Human publisher"), "human_review_incomplete");
  errorCode(() => store.cast(bill.id, { revision: bill.revision, publicationId: randomUUID(), requestId: randomUUID(), choice: "support" }, browser1), "publication_revision_mismatch");
  expect((store.db.query("SELECT count(*) n FROM catalog_publications").get() as {n:number}).n).toBe(0);
  store.close();
}));

test("verified exact revision, admin-authorized publish, separate browser ballots, and durable receipts", () => tempDb(path => {
  let store = make(path, { reviews });
  errorCode(() => store.publish(bill.id, { ...window(), revision: "stale" }, "Human publisher"), "stale_catalog_revision");
  errorCode(() => store.publish(bill.id, window(), ""), "authorized_publisher_required");
  const publication = store.publish(bill.id, window(), "Human publisher");
  expect(store.status(bill.id, browser1).state).toBe("open");
  expect(store.status(bill.id, browser1).counts?.total).toBe(0);
  errorCode(() => store.publish(bill.id, window(), "Human publisher"), "revision_already_published");
  const requestId = randomUUID();
  const body = { publicationId: publication.publicationId, revision: bill.revision, requestId, choice: "support" };
  const first = store.cast(bill.id, body, browser1);
  expect(first.saved).toBe(true);
  expect(first.replayed).toBe(false);
  expect(first.receipt.choice).toBe("support");
  expect(store.cast(bill.id, body, browser1).replayed).toBe(true);
  errorCode(() => store.cast(bill.id, { ...body, choice: "oppose" }, browser1), "idempotency_key_reused");
  store.cast(bill.id, { ...body, requestId: randomUUID(), choice: "oppose" }, browser2);
  expect(store.status(bill.id, browser1).counts).toEqual({ support: 1, oppose: 1, unsure: 0, total: 2 });
  expect(store.status(bill.id, browser1).ownChoice).toBe("support");
  expect(store.status(bill.id, browser2).ownChoice).toBe("oppose");
  store.close();

  store = make(path, { reviews });
  expect(store.status(bill.id, browser1).ownChoice).toBe("support");
  expect(store.cast(bill.id, body, browser1).replayed).toBe(true);
  store.cast(bill.id, { ...body, requestId: randomUUID(), choice: "unsure" }, browser1);
  expect(store.status(bill.id, browser1).counts).toEqual({ support: 0, oppose: 1, unsure: 1, total: 2 });
  store.cast(bill.id, { ...body, requestId: randomUUID(), choice: null }, browser1);
  expect(store.status(bill.id, browser1).ownChoice).toBeNull();
  expect(store.status(bill.id, browser1).counts).toEqual({ support: 0, oppose: 1, unsure: 0, total: 1 });
  expect((store.db.query("SELECT count(*) n FROM catalog_ballot_events").get() as {n:number}).n).toBe(4);
  const recorded = store.db.query("SELECT voter_hash FROM catalog_ballot_events LIMIT 1").get() as { voter_hash: string };
  expect(recorded.voter_hash).not.toBe(browser1);
  expect(recorded.voter_hash).toMatch(/^[0-9a-f]{64}$/);
  store.close();
}));

test("published ballot is closed immediately if the review record is revoked, and old receipts remain", () => tempDb(path => {
  let approved = true;
  const source: ReviewLookup = b => approved ? reviews(b) : editorialGate(b);
  const store = make(path, { reviews: source });
  const pub = store.publish(bill.id, window(), "Human publisher");
  store.cast(bill.id, { revision: bill.revision, publicationId: pub.publicationId, requestId: randomUUID(), choice: "support" }, browser1);
  approved = false;
  expect(store.status(bill.id, browser1).state).toBe("closed_or_stale");
  errorCode(() => store.cast(bill.id, { revision: bill.revision, publicationId: pub.publicationId, requestId: randomUUID(), choice: "oppose" }, browser1), "publication_not_authorized");
  expect(store.status(bill.id, browser1).counts?.total).toBe(1);
  store.close();
}));

test("window, snapshot and identity checks fail closed", () => tempDb(path => {
  const early = make(path, { reviews, now: () => start - 30_000 });
  const pub = early.publish(bill.id, window(), "Human publisher");
  const cast = (requestId: string, choice: unknown, user: string = browser1) =>
    early.cast(bill.id, { revision: bill.revision, publicationId: pub.publicationId, requestId, choice }, user);
  expect(early.status(bill.id).state).toBe("scheduled");
  errorCode(() => cast(randomUUID(), "support"), "voting_window_closed");
  errorCode(() => cast(randomUUID(), "invalid"), "invalid_advisory_choice");
  errorCode(() => cast(randomUUID(), "support", "forged"), "browser_identity_required");
  errorCode(() => early.cast(bill.id, { revision: "stale", publicationId: pub.publicationId, requestId: randomUUID(), choice: "support" }, browser1), "stale_catalog_revision");
  early.close();
  const late = make(path, { reviews, now: () => start + 61 * 60_000 });
  expect(late.status(bill.id).state).toBe("ended");
  errorCode(() => late.cast(bill.id, { revision: bill.revision, publicationId: pub.publicationId, requestId: randomUUID(), choice: "support" }, browser1), "voting_window_closed");
  late.close();
}));

test("an unreviewed separate legislative supplement cannot be published as reviewed text", () => tempDb(path => {
  const store = make(path, { reviews });
  const supplement = billCollection.bills.find(b => b.id === "HFL-051")!;
  errorCode(() => store.publish(supplement.id, { ...window(), revision: supplement.revision }, "Human publisher"), "separate_supplement_review_required");
  store.close();
}));

test("unknown bills and mismatched publication references cannot create ballot rows", () => tempDb(path => {
  const store = make(path, { reviews });
  const publication = store.publish(bill.id, window(), "Human publisher");
  const wrong = { revision: bill.revision, publicationId: randomUUID(), requestId: randomUUID(), choice: "support" };
  errorCode(() => store.cast(bill.id, wrong, browser1), "publication_revision_mismatch");
  errorCode(() => store.status("HFL-999"), "catalog_bill_not_found");
  expect((store.db.query("SELECT count(*) n FROM catalog_current_ballots").get() as { n: number }).n).toBe(0);
  expect(store.status(bill.id).publication?.id).toBe(publication.publicationId);
  store.close();
}));
