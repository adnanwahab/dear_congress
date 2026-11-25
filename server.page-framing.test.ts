import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyDB } from "./src/engine/engine";

test("regular pages may be framed by Helios but not by arbitrary sites; /embed keeps its own policy", async () => {
  const dir = await mkdtemp(join(tmpdir(), "page-framing-"));
  const dbPath = join(dir, "db.json");
  await Bun.write(dbPath, JSON.stringify({ ...emptyDB(), schemaVersion: 2 }));
  const previous = { DB_PATH: process.env.DB_PATH, PORT: process.env.PORT, FRAME_ANCESTORS: process.env.FRAME_ANCESTORS, PAGE_FRAME_ANCESTORS: process.env.PAGE_FRAME_ANCESTORS };
  let server: { url: URL; stop(closeConnections?: boolean): void } | undefined;
  try {
    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.FRAME_ANCESTORS = "*";
    process.env.PAGE_FRAME_ANCESTORS = "'self' https://helios-ai-laws.fly.dev";
    server = (await import(`./server.ts?page-framing=${crypto.randomUUID()}`)).server;
    for (const path of ["/", "/votes"]) {
      const res = await fetch(new URL(path, server!.url));
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp).toContain("frame-ancestors 'self' https://helios-ai-laws.fly.dev");
      expect(csp).not.toContain("frame-ancestors *");
      expect(res.headers.get("x-frame-options")).toBeNull();
    }
    const embed = await fetch(new URL("/embed", server!.url));
    expect(embed.headers.get("content-security-policy")).toContain("frame-ancestors *");
  } finally {
    server?.stop(true);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
