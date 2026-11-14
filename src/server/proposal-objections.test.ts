import { expect, test } from "bun:test";
import { publishCitizenProposal, objectCitizenProposal, citizenProposalView, createCitizenProposalHandlers, voteCitizenProposal, type CitizenProposalStore } from "./citizen-proposals";
const owner = "publishing-browser";
const participant = "participant-browser";
function fixture() {
  const db: CitizenProposalStore = { entries: [] };
  const { record } = publishCitizenProposal(db, owner, { title: "Access", problem: "Steps", proposedChange: "Build a ramp", jurisdiction: "city", confirmedPublic: true, idempotencyKey: crypto.randomUUID() });
  return { db, record };
}
const body = () => ({ action: "create", text: "The ramp needs a handrail", severity: "major", constituency: "Wheelchair users (self-described)", confirmedPublic: true, idempotencyKey: crypto.randomUUID() });
const req = (value: unknown, voter = owner) => new Request("http://localhost", { method: "POST", headers: { "x-voter-id": voter }, body: JSON.stringify(value) });
test("objection retries, persistence and public projection preserve immutable proposal and ballots", () => {
  const { db, record } = fixture();
  voteCitizenProposal(db, record.id, participant, { choice: "oppose" });
  const before = JSON.stringify(record);
  const input = body();
  objectCitizenProposal(db, record.id, participant, input);
  objectCitizenProposal(db, record.id, participant, input);
  expect(record.objections).toHaveLength(1);
  expect(() => objectCitizenProposal(db, record.id, participant, { ...input, text: "Different" })).toThrow("different content");
  const restored = JSON.parse(JSON.stringify(db));
  objectCitizenProposal(restored, record.id, participant, input);
  const view = citizenProposalView(restored.citizenProposals[0], participant);
  expect(view).toMatchObject({ canRespondToObjections: false, countTotal: 1, ownVote: "oppose", objections: [{ responses: [] }] });
  expect(JSON.stringify(view)).not.toMatch(/Hash|idempotencyKey|participant-browser/);
  expect(citizenProposalView(record, owner).canRespondToObjections).toBe(true);
  const { objections, ...unchanged } = record;
  expect(JSON.stringify(unchanged)).toBe(before);
});
test("only proposer can append scoped, reasoned, concurrency checked decline/reopen history", () => {
  const { db, record } = fixture();
  objectCitizenProposal(db, record.id, participant, body());
  const response = { action: "respond", objectionId: record.objections![0]!.id, expectedVersion: 0, status: "declined", reason: "Existing access standards require rails" };
  for (const invalid of [{ ...response, reason: " " }, { ...response, status: "accepted" }, { ...response, objectionId: "other-proposal-objection" }, { ...response, expectedVersion: -1 }]) {
    expect(() => objectCitizenProposal(db, record.id, owner, invalid)).toThrow();
  }
  expect(() => objectCitizenProposal(db, record.id, participant, response)).toThrow("Only the publishing browser");
  objectCitizenProposal(db, record.id, owner, response);
  expect(() => objectCitizenProposal(db, record.id, owner, response)).toThrow("history changed");
  objectCitizenProposal(db, record.id, owner, { ...response, expectedVersion: 1, status: "unresolved", reason: "Need to verify the standard" });
  expect(record.objections![0]!.responses.map(r => r.status)).toEqual(["declined", "unresolved"]);
});
test("invalid and unconsented objections never create records", () => {
  const { db, record } = fixture();
  for (const invalid of [{ ...body(), confirmedPublic: false }, { ...body(), severity: "urgent" }, { ...body(), constituency: "" }, { ...body(), text: "x".repeat(2001) }, { ...body(), idempotencyKey: "bad" }]) {
    expect(() => objectCitizenProposal(db, record.id, participant, invalid)).toThrow();
  }
  expect(record.objections).toBeUndefined();
});
test("serialized HTTP writes roll back failed creation and response; stale concurrent response rejected", async () => {
  const { db, record } = fixture();
  let fail = true;
  const handlers = createCitizenProposalHandlers({ getStore: () => db, save: async () => { if (fail) throw Error("disk failure"); } });
  const input = body();
  expect((await handlers.objection(req(input, participant), record.id)).status).toBe(500);
  expect(record.objections).toBeUndefined();
  fail = false;
  expect((await handlers.objection(req(input, participant), record.id)).status).toBe(200);
  const response = { action: "respond", objectionId: record.objections![0]!.id, expectedVersion: 0, status: "declined", reason: "Not in scope" };
  fail = true;
  expect((await handlers.objection(req(response), record.id)).status).toBe(500);
  expect(record.objections![0]!.responses).toHaveLength(0);
  fail = false;
  const results = await Promise.all([handlers.objection(req(response), record.id), handlers.objection(req(response), record.id)]);
  expect(results.map(r => r.status)).toEqual([200, 409]);
  expect(record.objections![0]!.responses).toHaveLength(1);
});
