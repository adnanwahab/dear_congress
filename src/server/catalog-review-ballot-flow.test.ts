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

    for (const original of originalReviewBills) expect(review.ballotReview(original).reviewReady).toBe(false);
    expect(() => review.publish(auth('legal'), bill.id, { revision: bill.revision,
      jurisdiction: bill.jurisdiction, reason: 'Unauthorized publisher attempt.' })).toThrow('Authorized publisher');
    // Every category must be approved by a properly authenticated human reviewer.
    for (const category of categories) {
      expect(() => review.decide(auth("publisher"), bill.id, {
        revision: bill.revision, jurisdiction: bill.jurisdiction, category,
        decision: "approved", reason: "Reviewed source and scope.",
      })).toThrow("Reviewer authentication");
      expect(() => review.publish(auth('publisher'), bill.id, { revision: bill.revision,
        jurisdiction: bill.jurisdiction, reason: 'Missing required category must block.' })).toThrow('not approved');
      expect(() => review.decide(auth(category), bill.id, { revision: '0'.repeat(64),
        jurisdiction: bill.jurisdiction, category, decision: 'approved', reason: 'Mismatched source digest.' })).toThrow('Stale');
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
    expect(review.ballotReview({ ...bill, revision: 'f'.repeat(64) }).reviewReady).toBe(false);
    expect(review.ballotReview({ ...bill, jurisdiction: 'different jurisdiction' }).reviewReady).toBe(false);
    expect(review.publish(publisher, bill.id, { revision: bill.revision, jurisdiction: bill.jurisdiction,
      reason: 'Repeated publication readiness request.' }).id).toBe(attestation.id);
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

    // Exact publication retries and both databases survive restart without duplicating audit.
    expect(ballots.publish(bill.id, proposalWindow(), credentials[4]!.id).publicationId).toBe(publication.publicationId);
    ballots.close();
    review.close();
    review = new CatalogReviewStore(reviewPath, credentials);
    ballots = new CatalogBallotStore(ballotPath, { secret, now: () => start, reviews: b => review.ballotReview(b) });
    expect(ballots.status(bill.id, browser).ownChoice).toBe('unsure');
    expect(ballots.status(bill.id).state).toBe('open');
    expect(ballots.publish(bill.id, proposalWindow(), credentials[4]!.id).publicationId).toBe(publication.publicationId);
    expect(review.db.query('SELECT count(*) n FROM publication_decisions').get()).toMatchObject({ n: 1 });
    expect(() => review.db.exec('DELETE FROM publication_decisions')).toThrow('append-only');
    // Removing configured reviewers fails closed even with durable approved history.
    review.close();
    review = new CatalogReviewStore(reviewPath, []);
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    expect(ballots.status(bill.id).state).toBe('closed_or_stale');
    review.close();
    review = new CatalogReviewStore(reviewPath, credentials.filter(r => r.id !== credentials[4]!.id));
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    review.close();
    review = new CatalogReviewStore(reviewPath, credentials.filter(r => r.id !== credentials[0]!.id));
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    review.close();
    review = new CatalogReviewStore(reviewPath, credentials.map(r => r.id === credentials[0]!.id ? { ...r, roles: [] } : r));
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    review.close();
    review = new CatalogReviewStore(reviewPath, credentials);
    review.db.query('UPDATE reviewer_identities SET active=0 WHERE id=?').run(credentials[0]!.id);
    expect(review.reviewer(auth('legal'), 'legal')).toBeNull();
    expect(review.ballotReview(bill).reviewReady).toBe(false);
    review.db.query('UPDATE reviewer_identities SET active=1 WHERE id=?').run(credentials[0]!.id);

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


test('HFL-051 supplement and self-publishing remain blocked with authenticated fixtures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-separation-'));
  const combined = { ...credentials[0]!, roles: ['legal', 'publisher'] as ReviewRole[] };
  const review = new CatalogReviewStore(join(dir, 'review.sqlite'), [combined, ...credentials.slice(1)]);
  try {
    for (const category of categories) review.decide(auth(category), bill.id, {
      revision: bill.revision, jurisdiction: bill.jurisdiction, category, decision: 'approved', reason: 'Explicit test authenticated approval.' });
    expect(() => review.publish(auth('legal'), bill.id, { revision: bill.revision,
      jurisdiction: bill.jurisdiction, reason: 'Cannot attest my own approval.' })).toThrow('Separate human publisher');
    const supplement = originalReviewBills.find(b => b.id === 'HFL-051')!;
    expect(() => review.publish(auth('publisher'), supplement.id, { revision: supplement.revision,
      jurisdiction: supplement.jurisdiction, reason: 'Catalog digest excludes the supplement.' })).toThrow('supplement');
    expect(review.ballotReview(supplement).reviewReady).toBe(false);
  } finally { review.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('durable reviewer revocation survives restart and credential refresh without reopening ballots', () => {
  for (const role of ['legal', 'publisher'] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'review-revocation-restart-'));
    const reviewPath = join(dir, 'review.sqlite');
    let review = new CatalogReviewStore(reviewPath, credentials);
    const ballots = new CatalogBallotStore(join(dir, 'ballots.sqlite'), {
      secret, now: () => start, reviews: b => review.ballotReview(b),
    });
    try {
      for (const category of categories) review.decide(auth(category), bill.id, {
        revision: bill.revision, jurisdiction: bill.jurisdiction, category,
        decision: 'approved', reason: 'Explicitly authenticated isolated test fixture review.',
      });
      review.publish(auth('publisher'), bill.id, {revision: bill.revision,
        jurisdiction: bill.jurisdiction, reason: 'Test publisher checks four isolated fixture decisions.'});
      const publication = ballots.publish(bill.id, proposalWindow(), credentials[4]!.id);
      const browser = randomUUID();
      const input = {revision: bill.revision, publicationId: publication.publicationId,
        requestId: randomUUID(), choice: 'support'};
      ballots.cast(bill.id, input, browser);
      const revokedId = credentials.find(r => r.roles.includes(role))!.id;
      review.db.query('UPDATE reviewer_identities SET active=0 WHERE id=?').run(revokedId);
      expect(review.ballotReview(bill).reviewReady).toBe(false);
      for (const config of [credentials, credentials.map(r => r.id === revokedId
        ? {...r, token: 'rotated-isolated-test-token-'.repeat(3)} : r)]) {
        review.close();
        review = new CatalogReviewStore(reviewPath, config);
        const token = config.find(r => r.id === revokedId)!.token;
        expect(review.reviewer(new Request(origin, {headers:{authorization:'Bearer '+token}}), role)).toBeNull();
        expect(review.ballotReview(bill).reviewReady).toBe(false);
        expect(ballots.status(bill.id).state).toBe('closed_or_stale');
        expect(() => ballots.cast(bill.id, {...input, requestId:randomUUID(), choice:'oppose'}, browser))
          .toThrow('publication_not_authorized');
        expect(ballots.status(bill.id, browser).ownChoice).toBe('support');
        expect(review.db.query('SELECT count(*) n FROM review_decisions').get()).toMatchObject({n:4});
        expect(review.db.query('SELECT count(*) n FROM publication_decisions').get()).toMatchObject({n:1});
      }
    } finally {ballots.close(); review.close(); rmSync(dir,{recursive:true,force:true});}
  }
});

