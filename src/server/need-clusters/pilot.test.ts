import { expect, test } from "bun:test";
import { clusterPilot, journalRevision, type PilotManifest } from "./pilot";
import type { JournalEntry } from "../../engine/types";
const entry = (id: string, patch: Partial<JournalEntry> = {}): JournalEntry => ({
  id, text: "We need frequent buses.", author: "Private name", createdAt: "2026-11-01T00:00:00Z",
  extraction: { needs: [{ id: "transport", confidence: 1 }] } as JournalEntry["extraction"],
  corrected: false, moderation: { status: "published", reason: "reviewed", decidedAt: "2026-11-01" }, ...patch,
});
const manifest = (entries: JournalEntry[]): PilotManifest => ({ repository: "adnanwahab/dear_congress",
  taxonomyVersion: "pilot-1", localityVersion: "verified-1", topicIds: ["transport"],
  authorizations: entries.map(e => ({ entryId: e.id, revision: journalRevision(e), consent: "granted", locality: "Houston" })),
});
test("duplicate grouping is deterministic, private and leaves sources intact", () => {
  const entries = [entry("b"), entry("a")];
  const original = JSON.stringify(entries);
  const m = manifest(entries);
  const result = clusterPilot(entries, m);
  expect(result).toEqual(clusterPilot([...entries].reverse(), { ...m, authorizations: [...m.authorizations].reverse() }));
  expect(result.clusters).toHaveLength(1);
  expect(result.clusters[0]!.members.map(m => m.entryId)).toEqual(["a", "b"]);
  expect(result.clusters[0]!.status).toBe("pending");
  expect(result.clusters[0]!.distinctParticipants).toBeNull();
  expect(result.clusters[0]!.exemplars).toEqual([]);
  expect(JSON.stringify(result)).not.toContain("Private name");
  expect(JSON.stringify(result)).not.toContain(entries[0]!.text);
  expect(JSON.stringify(entries)).toBe(original);
});
test("source, locality, half-open UTC month and wording never cross partitions", () => {
  const entries = [entry("a"), entry("b", { source: "other-client" }),
    entry("c", { createdAt: "2026-12-01T00:00:00Z" }), entry("d"),
    entry("e", { text: "We do not need frequent buses." }),
    entry("f", { text: "Necesitamos autobuses frecuentes." }),
    entry("g", { text: "We need frequent school buses." })];
  const m = manifest(entries); m.authorizations[3]!.locality = "Austin";
  expect(clusterPilot(entries, m).clusters).toHaveLength(7);
});
test("missing, withdrawn and stale consent, moderation and ambiguous metadata fail closed", () => {
  const entries = [entry("missing"), entry("withdrawn"), entry("stale"),
    entry("hidden", { moderation: { status: "hidden", reason: "private", decidedAt: "today" } }),
    entry("synthetic", { synthetic: true }), entry("seed", { seeded: true }),
    entry("locality"), entry("time", { createdAt: "invalid" }),
    entry("topics", { extraction: { needs: [{ id: "transport", confidence: 1 }, { id: "housing", confidence: 1 }] } as JournalEntry["extraction"] })];
  const m = manifest(entries); m.authorizations.shift();
  m.authorizations[0]!.consent = "withdrawn";
  entries[2]!.text = "changed after consent";
  m.authorizations.find(a => a.entryId === "locality")!.locality = "";
  const result = clusterPilot(entries, m);
  expect(result.clusters).toEqual([]);
  expect(new Set(result.excluded.map(e => e.reason))).toEqual(new Set([
    "no-current-consent", "stale-consent", "not-published", "non-pilot-source", "unknown-locality", "invalid-time", "ambiguous-topic",
  ]));
});
test("withdrawal removes membership and changes run; duplicate identities are rejected", () => {
  const entries = [entry("a"), entry("b")]; const m = manifest(entries);
  const before = clusterPilot(entries, m);
  m.authorizations[0]!.consent = "withdrawn";
  const after = clusterPilot(entries, m);
  expect(after.runId).not.toBe(before.runId);
  expect(after.clusters[0]!.members.map(m => m.entryId)).toEqual(["b"]);
  expect(() => clusterPilot([entries[0]!, entries[0]!], m)).toThrow("Duplicate journal identity");
  expect(() => clusterPilot(entries, { ...m, authorizations: [m.authorizations[0]!, m.authorizations[0]!] })).toThrow("Duplicate authorization");
});
test("CLI consumes existing DB shape without changing snapshot or disclosing wording", async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(`${tmpdir()}/cluster-pilot-`);
  try {
    const entries = [entry("a"), entry("b")]; const snapshot = JSON.stringify({ entries, votes: ["preserved"] });
    await writeFile(`${dir}/db.json`, snapshot);
    await writeFile(`${dir}/manifest.json`, JSON.stringify(manifest(entries)));
    const process = Bun.spawn(["bun", "run", "clusters:pilot", `${dir}/db.json`, `${dir}/manifest.json`], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(process.stdout).text();
    expect(await process.exited).toBe(0);
    expect(JSON.parse(output).clusters[0].members).toHaveLength(2);
    expect(await readFile(`${dir}/db.json`, "utf8")).toBe(snapshot);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
