import { describe, expect, test } from "bun:test";
import { NEEDS } from "./src/engine/catalog";
import { emptyDB, extract } from "./src/engine/engine";
import { publishLabelsOptions, publishLabelsPost } from "./src/server/publish-labels";
import type { DB, JournalEntry } from "./src/engine/types";

const NEED_IDS = new Set(NEEDS.map((n) => n.id));

function normalizeNeedIds(v: unknown) {
  const submitted = Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  const valid = submitted.filter((id) => NEED_IDS.has(id));
  const ignored = submitted.filter((id) => !NEED_IDS.has(id));
  return { submitted, valid, ignored };
}

function publishCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "entry-1",
    author: "test",
    text: "I need childcare support and school access",
    createdAt: new Date().toISOString(),
    extraction: extract("I need childcare support and school access"),
    corrected: false,
    ...overrides,
  };
}

function makeDb(entries: JournalEntry[] = []): DB {
  return {
    ...emptyDB(),
    entries,
  };
}

describe("publish_labels handlers", () => {
  test("OPTIONS responds with preflight CORS headers", async () => {
    const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
    const req = new Request("http://test.local/api/publish_labels", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:8080",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    const res = publishLabelsOptions(req, {
      logPublishEvent: (event, payload) => events.push({ event, payload }),
      publishCorsHeaders,
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(events[0]?.event).toBe("PUBLISH_LABELS_PREFLIGHT");
  });

  test("POST rejects invalid JSON", async () => {
    const db = makeDb([makeEntry()]);
    const req = new Request("http://test.local/api/publish_labels", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:8080",
      },
      body: "not-json",
    });

    const res = await publishLabelsPost(req, {
      db,
      save: async () => undefined,
      normalizeNeedIds,
      logPublishEvent: () => undefined,
      publishCorsHeaders,
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid json body");
  });

  test("POST rejects missing entryId", async () => {
    const db = makeDb([makeEntry()]);
    const req = new Request("http://test.local/api/publish_labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ labels: ["childcare"] }),
    });

    const res = await publishLabelsPost(req, {
      db,
      save: async () => undefined,
      normalizeNeedIds,
      logPublishEvent: () => undefined,
      publishCorsHeaders,
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("entryId is required");
  });

  test("POST rejects unknown entryId", async () => {
    const db = makeDb([makeEntry()]);
    const req = new Request("http://test.local/api/publish_labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId: "missing", labels: ["childcare"] }),
    });

    const res = await publishLabelsPost(req, {
      db,
      save: async () => undefined,
      normalizeNeedIds,
      logPublishEvent: () => undefined,
      publishCorsHeaders,
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("entry not found");
  });

  test("POST accepts valid labels and updates entry", async () => {
    const entry = makeEntry({ id: "entry-ok" });
    const db = makeDb([entry]);
    let saveCalls = 0;

    const req = new Request("http://test.local/api/publish_labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId: "entry-ok", labels: ["childcare"] }),
    });

    const res = await publishLabelsPost(req, {
      db,
      save: async () => {
        saveCalls += 1;
      },
      normalizeNeedIds,
      logPublishEvent: () => undefined,
      publishCorsHeaders,
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      ok: boolean;
      entryId: string;
      acceptedNeedIds: string[];
      entry: { corrected: boolean; extraction: { needs: { id: string }[] } };
    };

    expect(json.ok).toBe(true);
    expect(json.entryId).toBe("entry-ok");
    expect(json.acceptedNeedIds).toEqual(["childcare"]);
    expect(json.entry.corrected).toBe(true);
    expect(json.entry.extraction.needs.map((n) => n.id)).toEqual(["childcare"]);
    expect(saveCalls).toBe(1);
  });
});
