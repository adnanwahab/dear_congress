/** Revision-bound catalog participation, isolated from citizen and GitHub votes. */
import { Database } from "bun:sqlite";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { billCollection, type CatalogBill } from "../shared/bill-catalog";
import { editorialGate, type EditorialReview } from "../shared/bill-editorial";

export class CatalogBallotError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
/** Version-pinned, human-attested approval snapshot from the review SQLite store. */
export type DatabaseReviewSnapshot = {
  id: string; revision: string; jurisdiction: string;
  provenance: "catalog_review_sqlite_v1"; publicationDecisionId: string;
  approvals: Array<{ id: string; category: string; reviewerId: string; recordedAt: string }>;
};
type Gate = { reviewReady: boolean; review?: EditorialReview | DatabaseReviewSnapshot };
export type ReviewLookup = (bill: CatalogBill) => Gate;
export type AdvisoryChoice = "support" | "oppose" | "unsure";
type PublicationRow = {
  id: string; bill_id: string; revision: string; jurisdiction: string;
  source_snapshot: string; review_snapshot: string; publisher: string;
  opened_at: number; closes_at: number; published_at: number; state: "open" | "closed";
};
type EventRow = { id: string; payload_hash: string; choice: string | null; created_at: number };
type AmendmentRow = {
  id: string; bill_id: string; revision: string; jurisdiction: string;
  owner_hash: string; body: string; body_hash: string;
  status: "pending_review" | "withdrawn"; request_id: string;
  created_at: number; withdrawn_at: number | null;
};
function amendmentView(row: AmendmentRow) {
  return {
    id: row.id, billId: row.bill_id, revision: row.revision,
    jurisdiction: row.jurisdiction,
    text: row.status === "pending_review" ? row.body : "",
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    withdrawnAt: row.withdrawn_at === null ? null : new Date(row.withdrawn_at).toISOString(),
  };
}
const hex = /^[0-9a-f]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MINUTE = 60_000;
const DAY = 86_400_000;
function getBill(id: string): CatalogBill {
  const bill = billCollection.bills.find(b => b.id === id);
  if (!bill) throw new CatalogBallotError(404, "catalog_bill_not_found");
  if (!hex.test(bill.revision)) throw new CatalogBallotError(409, "invalid_catalog_revision");
  return bill;
}
function date(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))
    throw new CatalogBallotError(400, "utc_timestamp_required");
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new CatalogBallotError(400, "invalid_timestamp");
  return result;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CatalogBallotError(400, "json_object_required");
  return value as Record<string, unknown>;
}
/**
 * Pilot uses a single-writer durable SQLite store. The production review source
 * must supply a genuinely reviewed record; the default reads the existing
 * fail-closed JSON ledger. Never interpret a browser preference as an approval.
 */
