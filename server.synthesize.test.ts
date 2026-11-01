import { afterEach, describe, expect, test } from "bun:test";
import { emptyDB, extract } from "./src/engine/engine";
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

  test("one synthetic flood entry produces non-empty compare diff", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    const FLOOD = "Our street flooded in the storm and the drainage couldn't keep up. I need a practical fix soon.";
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
      body: JSON.stringify({ compare: true, budget: 40 }),
    });
    expect(res.status).toBe(200);
    const out = await res.json() as { diff: Record<string, { addedBySimulated: string[]; removedBySimulated: string[]; moneyMovedB: number }> };

    const anyChanged = Object.values(out.diff).some((d) => d.addedBySimulated.length > 0 || d.removedBySimulated.length > 0 || d.moneyMovedB > 0);
    expect(anyChanged).toBe(true);
  });

  test("compare=true never updates lastPlan/challengerStreak", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const initialDb = seededDb();
    initialDb.challengerStreak = { A: { sentinel: 7 } };
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

    const persisted = await Bun.file(dbPath).json() as DB;
    expect(persisted.lastPlan).toEqual(initialDb.lastPlan);
    expect(persisted.challengerStreak).toEqual(initialDb.challengerStreak);
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