test('active credential rotation rejects old tokens and stale process authority while retaining decisions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-active-token-rotation-'));
  const path = join(dir, 'review.sqlite');
  const stale = new CatalogReviewStore(path, credentials);
  let rotated: CatalogReviewStore | undefined;
  try {
    stale.decide(auth('legal'), bill.id, { revision: bill.revision,
      jurisdiction: bill.jurisdiction, category: 'legal', decision: 'approved',
      reason: 'Isolated credential rotation acceptance fixture.' });
    const config = credentials.map(row => ({ ...row, token: randomUUID() + randomUUID() }));
    rotated = new CatalogReviewStore(path, config);
    for (const row of config) {
      const role = row.roles[0]!;
      expect(rotated.reviewer(auth(role), role)).toBeNull();
      expect(stale.reviewer(auth(role), role)).toBeNull();
      const request = new Request(origin, { headers: { authorization: 'Bearer ' + row.token } });
      expect(rotated.reviewer(request, role)?.id).toBe(row.id);
      expect(rotated.reviewer(request, role === 'publisher' ? 'legal' : 'publisher')).toBeNull();
    }
    expect(rotated.db.query('SELECT count(*) n FROM review_decisions').get()).toMatchObject({n:1});
    expect(rotated.ballotReview(bill).reviewReady).toBe(false);
    rotated.close();
    rotated = new CatalogReviewStore(path, config);
    expect(rotated.reviewer(auth('publisher'), 'publisher')).toBeNull();
    expect(rotated.db.query('SELECT count(*) n FROM review_decisions').get()).toMatchObject({n:1});
  } finally { rotated?.close(); stale.close(); rmSync(dir, {recursive:true, force:true}); }
});
