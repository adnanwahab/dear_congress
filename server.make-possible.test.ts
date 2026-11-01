import { afterEach, describe, expect, test } from "bun:test";
import { SEED_JOURNALS } from "./src/engine/catalog";
import { emptyDB, extract } from "./src/engine/engine";
import type { DB, IdeaReport, PackageResult } from "./src/engine/types";

const started: Array<{ stop: (closeConnections?: boolean) => void }> = [];
const dbPaths: string[] = [];

afterEach(async () => {
  while (started.length) started.pop()!.stop(true);
  while (dbPaths.length) await Bun.file(dbPaths.pop()!).delete();
});

async function startServer() {
  for (const k of ["GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) delete process.env[k];
  const db: DB = emptyDB();
  db.schemaVersion = 2;
  db.entries = SEED_JOURNALS.map((s, i) => ({ id: `seed-${i}`, author: s.author, text: s.text, createdAt: new Date(1_700_000_000_000 + i * 60_000).toISOString(), extraction: extract(s.text), corrected: false, seeded: true }));
  db.emergent.push({
    id: "emergent_1", needId: "food_access", title: "community fridges stocked by local restaurants", mechanism: "To be determined", authority: "Unassigned",
    jurisdiction: "Unassigned", costB: null, changeLevel: 3, reversibility: 0.5, evidence: 0.3, effectiveness: 0.5, keywords: [], metrics: [],
    legalChange: "Needs legal analysis", emergent: true, sourceText: "community fridges stocked by local restaurants",
  });
  const path = `data/test-db-${crypto.randomUUID()}.json`;
  dbPaths.push(path);
  await Bun.write(path, JSON.stringify(db));
  process.env.DB_PATH = path;
  process.env.PORT = "0";
  process.env.DEBUG_REQUEST_LOGS = "0";
  const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
  const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
  started.push(server);
  const post = (path: string, body: unknown, voter = "voter-a") => fetch(new URL(path, server.url), { method: "POST", headers: { "content-type": "application/json", "x-voter-id": voter }, body: JSON.stringify(body) });
  return { server, post, path };
}

describe("Make this possible endpoints", () => {
  test("design → choose a version → the plan takes it; votes stay private", async () => {
    const { server, post, path } = await startServer();

    const synth = async () => ((await (await post("/api/synthesize", { compare: true, budget: 42 })).json()) as { real: PackageResult[]; blended: PackageResult[] });
    const ideaIn = (pkgs: PackageResult[]) => pkgs[0]!.ideas!.find((r) => r.id === "emergent_1") as IdeaReport;

    expect(ideaIn((await synth()).real).status).toBe("needs_design");

    const designRes = await post("/api/emergent/emergent_1/design", {});
    expect(designRes.status).toBe(200);
    const design = await designRes.json() as { interpretation: { provider: string; analogId?: string }; costB: number; costEstimate: string };
    expect(design.interpretation.provider).toBe("heuristic");
    expect(design.costB).toBeGreaterThan(0);
    expect(design.costEstimate).toBe("designed");

    const before = await synth();
    const r = ideaIn(before.real);
    expect(r.status).not.toBe("needs_design");
    expect(ideaIn(before.blended).variants.every((v) => v.fit === undefined)).toBe(true);
    const rec = r.variants.find((v) => v.recommended);
    expect(rec).toBeDefined();

    expect((await post("/api/emergent/emergent_1/variant", { variant: "nope" })).status).toBe(400);
    expect((await post("/api/emergent/missing/variant", { variant: "pilot" })).status).toBe(404);
    expect((await post("/api/emergent/variant", { variant: "pilot" })).status).toBe(400);
    expect((await post("/api/emergent/variant", { ideaId: "emergent_1", variant: rec!.id })).status).toBe(200);

    const after = await synth();
    expect(after.real[0]!.items.map((i) => i.proposal.id)).toContain("emergent_1");
    expect(ideaIn(after.real).status).toBe("in_plan");

    const state = await (await fetch(new URL("/api/state", server.url), { headers: { "x-voter-id": "voter-a" } })).json() as { proposals: Array<Record<string, unknown>> };
    const p = state.proposals.find((x) => x.id === "emergent_1")!;
    expect(p.myVariant).toBe(rec!.id);
    expect((p.variantCounts as Record<string, number>)[rec!.id]).toBe(1);
    expect(p.variantChoices).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain("voter-a");

    // The reading is cached: designing again doesn't change it.
    const again = await (await post("/api/emergent/design", { ideaId: "emergent_1" }, "voter-b")).json() as { interpretation: { createdAt: string } };
    const stored = await Bun.file(path).json() as DB;
    expect(again.interpretation.createdAt).toBe(stored.emergent[0]!.interpretation!.createdAt);
  });
});
