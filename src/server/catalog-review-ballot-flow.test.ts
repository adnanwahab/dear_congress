import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { originalReviewBills } from "../shared/bill-catalog";
import { CatalogReviewStore, type ReviewRole } from "./catalog-review";
import { CatalogBallotStore } from "./catalog-ballots";
import { catalogBallotHandlers } from "./catalog-ballots-api";

const bill = originalReviewBills.find(b => b.id === "HFL-021")!;
const origin = "http://localhost:8000";
const secret = "isolated-durable-cookie-secret-for-catalog-integration";
const start = Date.parse("2026-11-18T15:00:00Z");
const categories = ["legal", "evidence", "fiscal", "editorial"] as const;
const credentials = [...categories, "publisher" as const].map(role => ({
  id: "reviewer-" + role, name: "Human " + role,
  token: (role + "-test-token-").repeat(4),
  roles: [role] as ReviewRole[],
}));
const auth = (role: ReviewRole) => new Request(origin, {
  headers: { authorization: "Bearer " + credentials.find(x => x.id === "reviewer-" + role)!.token },
});
const proposalWindow = () => ({
  revision: bill.revision,
  opensAt: new Date(start - 10_000).toISOString(),
  closesAt: new Date(start + 7 * 86_400_000).toISOString(),
});

test("review and ballot SQLite stores form a one-way, revision-locked approval flow", async () => {
  const dir = mkdtempSync(join(tmpdir(), "review-ballot-flow-"));
  const reviewPath = join(dir, "review.sqlite");
  const ballotPath = join(dir, "ballots.sqlite");
  const browser = randomUUID();
  let review = new CatalogReviewStore(reviewPath, credentials);
  let ballots = new CatalogBallotStore(ballotPath, {
    secret, now: () => start, reviews: b => review.ballotReview(b),
  });
  try {
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    expect(ballots.status(bill.id).state).toBe("awaiting_review");
    expect(() => ballots.publish(bill.id, proposalWindow(), "publisher")).toThrow("human_review_incomplete");

    // Public suggestions survive a restart, but cannot count as any expert approval.
    const finding = review.submit({ billId: bill.id, revision: bill.revision, jurisdiction: bill.jurisdiction,
      category: "legal", findings: "Please check the legal coverage and remedy definitions.",
      sources: ["https://example.org/authority"] });
    expect(finding.status).toBe("pending");
    expect(review.ballotReview(bill).reviewReady).toBe(false);

    // Early public responses can be saved immediately, without creating a ballot.
    const requestId = randomUUID();
    const draftInput = { revision: bill.revision, requestId, choice: "support" };
    const savedDraft = ballots.saveDraftChoice(bill.id, draftInput, browser);
    expect(savedDraft.saved).toBe(true);
    expect(savedDraft.kind).toBe("unpublished_draft_feedback");
    expect(ballots.saveDraftChoice(bill.id, draftInput, browser).replayed).toBe(true);
    expect(() => ballots.saveDraftChoice(bill.id, { ...draftInput, choice: "oppose" }, browser)).toThrow("idempotency_key_reused");
    expect(ballots.draftStatus(bill.id, browser).ownChoice).toBe("support");
    expect(ballots.status(bill.id).counts).toBeNull();
    ballots.close();
    review.close();
    review = new CatalogReviewStore(reviewPath, credentials);
    ballots = new CatalogBallotStore(ballotPath, {
      secret, now: () => start, reviews: b => review.ballotReview(b),
    });
    expect(ballots.draftStatus(bill.id, browser).counts.total).toBe(1);
    expect(review.queue().find(b => b.id === bill.id)?.submissions).toHaveLength(1);

    // Every category must be approved by a properly authenticated human reviewer.
    for (const category of categories) {
      expect(() => review.decide(auth("publisher"), bill.id, {
        revision: bill.revision, jurisdiction: bill.jurisdiction, category,
        decision: "approved", reason: "Reviewed source and scope.",
      })).toThrow("Reviewer authentication");
      review.decide(auth(category), bill.id, {
        revision: bill.revision, jurisdiction: bill.jurisdiction, category,
        decision: "approved", reason: "Reviewed source and scope.",
      });
    }
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    expect(ballots.status(bill.id).state).toBe("awaiting_review");
    const publisher = auth("publisher");
    const attestation = review.publish(publisher, bill.id, {
      revision: bill.revision, jurisdiction: bill.jurisdiction,
      reason: "All four human reviews have been checked for this exact revision.",
    });
    expect(attestation.status).toBe("review_ready");
    expect(review.ballotReview(bill).reviewReady).toBe(true);
    expect(ballots.status(bill.id).state).toBe("awaiting_publication");

    // The publisher role opens the actual advisory ballot; draft choices stay separate.
    const handlers = catalogBallotHandlers(ballots, {
      adminToken: "", publisherId: "", expectedOrigin: () => origin,
      publisherRole: req => review.reviewer(req, "publisher")?.id ?? null,
    });
    const path = origin + "/api/catalog-bills/" + bill.id + "/publications";
    const denied = await handlers.publish(new Request(path, { method: "POST",
      headers: { origin, authorization: "Bearer " + credentials[0]!.token,
        "content-type": "application/json" }, body: JSON.stringify(proposalWindow()) }), bill.id);
    expect(denied.status).toBe(401);
    const allowed = await handlers.publish(new Request(path, { method: "POST",
      headers: { origin, authorization: "Bearer " + credentials[4]!.token,
        "content-type": "application/json" }, body: JSON.stringify(proposalWindow()) }), bill.id);
    expect(allowed.status).toBe(200);
    const publication = await allowed.json() as { publicationId: string };
    expect(publication.publicationId).toBeTruthy();
    expect(ballots.status(bill.id, browser).state).toBe("open");
    expect(ballots.status(bill.id, browser).counts?.total).toBe(0);
    expect(ballots.draftStatus(bill.id, browser).counts.total).toBe(1);
    expect(ballots.draftStatus(bill.id, browser).state).toBe("closed");
    expect(() => ballots.saveDraftChoice(bill.id, {
      revision: bill.revision, requestId: randomUUID(), choice: "oppose",
    }, browser)).toThrow("draft_feedback_closed_after_publication");
    ballots.cast(bill.id, { revision: bill.revision, publicationId: publication.publicationId,
      requestId: randomUUID(), choice: "unsure" }, browser);
    expect(ballots.status(bill.id, browser).counts?.total).toBe(1);
    expect(ballots.status(bill.id, browser).ownChoice).toBe("unsure");

    // A later expert decision invalidates the exact review receipt and closes writes.
    review.decide(auth("legal"), bill.id, { revision: bill.revision, jurisdiction: bill.jurisdiction,
      category: "legal", decision: "changes_requested",
      reason: "New source disputes the earlier scope assessment." });
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    expect(ballots.status(bill.id, browser).state).toBe("closed_or_stale");
    expect(() => ballots.cast(bill.id, { revision: bill.revision,
      publicationId: publication.publicationId, requestId: randomUUID(), choice: "support" }, browser))
      .toThrow("publication_not_authorized");
    expect(ballots.status(bill.id, browser).counts?.total).toBe(1);
  } finally {
    ballots.close();
    review.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
