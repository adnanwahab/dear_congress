import { afterEach, describe, expect, test } from "bun:test";
import { emptyDB, extract } from "./src/engine/engine";
import type { DB, JournalEntry } from "./src/engine/types";

const startedServers: Array<{ stop: (closeConnections?: boolean) => void }> = [];
const tempDbPaths: string[] = [];

afterEach(async () => {
  while (startedServers.length) startedServers.pop()!.stop(true);
  while (tempDbPaths.length) await Bun.file(tempDbPaths.pop()!).delete();
});

function mkEntry(input: {
  id: string;
  text: string;
  createdAt: string;
  synthetic?: boolean;
  location?: { lat: number; lng: number };
  tileId?: string;
}): JournalEntry {
  return {
    id: input.id,
    author: input.synthetic ? "Simulated resident" : "Journal Client",
    text: input.text,
    createdAt: input.createdAt,
    extraction: extract(input.text),
    corrected: false,
    ...(input.synthetic ? { synthetic: true, source: "happybearlandia-world" } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.tileId ? { tileId: input.tileId } : {}),
  };
}

describe("/api/needs/geo", () => {
  test("location storage on ingest (real stored as floored 0.01° cell, synthetic at 3 decimals)", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const db = emptyDB();
    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(db, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const realRes = await fetch(new URL("/api/journal", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Rent is too high and the bus takes forever.",
        author: "A",
        location: { lat: 29.72944, lng: -95.47491 },
      }),
    });
    expect(realRes.status).toBe(200);
    const realEntry = await realRes.json() as JournalEntry;
    expect(realEntry.location).toEqual({ lat: 29.72, lng: -95.48 });

    const simRes = await fetch(new URL("/api/publish_draft", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "journal",
        text: "Our street flooded in the storm and the drainage could not keep up. I need a practical fix soon.",
        synthetic: true,
        source: "happybearlandia-world",
        metadata: { lat: 29.72944, lng: -95.47491, tileId: "tile-abc" },
      }),
    });
    expect(simRes.status).toBe(200);
    const simOut = await simRes.json() as { mode: string; entry: JournalEntry };
    expect(simOut.mode).toBe("journal");
    expect(simOut.entry.location).toEqual({ lat: 29.729, lng: -95.475 });
    expect(simOut.entry.tileId).toBe("tile-abc");
  });

  test("real and simulated at same point land in the same 0.01° cell (mode=both)", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const db: DB = emptyDB();
    const t0 = Date.parse("2029-01-01T00:00:00.000Z");

    // 3 real + 1 simulated at effectively the same source point, with synthetic stored at 3 decimals.
    // Bin logic must still place all in one shared floored 0.01° cell.
    db.entries.push(mkEntry({ id: "r1", text: "Transit is too slow.", createdAt: new Date(t0).toISOString(), location: { lat: 29.7286, lng: -95.4746 } }));
    db.entries.push(mkEntry({ id: "r2", text: "Flooding is getting worse.", createdAt: new Date(t0 + 60_000).toISOString(), location: { lat: 29.7286, lng: -95.4746 } }));
    db.entries.push(mkEntry({ id: "r3", text: "Housing costs keep climbing.", createdAt: new Date(t0 + 120_000).toISOString(), location: { lat: 29.7286, lng: -95.4746 } }));
    db.entries.push(mkEntry({ id: "s1", text: "Our street flooded in the storm and the drainage couldn't keep up.", createdAt: new Date(t0 + 180_000).toISOString(), synthetic: true, location: { lat: 29.729, lng: -95.475 }, tileId: "tile-shared" }));

    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(db, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const res = await fetch(new URL("/api/needs/geo?bbox=29.70,-95.50,29.80,-95.40&mode=both", server.url));
    expect(res.status).toBe(200);
    const out = await res.json() as {
      cells: Array<{ lat: number; lng: number; real: { count: number }; simulated: { count: number } }>;
    };

    const sharedCell = out.cells.find((c) => c.lat === 29.72 && c.lng === -95.48);
    expect(sharedCell).toBeDefined();
    expect(sharedCell?.real.count).toBe(3);
    expect(sharedCell?.simulated.count).toBe(1);
  });

  test("loading the same DB twice leaves stored locations unchanged", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const db: DB = emptyDB();
    const t0 = Date.parse("2029-01-01T00:00:00.000Z");

    // Legacy DB shape: no schemaVersion; real entry should be cell-normalized once.
    db.schemaVersion = undefined;
    db.entries.push(mkEntry({ id: "r1", text: "Transit is too slow.", createdAt: new Date(t0).toISOString(), location: { lat: 29.73, lng: -163.83 } }));

    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(db, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod1 = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server1 = mod1.server as { stop: (closeConnections?: boolean) => void };
    startedServers.push(server1);
    server1.stop(true);
    startedServers.pop();

    const afterFirst = await Bun.file(dbPath).text();

    const mod2 = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server2 = mod2.server as { stop: (closeConnections?: boolean) => void };
    startedServers.push(server2);
    server2.stop(true);
    startedServers.pop();

    const afterSecond = await Bun.file(dbPath).text();
    expect(afterSecond).toBe(afterFirst);
  });

  test("bbox filtering, k-anonymity suppression, mode filter, and real/sim split", async () => {
    const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
    const db: DB = emptyDB();
    const t0 = Date.parse("2029-01-01T00:00:00.000Z");

    // Suppressed real cell (<3 real) + simulated in same cell.
    db.entries.push(mkEntry({ id: "r1", text: "Bus takes too long.", createdAt: new Date(t0).toISOString(), location: { lat: 29.731, lng: -95.471 } }));
    db.entries.push(mkEntry({ id: "r2", text: "Flood water reached our home area again.", createdAt: new Date(t0 + 60_000).toISOString(), location: { lat: 29.732, lng: -95.472 } }));
    db.entries.push(mkEntry({ id: "s1", text: "Our street flooded in the storm and the drainage could not keep up.", createdAt: new Date(t0 + 120_000).toISOString(), synthetic: true, location: { lat: 29.733, lng: -95.473 }, tileId: "tile-1" }));
    db.entries.push(mkEntry({ id: "s2", text: "I need a practical fix soon.", createdAt: new Date(t0 + 180_000).toISOString(), synthetic: true, location: { lat: 29.734, lng: -95.474 }, tileId: "tile-1" }));

    // Unsuppressed real cell (>=3 real).
    db.entries.push(mkEntry({ id: "r3", text: "Rent is too high.", createdAt: new Date(t0 + 240_000).toISOString(), location: { lat: 29.745, lng: -95.485 } }));
    db.entries.push(mkEntry({ id: "r4", text: "Rent keeps going up.", createdAt: new Date(t0 + 300_000).toISOString(), location: { lat: 29.746, lng: -95.486 } }));
    db.entries.push(mkEntry({ id: "r5", text: "Housing costs are impossible.", createdAt: new Date(t0 + 360_000).toISOString(), location: { lat: 29.747, lng: -95.487 } }));

    // Outside bbox.
    db.entries.push(mkEntry({ id: "s3", text: "Outside bbox", createdAt: new Date(t0 + 420_000).toISOString(), synthetic: true, location: { lat: 31.0, lng: -96.0 }, tileId: "tile-x" }));

    tempDbPaths.push(dbPath);
    await Bun.write(dbPath, JSON.stringify(db, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
    const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
    startedServers.push(server);

    const bothRes = await fetch(new URL("/api/needs/geo?bbox=29.70,-95.50,29.80,-95.40&mode=both", server.url));
    expect(bothRes.status).toBe(200);
    const both = await bothRes.json() as {
      cells: Array<{ lat: number; lng: number; real: { count: number }; simulated: { count: number } }>;
    };

    // Cell with <3 real should not expose real counts; simulated remains visible in mode=both.
    const suppressedBothCell = both.cells.find((c) => c.simulated.count >= 2 && c.real.count === 0);
    expect(suppressedBothCell).toBeDefined();

    // Unsuppressed real cell present.
    const realVisible = both.cells.some((c) => c.real.count >= 3);
    expect(realVisible).toBe(true);

    // BBox excludes outside point.
    const hasOutside = both.cells.some((c) => c.lat >= 30.9 || c.lng <= -95.9);
    expect(hasOutside).toBe(false);

    const realRes = await fetch(new URL("/api/needs/geo?bbox=29.70,-95.50,29.80,-95.40&mode=real", server.url));
    expect(realRes.status).toBe(200);
    const onlyReal = await realRes.json() as {
      cells: Array<{ real: { count: number }; simulated: { count: number } }>;
    };

    // mode=real should return no simulated data in cells.
    expect(onlyReal.cells.every((c) => c.simulated.count === 0)).toBe(true);
    // and suppressed real cells (e.g., the 2-real-entry cell) should be absent.
    expect(onlyReal.cells.every((c) => c.real.count >= 3)).toBe(true);

    const suppressedRealCellPresent = onlyReal.cells.some((c) => c.real.count === 2);
    expect(suppressedRealCellPresent).toBe(false);
  });
});
