import { expect, test, spyOn } from "bun:test";
import { emptyDB } from "./src/engine/engine";

// Capture Bun routes to exercise the real shared HTTP boundary without a listening socket.
test("journal aliases hold contact details; reports and admin hide survive reload without public leakage", async () => {
  const path = `/tmp/she283-${crypto.randomUUID()}.json`;
  const old = { ...process.env };
  let options: any;
  const serving = spyOn(Bun, "serve").mockImplementation((input: any) => {
    options = input;
    return { url: new URL("http://localhost:3100"), stop() {} } as any;
  });
  try {
    process.env.DB_PATH = path;
    process.env.ADMIN_TOKEN = "test-admin-token";
    process.env.PUBLIC_IP_LIMIT = "1000";
    process.env.PUBLIC_ID_LIMIT = "1000";
    await Bun.write(path, JSON.stringify(emptyDB()));
    await import(`./server.ts?moderation=${crypto.randomUUID()}`);
    const call = async (route: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) => {
      const request = new Request(`http://localhost:3100${route}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
      return options.routes[route.split("?")[0]!][method](request, { requestIP: () => ({ address: "127.0.0.1" }) });
    };
    for (const alias of ["/api/journal", "/api/entries", "/api/publish_draft"]) {
      const result = await call(alias, "POST", { text: "Rent is high. Email me at private@example.com", kind: "answer", needId: "housing", source: "source-client" });
      expect(result.status).toBe(202);
      expect((await result.json()).status).toBe("pending");
    }
    const authorHold = await call("/api/entries", "POST", { text: "Rent is high", author: "713-555-1234" });
    expect(authorHold.status).toBe(202);
    expect((await call("/api/entries").then((r: Response) => r.json())).entries).toEqual([]);
    expect((await Bun.file(path).json()).answers).toEqual([]);
    const published = await call("/api/journal", "POST", { text: "Rent is too high.", author: "Resident", location: { lat: 29.72, lng: -95.47 } });
    expect(published.status).toBe(200);
    const entry = await published.json();
    expect((await call("/admin/moderation")).status).toBe(401);
    const auth = { authorization: "Bearer test-admin-token", origin: "http://localhost:3100" };
    expect((await call("/admin/moderation", "GET", undefined, auth)).status).toBe(200);
    expect((await call("/api/reports", "POST", { entryId: entry.id, reason: "Abusive entry" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await call("/api/reports", "POST", { entryId: entry.id, reason: "Abusive entry" })).status).toBe(200);
    const decision = { entryId: entry.id, action: "hide", reason: "Reviewed report" };
    expect((await call("/api/admin/moderation", "POST", decision)).status).toBe(401);
    expect((await call("/api/admin/moderation", "POST", decision, { ...auth, origin: "https://evil.example" })).status).toBe(403);
    expect((await call("/api/admin/moderation", "POST", decision, auth)).status).toBe(200);
    for (const route of ["/api/entries", "/api/journals", "/api/ballot_entries", "/api/state"]) {
      const response = await call(route);
      expect(await response.text()).not.toContain("Rent is too high.");
    }
    const geo = await call("/api/needs/geo?bbox=29,-96,30,-95&mode=both");
    expect(geo.status).toBe(200);
    const geoData = await geo.json();
    expect(geoData.cells).toEqual([]);
    const stream = await call("/api/entries/events");
    const reader = stream.body!.getReader();
    const initial = await reader.read();
    expect(new TextDecoder().decode(initial.value)).toContain('"entries":[]');
    await reader.cancel();
    const synth = await call("/api/synthesize", "POST", { includeSynthetic: true });
    expect(synth.status).toBe(200);
    expect(await synth.text()).not.toContain("Rent is too high.");
    const saved = await Bun.file(path).json();
    expect(saved.entries).toHaveLength(5);
    expect(saved.entries[0].source).toBe("source-client");
    expect(saved.journalReports).toHaveLength(1);
    expect(saved.journalModerationLog).toHaveLength(1);
    await import(`./server.ts?moderation=${crypto.randomUUID()}`);
    expect((await call("/api/entries").then((r: Response) => r.json())).entries).toEqual([]);
    expect(await call("/admin/moderation", "GET", undefined, auth).then((r: Response) => r.text())).toContain("Abusive entry");
  } finally {
    serving.mockRestore();
    for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key];
    Object.assign(process.env, old);
    await Bun.file(path).delete();
  }
});
