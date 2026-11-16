import { expect, test } from "bun:test";
import { publishCitizenProposal, creditCitizenProposal, citizenProposalView, createCitizenProposalHandlers, proposalCreditRevision, type CitizenProposalStore } from "./citizen-proposals";
function fixture() {
  const db: CitizenProposalStore = { entries: [] };
  const { record } = publishCitizenProposal(db, "publisher-browser", { title: "Access", problem: "Steps", proposedChange: "Ramp", jurisdiction: "city", confirmedPublic: true, idempotencyKey: crypto.randomUUID() });
  const input = { action: "opt-in", confirmedPublic: true, expectedVersion: 0, revision: proposalCreditRevision(record), role: "research", preference: "pseudonym", alias: "Night Owl" };
  return { db, record, input };
}
test("opt-in credits preserve proposal/ballots, scope and name-free immutable history after removal and restart", () => {
  const { db, record, input } = fixture();
  const original = JSON.stringify(record);
  creditCitizenProposal(db, record.id, "contributor-browser", { ...input, privateJournal: "secret journal", realName: "secret identity" });
  const before = structuredClone(record.credits![0]!.events);
  expect(citizenProposalView(record, "contributor-browser").credits).toMatchObject({ ownActive: true, contributors: [{ alias: "Night Owl", role: "research" }] });
  const remove = { action: "remove", expectedVersion: 1, revision: input.revision };
  expect(() => creditCitizenProposal(db, record.id, "another-browser", remove)).toThrow("No active credit");
  creditCitizenProposal(db, record.id, "contributor-browser", remove);
  expect(record.credits![0]!.events.slice(0, 1)).toEqual(before);
  const restored = JSON.parse(JSON.stringify(db));
  const view = citizenProposalView(restored.citizenProposals[0], "contributor-browser");
  expect(view.credits).toMatchObject({ ownActive: false, version: 2, contributors: [] });
  expect(JSON.stringify(restored)).not.toMatch(/Night Owl|secret journal|secret identity/);
  expect(JSON.stringify(view)).not.toMatch(/ownerHash|contributor-browser|publishKeyHash/);
  const { credits, ...unchanged } = record;
  expect(JSON.stringify(unchanged)).toBe(original);
  creditCitizenProposal(db, record.id, "contributor-browser", { ...input, expectedVersion: 2, preference: "unnamed", alias: "Must not retain" });
  expect(JSON.stringify(record.credits)).not.toContain("Must not retain");
});
test("consent, revision, role and optimistic concurrency fail closed", () => {
  const { db, record, input } = fixture();
  for (const bad of [{ confirmedPublic: false }, { revision: "sample:other" }, { role: "verified-author" }, { preference: "real-name" }, { alias: "" }, { alias: "x".repeat(81) }, { expectedVersion: -1 }]) {
    expect(() => creditCitizenProposal(db, record.id, "contributor-browser", { ...input, ...bad })).toThrow();
    expect(record.credits).toBeUndefined();
  }
  creditCitizenProposal(db, record.id, "contributor-browser", input);
  expect(() => creditCitizenProposal(db, record.id, "contributor-browser", input)).toThrow("changed");
});
test("serialized credit saves roll back on disk failure and reject stale parallel writes", async () => {
  const { db, record, input } = fixture();
  let fail = true;
  const handlers = createCitizenProposalHandlers({ getStore: () => db, save: async () => { if (fail) throw Error("disk failure"); } });
  const req = (body: unknown) => new Request("http://localhost", { method: "POST", headers: { "x-voter-id": "contributor-browser" }, body: JSON.stringify(body) });
  expect((await handlers.credit(req(input), record.id)).status).toBe(500);
  expect(record.credits).toBeUndefined();
  fail = false;
  expect((await Promise.all([handlers.credit(req(input), record.id), handlers.credit(req(input), record.id)])).map(r => r.status)).toEqual([200,409]);
  fail = true;
  expect((await handlers.credit(req({ action: "remove", revision: input.revision, expectedVersion: 1 }), record.id)).status).toBe(500);
  expect(record.credits![0]!.alias).toBe("Night Owl");
});
test("another proposal has an independent revision and ledger; public history cannot expose injected private fields", () => {
  const { db, record, input } = fixture();
  const { record: second } = publishCitizenProposal(db, "publisher-browser", { title: "Other", problem: "Road", proposedChange: "Crossing", jurisdiction: "city", confirmedPublic: true, idempotencyKey: crypto.randomUUID() });
  expect(() => creditCitizenProposal(db, second.id, "contributor-browser", input)).toThrow("revision changed");
  creditCitizenProposal(db, record.id, "contributor-browser", input);
  Object.assign(record.credits![0]!, { privateJournal: "journal secret" });
  Object.assign(record.credits![0]!.events[0]!, { realName: "identity secret" });
  const publicJson = JSON.stringify(citizenProposalView(record));
  expect(publicJson).not.toMatch(/journal secret|identity secret|ownerHash/);
  expect(citizenProposalView(second).credits).toMatchObject({ version: 0, contributors: [], ownActive: false });
});