export class CatalogBallotStore {
  readonly db: Database;
  private readonly secret: string;
  private readonly now: () => number;
  private readonly reviews: ReviewLookup;
  constructor(path: string, options: { secret: string; now?: () => number; reviews?: ReviewLookup }) {
    if (!options.secret || options.secret.length < 32)
      throw new Error("Catalog ballots require a stable 32+ character cookie secret");
    this.secret = options.secret;
    this.now = options.now ?? Date.now;
    this.reviews = options.reviews ?? (bill => editorialGate(bill));
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec([
      "PRAGMA journal_mode=WAL;",
      "PRAGMA busy_timeout=5000;",
      "PRAGMA foreign_keys=ON;",
      "CREATE TABLE IF NOT EXISTS catalog_publications(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL,revision TEXT NOT NULL,jurisdiction TEXT NOT NULL,source_snapshot TEXT NOT NULL,review_snapshot TEXT NOT NULL,publisher TEXT NOT NULL,opened_at INTEGER NOT NULL,closes_at INTEGER NOT NULL,published_at INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('open','closed')),UNIQUE(bill_id,revision));",
      "CREATE INDEX IF NOT EXISTS catalog_publications_by_bill ON catalog_publications(bill_id,published_at DESC);",
      "CREATE TABLE IF NOT EXISTS catalog_current_ballots(publication_id TEXT NOT NULL REFERENCES catalog_publications(id),voter_hash TEXT NOT NULL,choice TEXT NOT NULL CHECK(choice IN ('support','oppose','unsure')),changed_at INTEGER NOT NULL,PRIMARY KEY(publication_id,voter_hash));",
      "CREATE TABLE IF NOT EXISTS catalog_ballot_events(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES catalog_publications(id),voter_hash TEXT NOT NULL,choice TEXT CHECK(choice IN ('support','oppose','unsure') OR choice IS NULL),request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(publication_id,voter_hash,request_id));",
      "CREATE INDEX IF NOT EXISTS catalog_ballot_events_history ON catalog_ballot_events(publication_id,voter_hash,created_at);",
      "CREATE TABLE IF NOT EXISTS catalog_publication_audit(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES catalog_publications(id),action TEXT NOT NULL CHECK(action IN ('publish','supersede')),actor TEXT NOT NULL,created_at INTEGER NOT NULL);",
      "CREATE TABLE IF NOT EXISTS catalog_draft_choices(bill_id TEXT NOT NULL,revision TEXT NOT NULL,voter_hash TEXT NOT NULL,choice TEXT NOT NULL CHECK(choice IN ('support','oppose','unsure')),changed_at INTEGER NOT NULL,PRIMARY KEY(bill_id,revision,voter_hash));",
      "CREATE TABLE IF NOT EXISTS catalog_draft_choice_events(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL,revision TEXT NOT NULL,voter_hash TEXT NOT NULL,choice TEXT CHECK(choice IN ('support','oppose','unsure') OR choice IS NULL),request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(bill_id,revision,voter_hash,request_id));",
      "CREATE TABLE IF NOT EXISTS catalog_amendments(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL,revision TEXT NOT NULL,jurisdiction TEXT NOT NULL,owner_hash TEXT NOT NULL,body TEXT NOT NULL,body_hash TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending_review','withdrawn')),request_id TEXT NOT NULL,created_at INTEGER NOT NULL,withdrawn_at INTEGER,UNIQUE(bill_id,revision,owner_hash,request_id));",
      "CREATE INDEX IF NOT EXISTS catalog_amendments_queue ON catalog_amendments(bill_id,revision,status,created_at DESC);",
      "CREATE TABLE IF NOT EXISTS catalog_amendment_events(id TEXT PRIMARY KEY,amendment_id TEXT NOT NULL REFERENCES catalog_amendments(id),actor_hash TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN ('submit','withdraw')),request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(amendment_id,action,request_id));",
    ].join("\n"));
  }
  close() { this.db.close(); }
  private atomic<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private voterHash(id: string): string {
    if (!uuid.test(id)) throw new CatalogBallotError(401, "browser_identity_required");
    return createHmac("sha256", this.secret).update("catalog-ballot:v1:" + id).digest("hex");
  }
  private latest(billId: string): PublicationRow | null {
    return (this.db.query("SELECT * FROM catalog_publications WHERE bill_id=? ORDER BY published_at DESC, id DESC LIMIT 1").get(billId) as PublicationRow | null) ?? null;
  }
  private eligible(bill: CatalogBill, pub: PublicationRow): boolean {
    if (pub.state !== "open" || pub.revision !== bill.revision || pub.jurisdiction !== bill.jurisdiction) return false;
    const gate = this.reviews(bill);
    return !!gate.reviewReady && !!gate.review && JSON.stringify(gate.review) === pub.review_snapshot;
  }
  private choice(publicationId: string, hash: string): AdvisoryChoice | null {
    const r = this.db.query("SELECT choice FROM catalog_current_ballots WHERE publication_id=? AND voter_hash=?").get(publicationId, hash) as { choice: AdvisoryChoice } | null;
    return r?.choice ?? null;
  }
  /** Browser-specific ownChoice makes every status response private and uncached. */
  status(id: string, browserId?: string) {
    const bill = getBill(id), pub = this.latest(id), gate = this.reviews(bill);
    if (!pub) return {
      billId: id, revision: bill.revision, state: gate.reviewReady ? "awaiting_publication" : "awaiting_review",
      publication: null, counts: null, ownChoice: null,
      electorate: "unverified_browser_identities" as const, binding: false as const,
    };
    const t = this.now();
    const state = !this.eligible(bill, pub) ? "closed_or_stale" : t < pub.opened_at ? "scheduled" : t >= pub.closes_at ? "ended" : "open";
    const counts = { support: 0, oppose: 0, unsure: 0 };
    const rows = this.db.query("SELECT choice,COUNT(*) AS total FROM catalog_current_ballots WHERE publication_id=? GROUP BY choice").all(pub.id) as { choice: AdvisoryChoice; total: number }[];
    for (const row of rows) counts[row.choice] = row.total;
    return {
      billId: id, revision: pub.revision, state,
      publication: { id: pub.id, revision: pub.revision, opensAt: new Date(pub.opened_at).toISOString(), closesAt: new Date(pub.closes_at).toISOString(), publishedAt: new Date(pub.published_at).toISOString() },
      counts: { ...counts, total: counts.support + counts.oppose + counts.unsure },
      ownChoice: browserId ? this.choice(pub.id, this.voterHash(browserId)) : null,
      electorate: "unverified_browser_identities" as const, binding: false as const,
    };
  }

