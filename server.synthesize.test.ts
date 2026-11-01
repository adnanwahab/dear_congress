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
});
