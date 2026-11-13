import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyDB } from "./src/engine/engine";

test("healthz is uncached process liveness and leaves persisted data unchanged", async () => {
  const dir = await mkdtemp(join(tmpdir(), "she-287-"));
  const dbPath = join(dir, "db.json");
  const before = JSON.stringify({ ...emptyDB(), schemaVersion: 2 });
  await Bun.write(dbPath, before);
  const previous = { DB_PATH: process.env.DB_PATH, PORT: process.env.PORT };
  let server: { url: URL; stop(closeConnections?: boolean): void } | undefined;
  try {
    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    server = (await import(`./server.ts?healthz=${crypto.randomUUID()}`)).server;
    const response = await fetch(new URL("/healthz", server!.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ ok: true, service: "civic-synthesis", mode: "demo" });
    const head = await fetch(new URL("/healthz", server!.url), { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect((await fetch(new URL("/healthz", server!.url), { method: "POST" })).status).toBe(405);
    expect(await Bun.file(dbPath).text()).toBe(before);
  } finally {
    server?.stop(true);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