  /**
   * Early feedback is a distinct, revision-bound participation lane. It can be
   * submitted before publication but must never be transferred into ballots.
   */
  draftStatus(id: string, browserId?: string) {
    const bill = getBill(id);
    const counts = { support: 0, oppose: 0, unsure: 0 };
    const rows = this.db.query(
      "SELECT choice,COUNT(*) AS total FROM catalog_draft_choices WHERE bill_id=? AND revision=? GROUP BY choice"
    ).all(id, bill.revision) as { choice: AdvisoryChoice; total: number }[];
    for (const row of rows) counts[row.choice] = row.total;
    const hash = browserId ? this.voterHash(browserId) : null;
    const own = hash ? this.db.query(
      "SELECT choice FROM catalog_draft_choices WHERE bill_id=? AND revision=? AND voter_hash=?"
    ).get(id, bill.revision, hash) as { choice: AdvisoryChoice } | null : null;
    return {
      billId: id, revision: bill.revision,
      state: this.latest(id)?.revision === bill.revision ? "closed" as const : "accepting" as const,
      counts: { ...counts, total: counts.support + counts.oppose + counts.unsure },
      ownChoice: own?.choice ?? null,
      electorate: "unverified_browser_identities" as const,
      kind: "unpublished_draft_feedback" as const, binding: false as const,
    };
  }
  saveDraftChoice(id: string, payload: unknown, browserId: string) {
    const bill = getBill(id), body = object(payload);
    if (body.revision !== bill.revision)
      throw new CatalogBallotError(409, "stale_catalog_revision");
    const choice = body.choice;
    if (choice !== null && choice !== "support" && choice !== "oppose" && choice !== "unsure")
      throw new CatalogBallotError(400, "invalid_advisory_choice");
    const requestId = body.requestId;
    if (typeof requestId !== "string" || !uuid.test(requestId))
      throw new CatalogBallotError(400, "uuid_request_id_required");
    const voter = this.voterHash(browserId);
    const hash = createHash("sha256").update(JSON.stringify([id, bill.revision, choice])).digest("hex");
    return this.atomic(() => {
      const old = this.db.query(
        "SELECT id,payload_hash,choice,created_at FROM catalog_draft_choice_events WHERE bill_id=? AND revision=? AND voter_hash=? AND request_id=?"
      ).get(id, bill.revision, voter, requestId) as EventRow | null;
      if (old) {
        if (old.payload_hash !== hash) throw new CatalogBallotError(409, "idempotency_key_reused");
        return { saved: true, replayed: true, kind: "unpublished_draft_feedback" as const, receipt: {
          id: old.id, revision: bill.revision, choice: old.choice, recordedAt: new Date(old.created_at).toISOString(),
        } };
      }
      if (this.latest(id)?.revision === bill.revision)
        throw new CatalogBallotError(409, "draft_feedback_closed_after_publication");
      const now = this.now();
      if (choice === null)
        this.db.query("DELETE FROM catalog_draft_choices WHERE bill_id=? AND revision=? AND voter_hash=?").run(id, bill.revision, voter);
      else
        this.db.query(
          "INSERT INTO catalog_draft_choices VALUES(?,?,?,?,?) ON CONFLICT(bill_id,revision,voter_hash) DO UPDATE SET choice=excluded.choice,changed_at=excluded.changed_at"
        ).run(id, bill.revision, voter, choice, now);
      const receiptId = randomUUID();
      this.db.query("INSERT INTO catalog_draft_choice_events VALUES(?,?,?,?,?,?,?,?)").run(
        receiptId, id, bill.revision, voter, choice, requestId, hash, now
      );
      return { saved: true, replayed: false, kind: "unpublished_draft_feedback" as const, receipt: {
        id: receiptId, revision: bill.revision, choice, recordedAt: new Date(now).toISOString(),
      } };
    });
  }

