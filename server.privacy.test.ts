import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { emptyDB, extract } from "./src/engine/engine";
import { claimJournal, deleteJournal } from "./src/server/journal-privacy";

// Exercise the actual wrapped route handlers and on-disk reload without requiring
// a listening socket (the restricted runner rejects Bun.serve with EADDRINUSE).
test("journal privacy, ownership, vote withdrawal and disk reload through real route handlers", async () => {
  const dir = await mkdtemp("/private/tmp/she-284-");
  const path = join(dir, "db.json");
  const env = { ...process.env };
  let routes: any;
  let fallback: any;
  const stub = spyOn(Bun, "serve").mockImplementation(((options: any) => {
    routes = options.routes;
    fallback = options.fetch;
    return { url: new URL("http://localhost:8000"), stop() {} };
  }) as any);
  const jars: Record<string, string> = {};
  async function call(route: string, method = "GET", body?: unknown, browser = "author", params = {}, extra = {}) {
    const req = new Request(`http://localhost:8000${route.replace(":id", (params as any).id ?? "test")}`, {
      method, headers: { ...(jars[browser] ? { cookie: jars[browser] } : {}), "content-type": "application/json", ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    Object.assign(req, { params });
    const res: Response = await routes[route][method](req, { requestIP: () => ({ address: "127.0.0.1" }) });
    const cookie = res.headers.get("set-cookie")?.split(";")[0];
    if (cookie) jars[browser] = cookie;
    return res;
  }
  const state = async (browser = "author") => (await call("/api/state", "GET", undefined, browser)).json() as Promise<any>;
  async function reload() { await import(`./server.ts?privacy=${crypto.randomUUID()}`); }
  try {
    Object.assign(process.env, { DB_PATH: path, PORT: "0", ANON_COOKIE_SECRET: "test-only-stable-cookie-secret-over-32-characters", OPENAI_API_KEY: "", GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "", PUBLIC_ID_LIMIT: "1000", PUBLIC_IP_LIMIT: "1000", PUBLIC_JOURNAL_LIMIT: "100" });
    const db = emptyDB();
    db.schemaVersion = 2;
    db.entries.push({ id: "legacy", text: "Rent is high", author: "A", createdAt: new Date().toISOString(), extraction: extract("Rent is high"), corrected: false, location: { lat: 29.729, lng: -95.475 }, tileId: "precise-tile", source: "legacy-source" });
    // No adoption of legacy records, even with matching display names.
    await Bun.write(path, JSON.stringify(db));
    await reload();
    const notice = await fallback(new Request("http://localhost:8000/privacy"));
    expect(notice.status).toBe(200);
    expect(await notice.text()).toContain("How long we keep it");
    const baseline = await state();
    expect(baseline.ownEntryIds).toEqual([]);
    for (const alias of ["/api/entries", "/api/journals", "/api/ballot_entries", "/api/state"]) {
      const text = await (await call(alias)).text();
      expect(text).not.toContain("29.729");
      expect(text).not.toContain("precise-tile");
      expect(text).toContain("legacy-source");
      expect(text).not.toContain("journalOwners");
    }
    const events = await call("/api/entries/events");
    const reader = events.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).not.toContain("29.729");
    await reader.cancel();
    expect((await call("/api/journal/:id", "DELETE", undefined, "author", { id: "legacy" })).status).toBe(403);
    // All three publication aliases attach ownership and filter their responses.
    const ids: string[] = [];
    for (const alias of ["/api/journal", "/api/entries", "/api/publish_draft"]) {
      const response = await call(alias, "POST", { text: "Rent is far too high", author: "A", location: { lat: 29.729, lng: -95.475 }, kind: "journal" });
      expect(response.status).toBe(200);
      const result: any = await response.json();
      const entry = result.entry ?? result;
      expect(entry.location).toBeUndefined();
      ids.push(entry.id);
      const other = await call("/api/journal/:id", "DELETE", undefined, "stranger", { id: entry.id }, { "x-voter-id": jars.author!.split("=")[1]!.split(".")[0]! });
      expect(other.status).toBe(403);
      expect((await call("/api/journal/:id", "DELETE", undefined, "author", { id: entry.id }, { origin: "https://other.example" })).status).toBe(403);
      if (result.fork_id) {
        expect((await call("/api/forks/:id/undo", "POST", {}, "stranger", { id: result.fork_id })).status).toBe(403);
      }
    }
    expect((await state()).ownEntryIds.sort()).toEqual(ids.sort());
    expect((await state("stranger")).ownEntryIds).toEqual([]);
    const saved = await Bun.file(path).json();
    expect(Object.keys(saved.journalOwners)).toHaveLength(3);
    expect(saved.journalOwners[ids[0]!]).toMatch(/^[a-f0-9]{64}$/);
    await reload();
    expect((await state()).ownEntryIds.sort()).toEqual(ids.sort());
    for (const id of ids) expect((await call("/api/journal/:id", "DELETE", undefined, "author", { id })).status).toBe(200);
    expect((await state()).demand.housing.journalCount).toBe(baseline.demand.housing.journalCount);
    const pid = baseline.proposals.find((p: any) => p.needId === "housing").id;
    const vote = { proposalId: pid, stance: 2, importance: 1, acceptCompromise: true, concern: "", changeMind: "" };
    expect((await call("/api/votes", "POST", { votes: [vote], goalVotes: { housing: true } })).status).toBe(200);
    expect((await state()).stats[pid]).not.toEqual(baseline.stats[pid]);
    expect((await call("/api/votes", "POST", { votes: [{ ...vote, stance: -2 }], goalVotes: { housing: false } }, "stranger")).status).toBe(200);
    expect((await call("/api/votes", "POST", { withdrawVotes: ["invalid"], goalVotes: { housing: null } })).status).toBe(400);
    expect((await state()).user.goalVotes.housing).toBe(true);
    expect((await call("/api/votes", "POST", { withdrawVotes: [pid], goalVotes: { housing: null } })).status).toBe(200);
    expect((await state()).user.votes[pid]).toBeUndefined();
    expect((await state("stranger")).user.votes[pid].stance).toBe(-2);
    await call("/api/votes", "POST", { withdrawVotes: [pid], goalVotes: { housing: null } }, "stranger");
    await reload();
    const final = await state();
    expect(final.entries.map((e: any) => e.id)).toEqual(["legacy"]);
    expect(final.ownEntryIds).toEqual([]);
    expect(final.user.votes[pid]).toBeUndefined();
    expect(final.user.goalVotes.housing).toBeUndefined();
    expect(final.stats[pid]).toEqual(baseline.stats[pid]);
    expect(final.goalSupport.housing).toEqual(baseline.goalSupport.housing);
    expect(final.population.realVoices).toBe(baseline.population.realVoices);
    // Let the short staged-publication job finish before restoring its temp DB.
    await Bun.sleep(1600);
  } finally {
    stub.mockRestore();
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    await rm(dir, { recursive: true, force: true });
  }
});

test("deleting a cited journal preserves proposal source identity and other ownership", () => {
  const db = emptyDB();
  for (const id of ["own", "other"]) db.entries.push({ id, author: "A", text: "Rent", createdAt: new Date().toISOString(), extraction: extract("Rent"), corrected: false });
  claimJournal(db, "own", "owner");
  claimJournal(db, "other", "other");
  db.citizenProposals = [{ id: "proposal", sourceEntryId: "own", votesByVoterHash: { untouched: "support" } } as any];
  const before = structuredClone(db.citizenProposals);
  expect(deleteJournal(db, "own", "other")).toBe(403);
  expect(deleteJournal(db, "own", "owner")).toBe(200);
  expect(db.citizenProposals).toEqual(before);
  expect(db.entries.map(e => e.id)).toEqual(["other"]);
  expect(db.journalOwners?.other).toBeDefined();
});
