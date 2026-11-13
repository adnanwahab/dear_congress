import { describe, expect, test } from "bun:test";
import {
  citizenProposalView, commentCitizenProposal, createCitizenProposalHandlers,
  publishCitizenProposal, voteCitizenProposal, type CitizenProposalStore,
} from "./citizen-proposals";

const voter = "browser-alice-123";
const otherVoter = "browser-bob-456";
const key = "16a6eba2-f89f-4bcc-8a6f-edcbd5bed516";
const commentKey = "d5c12390-b3bc-4535-bf03-44d73c29af60";
const input = () => ({
  title: "Publish permit timelines",
  problem: "Applicants cannot see where a permit is delayed.",
  proposedChange: "Publish the current stage and expected review timeline for each permit.",
  jurisdiction: "city",
  jurisdictionName: "Example City",
  supportingInfo: "Track median processing days and overdue reviews.",
  idempotencyKey: key,
  confirmedPublic: true,
});
const store = (): CitizenProposalStore => ({
  entries: [{ id: "journal-123", text: "My permit is delayed.", author: "Resident", createdAt: "2026-11-12T10:00:00Z" }],
});
function request(body?: unknown, browser = voter) {
  return new Request("http://localhost/api/citizen-proposals", {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(browser ? { "x-voter-id": browser } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("citizen proposals", () => {
  test("publishes an explicit advisory proposal with zero votes and a safe public view", () => {
    const db = store();
    const { record } = publishCitizenProposal(db, voter, { ...input(), sourceEntryId: "journal-123" });
    const view = citizenProposalView(record, voter);
    expect(view).toMatchObject({
      title: input().title, status: "published", advisory: true,
      counts: { support: 0, oppose: 0, unsure: 0 }, countTotal: 0, ownVote: null,
      sourceEntryId: "journal-123", comments: [],
    });
    expect(view.id).toMatch(/^citizen_/);
    expect(Number.isFinite(Date.parse(view.publishedAt))).toBe(true);
    const publicJSON = JSON.stringify(view);
    for (const privateValue of [voter, key, record.ownerHash, record.publishKeyHash, record.bodyHash]) {
      expect(publicJSON).not.toContain(privateValue);
    }
    expect(db.entries).toHaveLength(1);
  });

  test("an uncertain publish can be retried without duplication, with conflicts scoped per browser", () => {
    const db = store();
    const first = publishCitizenProposal(db, voter, input());
    const retry = publishCitizenProposal(db, voter, { ...input(), title: ` ${input().title} ` });
    expect(retry.created).toBe(false);
    expect(retry.record.id).toBe(first.record.id);
    expect(() => publishCitizenProposal(db, voter, { ...input(), title: "A different proposal" })).toThrow("already published");
    const other = publishCitizenProposal(db, otherVoter, input());
    expect(other.record.id).not.toBe(first.record.id);
    expect(db.citizenProposals).toHaveLength(2);
  });

  test("rejects malformed, oversized or unconfirmed proposals before changing the store", () => {
    const db = store();
    const invalid = [
      null, [], "proposal", { ...input(), title: "  " },
      { ...input(), problem: 42 }, { ...input(), proposedChange: "x".repeat(10001) },
      { ...input(), jurisdiction: "planet" }, { ...input(), jurisdictionName: [] },
      { ...input(), sourceEntryId: "missing-entry" }, { ...input(), sourceEntryId: 7 },
      { ...input(), confirmedPublic: false }, { ...input(), idempotencyKey: "unstable" },
    ];
    for (const body of invalid) expect(() => publishCitizenProposal(db, voter, body)).toThrow();
    expect(() => publishCitizenProposal(db, "anon", input())).toThrow();
    expect(db.citizenProposals ?? []).toHaveLength(0);
  });

  test("one browser replaces or removes its vote without changing another browser's choice", () => {
    const db = store();
    const { record } = publishCitizenProposal(db, voter, input());
    voteCitizenProposal(db, record.id, voter, { choice: "support" });
    voteCitizenProposal(db, record.id, voter, { choice: "support" });
    voteCitizenProposal(db, record.id, otherVoter, { choice: "unsure" });
    expect(citizenProposalView(record, voter).counts).toEqual({ support: 1, oppose: 0, unsure: 1 });
    voteCitizenProposal(db, record.id, voter, { choice: "oppose" });
    expect(citizenProposalView(record, otherVoter)).toMatchObject({
      counts: { support: 0, oppose: 1, unsure: 1 }, ownVote: "unsure", countTotal: 2,
    });
    voteCitizenProposal(db, record.id, voter, { choice: null });
    expect(citizenProposalView(record, voter)).toMatchObject({ ownVote: null, countTotal: 1 });
    expect(() => voteCitizenProposal(db, record.id, voter, { choice: "yes" })).toThrow();
    expect(() => voteCitizenProposal(db, record.id, voter, {})).toThrow();
    expect(() => voteCitizenProposal(db, "missing", voter, { choice: "support" })).toThrow("not found");
    expect(record.title).toBe(input().title);
  });

  test("discussion retries are idempotent and expose no internal submission keys", () => {
    const db = store();
    const { record } = publishCitizenProposal(db, voter, input());
    const body = { text: "Could the report include overdue permits?", idempotencyKey: commentKey };
    commentCitizenProposal(db, record.id, otherVoter, body);
    commentCitizenProposal(db, record.id, otherVoter, body);
    expect(record.comments).toHaveLength(1);
    const comment = citizenProposalView(record).comments[0]!;
    expect(comment).toMatchObject({ text: body.text, displayName: "Participant" });
    expect(Object.keys(comment).sort()).toEqual(["createdAt", "displayName", "id", "text"]);
    expect(() => commentCitizenProposal(db, record.id, otherVoter, { ...body, text: "changed" })).toThrow("already submitted");
    expect(() => commentCitizenProposal(db, record.id, voter, { ...body, text: " " })).toThrow();
    expect(() => commentCitizenProposal(db, record.id, voter, { ...body, displayName: "x".repeat(81) })).toThrow();
  });

  test("published data, votes, comments and retry identity survive DB serialization", () => {
    const db = store();
    const { record } = publishCitizenProposal(db, voter, input());
    voteCitizenProposal(db, record.id, otherVoter, { choice: "support" });
    commentCitizenProposal(db, record.id, otherVoter, { text: "Useful proposal.", idempotencyKey: commentKey });
    const restored: CitizenProposalStore = JSON.parse(JSON.stringify(db));
    const retry = publishCitizenProposal(restored, voter, input());
    expect(retry.created).toBe(false);
    expect(citizenProposalView(retry.record, otherVoter)).toMatchObject({
      id: record.id, ownVote: "support", countTotal: 1,
      comments: [{ text: "Useful proposal." }],
    });
  });

  test("HTTP adapter validates JSON, identity, size and missing resources", async () => {
    const db = store();
    const handlers = createCitizenProposalHandlers({ getStore: () => db, save: async () => {} });
    expect((await handlers.publish(new Request("http://localhost", { method: "POST", headers: { "x-voter-id": voter }, body: "{" }))).status).toBe(400);
    expect((await handlers.publish(request(input(), ""))).status).toBe(400);
    expect((await handlers.publish(request({ ...input(), problem: "x".repeat(70000) }))).status).toBe(413);
    expect((await handlers.detail(request(), "missing")).status).toBe(404);
    expect((await handlers.journal(request(), "missing")).status).toBe(404);
    const source = await (await handlers.journal(request(), "journal-123")).json();
    expect(source.entry).toEqual(db.entries[0]);
    expect((await handlers.list(request(undefined, ""))).status).toBe(200);
    expect(db.citizenProposals ?? []).toHaveLength(0);
  });

  test("a failed save does not report success and the same draft can safely retry", async () => {
    const db = store();
    let shouldFail = true;
    let saved: string | undefined;
    const handlers = createCitizenProposalHandlers({
      getStore: () => db,
      save: async () => {
        if (shouldFail) throw new Error("simulated disk failure");
        saved = JSON.stringify(db);
      },
    });
    expect((await handlers.publish(request(input()))).status).toBe(500);
    expect(db.citizenProposals ?? []).toHaveLength(0);
    shouldFail = false;
    const success = await handlers.publish(request(input()));
    expect(success.status).toBe(200);
    const id = (await success.json()).proposal.id;
    expect((await handlers.publish(request(input()))).status).toBe(200);
    expect(JSON.parse(saved!).citizenProposals).toHaveLength(1);
    shouldFail = true;
    expect((await handlers.vote(request({ choice: "support" }), id)).status).toBe(500);
    expect(citizenProposalView(db.citizenProposals![0]!).countTotal).toBe(0);
  });
});
