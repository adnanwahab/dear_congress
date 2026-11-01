import { afterEach, describe, expect, test } from "bun:test";
import { emptyDB, extract } from "./src/engine/engine";
import { SEED_JOURNALS } from "./src/engine/catalog";
import type { DB, SimulationSnapshot } from "./src/engine/types";

const startedServers: Array<{ stop: (closeConnections?: boolean) => void }> = [];
const tempDbPaths: string[] = [];

afterEach(async () => {
  while (startedServers.length) startedServers.pop()!.stop(true);
  while (tempDbPaths.length) await Bun.file(tempDbPaths.pop()!).delete();
});

async function startServer() {
  const db: DB = emptyDB();
  db.schemaVersion = 2;
  db.entries = SEED_JOURNALS.map((s, i) => ({
    id: `seed-${i}`,
    author: s.author,
    text: s.text,
    createdAt: new Date(1_700_000_000_000 + i * 60_000).toISOString(),
    extraction: extract(s.text),
    corrected: false,
    seeded: true,
    ...(i === 0 ? { location: { lat: 29.72, lng: -95.47 } } : {}),
  }));
  db.lastPlan = { A: ["sentinel_plan_item"] };
  const dbPath = `data/test-db-${crypto.randomUUID()}.json`;
  tempDbPaths.push(dbPath);
  await Bun.write(dbPath, JSON.stringify(db, null, 2));
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.DEBUG_REQUEST_LOGS = "0";
  process.env.HBL_URL = "https://hbl.test/";
  const mod = await import(`./server.ts?test=${crypto.randomUUID()}`);
  const server = mod.server as { url: URL; stop: (closeConnections?: boolean) => void };
  startedServers.push(server);
  return { server, dbPath };
}

const post = (server: { url: URL }, body: unknown) => fetch(new URL("/api/simulation-snapshots", server.url), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("/api/simulation-snapshots", () => {
  test("freezes a plan from a journal entry without the journal text, and serves it back", async () => {
    const { server, dbPath } = await startServer();
    const res = await post(server, { entryId: "seed-0", package: "Balanced", runs: 5000, years: 3 });
    expect(res.status).toBe(201);
    const { snapshot, simulationUrl } = await res.json() as { snapshot: SimulationSnapshot; simulationUrl: string };

    expect(snapshot.id).toMatch(/^sim_[0-9a-f]{16}$/);
    expect(snapshot.entryId).toBe("seed-0");
    expect(snapshot.location).toEqual({ lat: 29.72, lng: -95.47 });
    expect(snapshot.plan.label).toBe("Balanced");
    expect(snapshot.plan.proposalIds.length).toBeGreaterThan(0);
    expect(snapshot.plan.items[0]!.title.length).toBeGreaterThan(0);
    expect(snapshot.needs.length).toBeGreaterThan(0);
    expect(snapshot.needs.reduce((s, n) => s + n.weight, 0)).toBeCloseTo(1, 3);
    expect(JSON.stringify(snapshot)).not.toContain(SEED_JOURNALS[0]!.text.slice(0, 30));

    const url = new URL(simulationUrl);
    expect(url.origin + url.pathname).toBe("https://hbl.test/world");
    expect(url.searchParams.get("simulation")).toBe(snapshot.id);
    expect(url.searchParams.get("runs")).toBe("1000");
    expect(url.searchParams.get("years")).toBe("3");
    expect(url.searchParams.get("autorun")).toBe("1");
    expect(Number(url.searchParams.get("seed"))).toBeGreaterThanOrEqual(0);

    const got = await fetch(new URL(`/api/simulation-snapshots/${snapshot.id}`, server.url));
    expect(got.status).toBe(200);
    expect((await got.json()).snapshot).toEqual(snapshot);

    // Snapshotting is read-only for the plan history.
    const saved = await Bun.file(dbPath).json() as DB;
    expect(saved.lastPlan).toEqual({ A: ["sentinel_plan_item"] });
    expect(saved.simulationSnapshots?.length).toBe(1);
  });

  test("works without an entry, picks packages by id, and rejects unknowns", async () => {
    const { server } = await startServer();
    const res = await post(server, { package: "B" });
    expect(res.status).toBe(201);
    const { snapshot } = await res.json() as { snapshot: SimulationSnapshot };
    expect(snapshot.plan.label).toBe("Minimal change");
    expect(snapshot.entryId).toBeNull();
    expect(snapshot.needs).toEqual([]);

    expect((await post(server, { entryId: "nope" })).status).toBe(404);
    expect((await post(server, { package: "Imaginary" })).status).toBe(400);
    expect((await fetch(new URL("/api/simulation-snapshots/sim_missing", server.url))).status).toBe(404);
  });
});