  /**
   * An amendment is an optional, private pending review submission, not a
   * modification to the source catalog, a verified expert decision, or a vote.
   * Author identity is derived only from the signed browser cookie.
   */
  ownAmendments(id: string, browserId: string) {
    const bill = getBill(id), owner = this.voterHash(browserId);
    const rows = this.db.query(
      "SELECT * FROM catalog_amendments WHERE bill_id=? AND revision=? AND owner_hash=? ORDER BY created_at DESC, id DESC LIMIT 100"
    ).all(bill.id, bill.revision, owner) as AmendmentRow[];
    return {
      billId: bill.id, revision: bill.revision,
      visibility: "reviewers_only" as const,
      amendments: rows.map(amendmentView),
    };
  }

  /** Never expose this unmoderated queue through public endpoints. */
  pendingAmendmentsForReviewer(id: string) {
    const bill = getBill(id);
    const rows = this.db.query(
      "SELECT * FROM catalog_amendments WHERE bill_id=? AND revision=? AND status='pending_review' ORDER BY created_at DESC, id DESC LIMIT 100"
    ).all(bill.id, bill.revision) as AmendmentRow[];
    return rows.map(amendmentView);
  }

  submitAmendment(id: string, input: unknown, browserId: string) {
    const bill = getBill(id), body = object(input);
    if (Object.keys(body).some(key => !["revision", "text", "requestId", "confirmForReview"].includes(key)))
      throw new CatalogBallotError(400, "unsupported_amendment_field");
    if (body.revision !== bill.revision)
      throw new CatalogBallotError(409, "stale_catalog_revision");
    if (body.confirmForReview !== true)
      throw new CatalogBallotError(400, "review_submission_consent_required");
    if (typeof body.text !== "string")
      throw new CatalogBallotError(400, "amendment_text_required");
    const text = body.text.trim();
    if (text.length < 20 || text.length > 4000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))
      throw new CatalogBallotError(400, "amendment_text_must_be_20_to_4000_characters");
    if (typeof body.requestId !== "string" || !uuid.test(body.requestId))
      throw new CatalogBallotError(400, "uuid_request_id_required");
    const owner = this.voterHash(browserId);
    const payloadHash = createHash("sha256").update(JSON.stringify([bill.id, bill.revision, text])).digest("hex");
    return this.atomic(() => {
      const previous = this.db.query(
        "SELECT * FROM catalog_amendments WHERE bill_id=? AND revision=? AND owner_hash=? AND request_id=?"
      ).get(bill.id, bill.revision, owner, body.requestId) as AmendmentRow | null;
      if (previous) {
        if (previous.body_hash !== payloadHash)
          throw new CatalogBallotError(409, "idempotency_key_reused");
        const event = this.db.query(
          "SELECT id,created_at FROM catalog_amendment_events WHERE amendment_id=? AND action='submit' LIMIT 1"
        ).get(previous.id) as { id: string; created_at: number };
        return { saved: true, replayed: true,
          amendment: amendmentView(previous),
          receipt: { id: event.id, recordedAt: new Date(event.created_at).toISOString() } };
      }
      const active = this.db.query(
        "SELECT COUNT(*) AS n FROM catalog_amendments WHERE bill_id=? AND revision=? AND owner_hash=? AND status='pending_review'"
      ).get(bill.id, bill.revision, owner) as { n: number };
      if (active.n >= 20)
        throw new CatalogBallotError(409, "active_amendment_limit_reached");
      const id = randomUUID(), eventId = randomUUID(), now = this.now();
      this.db.query(
        "INSERT INTO catalog_amendments (id,bill_id,revision,jurisdiction,owner_hash,body,body_hash,status,request_id,created_at,withdrawn_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL)"
      ).run(id, bill.id, bill.revision, bill.jurisdiction, owner, text, payloadHash, "pending_review", body.requestId, now);
      this.db.query(
        "INSERT INTO catalog_amendment_events (id,amendment_id,actor_hash,action,request_id,payload_hash,created_at) VALUES (?,?,?,?,?,?,?)"
      ).run(eventId, id, owner, "submit", body.requestId, payloadHash, now);
      const saved = this.db.query("SELECT * FROM catalog_amendments WHERE id=?").get(id) as AmendmentRow;
      return { saved: true, replayed: false,
        amendment: amendmentView(saved),
        receipt: { id: eventId, recordedAt: new Date(now).toISOString() } };
    });
  }

  withdrawAmendment(id: string, amendmentId: string, input: unknown, browserId: string) {
    getBill(id);
    const body = object(input);
    if (Object.keys(body).some(key => !["revision", "requestId"].includes(key)))
      throw new CatalogBallotError(400, "unsupported_amendment_field");
    if (typeof body.revision !== "string" || !hex.test(body.revision))
      throw new CatalogBallotError(400, "amendment_revision_required");
    if (typeof body.requestId !== "string" || !uuid.test(body.requestId))
      throw new CatalogBallotError(400, "uuid_request_id_required");
    if (!uuid.test(amendmentId))
      throw new CatalogBallotError(404, "amendment_not_found");
    const owner = this.voterHash(browserId);
    const payloadHash = createHash("sha256").update(JSON.stringify([id, amendmentId, body.revision, "withdraw"])).digest("hex");
    return this.atomic(() => {
      // 404 rather than 403 prevents disclosing whether another browser submitted the ID.
      const row = this.db.query(
        "SELECT * FROM catalog_amendments WHERE id=? AND bill_id=? AND owner_hash=?"
      ).get(amendmentId, id, owner) as AmendmentRow | null;
      if (!row) throw new CatalogBallotError(404, "amendment_not_found");
      if (row.revision !== body.revision)
        throw new CatalogBallotError(409, "stale_amendment_revision");
      const previous = this.db.query(
        "SELECT id,created_at,payload_hash FROM catalog_amendment_events WHERE amendment_id=? AND action='withdraw' AND request_id=?"
      ).get(amendmentId, body.requestId) as { id: string; created_at: number; payload_hash: string } | null;
      if (previous) {
        if (previous.payload_hash !== payloadHash) throw new CatalogBallotError(409, "idempotency_key_reused");
        return { saved: true, replayed: true,
          receipt: { id: previous.id, recordedAt: new Date(previous.created_at).toISOString() } };
      }
      if (row.status === "withdrawn") {
        const original = this.db.query(
          "SELECT id,created_at FROM catalog_amendment_events WHERE amendment_id=? AND action='withdraw' ORDER BY created_at DESC LIMIT 1"
        ).get(amendmentId) as { id: string; created_at: number };
        return { saved: true, replayed: true,
          receipt: { id: original.id, recordedAt: new Date(original.created_at).toISOString() } };
      }
      const now = this.now(), eventId = randomUUID();
      // Remove the text from active storage and review queues, retain only audit metadata/hashes.
      this.db.query("UPDATE catalog_amendments SET status='withdrawn',body='',withdrawn_at=? WHERE id=?")
        .run(now, row.id);
      this.db.query(
        "INSERT INTO catalog_amendment_events (id,amendment_id,actor_hash,action,request_id,payload_hash,created_at) VALUES (?,?,?,?,?,?,?)"
      ).run(eventId, row.id, owner, "withdraw", body.requestId, payloadHash, now);
      return { saved: true, replayed: false,
        receipt: { id: eventId, recordedAt: new Date(now).toISOString() } };
    });
  }

  /** HTTP layer must separately authenticate an authorized human publisher. */
  publish(id: string, payload: unknown, publisher: string) {
    const bill = getBill(id), body = object(payload);
    if (!publisher.trim() || publisher.length > 120)
      throw new CatalogBallotError(403, "authorized_publisher_required");
    if (body.revision !== bill.revision)
      throw new CatalogBallotError(409, "stale_catalog_revision");
    // HFL-051's separate legislative supplement is not covered by catalog digest.
    if (bill.id === "HFL-051")
      throw new CatalogBallotError(409, "separate_supplement_review_required");
    const gate = this.reviews(bill);
    if (!gate.reviewReady || !gate.review || gate.review.revision !== bill.revision || gate.review.jurisdiction !== bill.jurisdiction)
      throw new CatalogBallotError(409, "human_review_incomplete");
    const now = this.now(), openedAt = date(body.opensAt), closesAt = date(body.closesAt);
    if (openedAt < now - MINUTE || openedAt > now + 180 * DAY || closesAt <= Math.max(openedAt, now) || closesAt > openedAt + 180 * DAY)
      throw new CatalogBallotError(400, "invalid_ballot_window");
    const reviewSnapshot = JSON.stringify(gate.review), publicationId = randomUUID();
    return this.atomic(() => {
      if (this.db.query("SELECT id FROM catalog_publications WHERE bill_id=? AND revision=?").get(id, bill.revision))
        throw new CatalogBallotError(409, "revision_already_published");
      const former = this.latest(id);
      if (former?.state === "open") {
        this.db.query("UPDATE catalog_publications SET state='closed' WHERE id=?").run(former.id);
        this.db.query("INSERT INTO catalog_publication_audit VALUES(?,?,?,?,?)").run(randomUUID(), former.id, "supersede", publisher, now);
      }
      this.db.query("INSERT INTO catalog_publications VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
        publicationId, id, bill.revision, bill.jurisdiction, JSON.stringify(bill), reviewSnapshot,
        publisher, openedAt, closesAt, now, "open",
      );
      this.db.query("INSERT INTO catalog_publication_audit VALUES(?,?,?,?,?)").run(randomUUID(), publicationId, "publish", publisher, now);
      return { publicationId, billId: id, revision: bill.revision, publisher, publishedAt: new Date(now).toISOString(), opensAt: new Date(openedAt).toISOString(), closesAt: new Date(closesAt).toISOString() };
    });
  }
  cast(id: string, payload: unknown, browserId: string) {
    const bill = getBill(id), body = object(payload);
    if (body.revision !== bill.revision)
      throw new CatalogBallotError(409, "stale_catalog_revision");
    const choice = body.choice;
    if (choice !== null && choice !== "support" && choice !== "oppose" && choice !== "unsure")
      throw new CatalogBallotError(400, "invalid_advisory_choice");
    const requestId = body.requestId;
    if (typeof requestId !== "string" || !uuid.test(requestId))
      throw new CatalogBallotError(400, "uuid_request_id_required");
    const voter = this.voterHash(browserId);
    const publicationId = body.publicationId;
    if (typeof publicationId !== "string" || !uuid.test(publicationId))
      throw new CatalogBallotError(400, "publication_id_required");
    const digest = createHash("sha256").update(JSON.stringify([id, body.revision, publicationId, choice])).digest("hex");
    return this.atomic(() => {
      const pub = this.db.query("SELECT * FROM catalog_publications WHERE id=? AND bill_id=? AND revision=?").get(publicationId, id, bill.revision) as PublicationRow | null;
      if (!pub) throw new CatalogBallotError(409, "publication_revision_mismatch");
      const old = this.db.query("SELECT id,payload_hash,choice,created_at FROM catalog_ballot_events WHERE publication_id=? AND voter_hash=? AND request_id=?").get(publicationId, voter, requestId) as EventRow | null;
      if (old) {
        if (old.payload_hash !== digest) throw new CatalogBallotError(409, "idempotency_key_reused");
        return { saved: true, replayed: true, receipt: { id: old.id, publicationId, revision: pub.revision, choice: old.choice, recordedAt: new Date(old.created_at).toISOString() }, ownChoice: this.choice(pub.id, voter) };
      }
      if (this.latest(id)?.id !== pub.id || !this.eligible(bill, pub))
        throw new CatalogBallotError(409, "publication_not_authorized");
      const now = this.now();
      if (now < pub.opened_at || now >= pub.closes_at)
        throw new CatalogBallotError(409, "voting_window_closed");
      if (choice === null)
        this.db.query("DELETE FROM catalog_current_ballots WHERE publication_id=? AND voter_hash=?").run(pub.id, voter);
      else
        this.db.query("INSERT INTO catalog_current_ballots VALUES(?,?,?,?) ON CONFLICT(publication_id,voter_hash) DO UPDATE SET choice=excluded.choice,changed_at=excluded.changed_at").run(pub.id, voter, choice, now);
      const receiptId = randomUUID();
      this.db.query("INSERT INTO catalog_ballot_events VALUES(?,?,?,?,?,?,?)").run(receiptId, pub.id, voter, choice, requestId, digest, now);
      return { saved: true, replayed: false, receipt: { id: receiptId, publicationId, revision: pub.revision, choice, recordedAt: new Date(now).toISOString() }, ownChoice: choice };
    });
  }
}
