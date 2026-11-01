import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_WEIGHTS, buildContext, emptyDB, extract, synthesize } from "./src/engine/engine";
import { SEED_JOURNALS } from "./src/engine/catalog";
import type { DB } from "./src/engine/types";

const startedServers: Array<{ stop: (closeConnections?: boolean) => void }> = [];
const tempDbPaths: string[] = [];

afterEach(async () => {
  while (startedServers.length) {
    startedServers.pop()!.stop(true);
  }
  while (tempDbPaths.length) {
    await Bun.file(tempDbPaths.pop()!).delete();
  }
});

function seededDb(): DB {
  const db = emptyDB();
  db.entries = SEED_JOURNALS.map((s, i) => ({
    id: `seed-${i}`,
    author: s.author,
    text: s.text,
    createdAt: new Date(1_700_000_000_000 + i * 60_000).toISOString(),
    extraction: extract(s.text),
    corrected: false,
    seeded: true,
  }));
  db.lastPlan = { A: ["sentinel_plan_item"] };
  return db;
}

function seededBalancedPlanIds(db: DB, budget = 40): string[] {
  return synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, budget)[0]!.items.map((i) => i.proposal.id);
}

describe("/api/synthesize what-if", () => {
  test("extraEntries affect synthesis request without persisting to DB", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const stateBeforeRes = await fetch(new URL("/api/state", server.url));
    expect(stateBeforeRes.status).toBe(200);
    const stateBefore = await stateBeforeRes.json() as { entries: Array<{ id: string }> };



    const FLOOD = "Our street flooded in the storm and the drainage could not keep up. We are scared every time it rains.";
    const synthRes = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        budget: 20,
        extraEntries: Array.from({ length: 8 }, () => ({ text: FLOOD, author: "What-if resident" })),
      }),
    });

    expect(synthRes.status).toBe(200);
    const packages = await synthRes.json() as Array<{ id: string; items: Array<{ proposal: { id: string } }> }>;
    const balanced = packages.find((p) => p.id === "A")!;
    expect(balanced).toBeDefined();
    expect(Array.isArray(balanced.items)).toBe(true);
    expect(balanced.items.length).toBeGreaterThan(0);

    const stateAfterRes = await fetch(new URL("/api/state", server.url));
    expect(stateAfterRes.status).toBe(200);
    const stateAfter = await stateAfterRes.json() as { entries: Array<{ id: string }> };

    expect(stateAfter.entries.length).toBe(stateBefore.entries.length);

    const persisted = await Bun.file(dbPath).json() as DB;
    expect(persisted.entries.length).toBe(initialDb.entries.length);
    expect(persisted.lastPlan).toEqual({ A: ["sentinel_plan_item"] });
  });

  test("compare=true with no synthetic entries returns identical plans and empty diffs", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const res = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compare: true }),
    });
    expect(res.status).toBe(200);
    const out = await res.json() as { real: Array<{ id: string; items: Array<{ proposal: { id: string } }> }>; blended: Array<{ id: string; items: Array<{ proposal: { id: string } }> }>; diff: Record<string, { addedBySimulated: string[]; removedBySimulated: string[]; moneyMovedB: number }> };

    expect(out.real.length).toBeGreaterThan(0);
    expect(out.real.map((p) => p.id)).toEqual(out.blended.map((p) => p.id));
    for (const p of out.real) {
      const b = out.blended.find((x) => x.id === p.id)!;
      expect(p.items.map((i) => i.proposal.id)).toEqual(b.items.map((i) => i.proposal.id));
      expect(out.diff[p.id]?.addedBySimulated ?? []).toEqual([]);
      expect(out.diff[p.id]?.removedBySimulated ?? []).toEqual([]);
      expect(out.diff[p.id]?.moneyMovedB ?? 0).toBe(0);
    }
  });

  test("one synthetic FLOOD entry produces non-empty compare diff and adds f_buyouts when stability is off", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();

    const FLOOD = "Our street flooded in the storm and the drainage could not keep up. I need a practical fix soon.";
    initialDb.entries.push({
      id: "sim-flood-1",
      author: "Simulated resident",
      text: FLOOD,
      createdAt: new Date().toISOString(),
      extraction: extract(FLOOD),
      corrected: false,
      synthetic: true,
      source: "happybearlandia-world",
    });
    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const res = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compare: true, budget: 30, previous: { A: [] } }),
    });
    expect(res.status).toBe(200);
    const out = await res.json() as { diff: Record<string, { addedBySimulated: string[]; removedBySimulated: string[]; moneyMovedB: number }> };

    expect(out.diff.A.addedBySimulated).toContain("f_buyouts");
    expect(out.diff.A.moneyMovedB).toBeGreaterThan(0);
  });

  test("2 synthetic FLOOD journals with seeded stored plan keeps selected set but starts pending challenger", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    initialDb.lastPlan = { A: seededBalancedPlanIds(initialDb, 20) };

    const FLOOD = "Our street flooded in the storm and the drainage could not keep up. I need a practical fix soon.";
    initialDb.entries.push({
      id: "sim-flood-1",
      author: "Simulated resident",
      text: FLOOD,
      createdAt: new Date().toISOString(),
      extraction: extract(FLOOD),
      corrected: false,
      synthetic: true,
      source: "happybearlandia-world",
    });
    initialDb.entries.push({
      id: "sim-flood-2",
      author: "Simulated resident",
      text: FLOOD,
      createdAt: new Date().toISOString(),
      extraction: extract(FLOOD),
      corrected: false,
      synthetic: true,
      source: "happybearlandia-world",
    });
    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const res = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compare: true, budget: 20 }),
    });
    expect(res.status).toBe(200);
    const out = await res.json() as { diff: Record<string, { addedBySimulated: string[]; removedBySimulated: string[]; moneyMovedB: number; pending: Array<{ id: string; streak: number }> }> };

    expect(out.diff.A.addedBySimulated).toEqual([]);
    expect(out.diff.A.removedBySimulated).toEqual([]);
    expect(out.diff.A.pending.some((p) => p.id === "f_buyouts" && p.streak === 1)).toBe(true);
  });

  test("compare=true persists only the real side", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();

    const FLOOD = "Our street flooded in the storm and the drainage could not keep up. I need a practical fix soon.";
    initialDb.entries.push({
      id: "sim-flood-1",
      author: "Simulated resident",
      text: FLOOD,
      createdAt: new Date().toISOString(),
      extraction: extract(FLOOD),
      corrected: false,
      synthetic: true,
      source: "happybearlandia-world",
    });
    initialDb.entries.push({
      id: "sim-flood-2",
      author: "Simulated resident",
      text: FLOOD,
      createdAt: new Date().toISOString(),
      extraction: extract(FLOOD),
      corrected: false,
      synthetic: true,
      source: "happybearlandia-world",
    });

    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const res = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compare: true, budget: 30, previous: { A: [] } }),
    });
    expect(res.status).toBe(200);

    const out = await res.json() as {
      real: Array<{ id: string; items: Array<{ proposal: { id: string } }>; challengerStreak: Record<string, number> }>;
      blended: Array<{ id: string; items: Array<{ proposal: { id: string } }> }>;
      diff: Record<string, { addedBySimulated: string[] }>;
    };

    const persisted = await Bun.file(dbPath).json() as DB;

    const realPlan = Object.fromEntries(out.real.map((pkg) => [pkg.id, pkg.items.map((i) => i.proposal.id)]));
    const blendedPlan = Object.fromEntries(out.blended.map((pkg) => [pkg.id, pkg.items.map((i) => i.proposal.id)]));
    const realStreak = Object.fromEntries(out.real.map((pkg) => [pkg.id, pkg.challengerStreak]));

    expect(out.diff.A.addedBySimulated).toContain("f_buyouts");
    expect(persisted.lastPlan).toEqual(realPlan);
    expect(persisted.lastPlan).not.toEqual(blendedPlan);
    expect(persisted.challengerStreak).toEqual(realStreak);
  });

  test("shadow mode adds measuredPreview but does not alter returned or persisted real plan", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const outcomesPath = `data/test-outcomes-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    tempDbPaths.push(dbPath);
    tempDbPaths.push(outcomesPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));
    await Bun.write(outcomesPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      series: [
        { needId: "flooding", value: 999, unit: "x", year: 2024, severity: 1, source: { name: "fixture", url: "https://example.test" }, fetchedAt: new Date().toISOString() },
      ],
    }, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.OUTCOMES_PATH = outcomesPath;
    process.env.OUTCOMES_MODE = "shadow";
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const res = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compare: true }),
    });
    expect(res.status).toBe(200);
    const out = await res.json() as {
      real: Array<{ id: string; items: Array<{ proposal: { id: string } }> }>;
      measuredPreview?: Record<string, { diff: { added: string[]; removed: string[] } }>;
      outcomesMode?: string;
    };

    expect(out.outcomesMode).toBe("shadow");
    expect(out.measuredPreview).toBeDefined();

    const realPlan = Object.fromEntries(out.real.map((pkg) => [pkg.id, pkg.items.map((i) => i.proposal.id)]));
    const persisted = await Bun.file(dbPath).json() as DB;
    expect(persisted.lastPlan).toEqual(realPlan);
  });

  test("on mode uses measured severity unless request outcomes override it", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const outcomesPath = `data/test-outcomes-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    tempDbPaths.push(dbPath);
    tempDbPaths.push(outcomesPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));
    await Bun.write(outcomesPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      series: [
        { needId: "flooding", value: 1, unit: "x", year: 2024, severity: 0, source: { name: "fixture", url: "https://example.test" }, fetchedAt: new Date().toISOString() },
      ],
    }, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.OUTCOMES_PATH = outcomesPath;
    process.env.OUTCOMES_MODE = "on";
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const a = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ budget: 30 }),
    });
    expect(a.status).toBe(200);
    const outA = await a.json() as Array<{ id: string; items: Array<{ proposal: { id: string } }> }>;

    const b = await fetch(new URL("/api/synthesize", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ budget: 30, outcomes: { needs: { flooding: { severity: 1 } } } }),
    });
    expect(b.status).toBe(200);
    const outB = await b.json() as Array<{ id: string; items: Array<{ proposal: { id: string } }> }>;

    expect(outA.find((p) => p.id === "A")?.items.map((i) => i.proposal.id)).not.toEqual(outB.find((p) => p.id === "A")?.items.map((i) => i.proposal.id));
  });

  test("/api/state returns demandReal and demandBlended", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(initialDb, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const res = await fetch(new URL("/api/state", server.url));
    expect(res.status).toBe(200);
    const out = await res.json() as { demand: Record<string, unknown>; demandReal: Record<string, unknown>; demandBlended: Record<string, unknown> };
    expect(out.demand).toBeDefined();
    expect(out.demandReal).toBeDefined();
    expect(out.demandBlended).toBeDefined();
    expect(Object.keys(out.demandReal).length).toBeGreaterThan(0);
    expect(Object.keys(out.demandBlended).length).toBeGreaterThan(0);
  });
});
