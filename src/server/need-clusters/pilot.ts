import { createHash } from "node:crypto";
import type { JournalEntry } from "../../engine/types";

export const MODEL = "exact-wording-utc-month-v1";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Revision includes privacy/eligibility state, not just wording. Private: never publish. */
export function journalRevision(entry: JournalEntry): string {
  return digest([entry.id, entry.text, entry.createdAt, entry.source ?? null,
    entry.seeded ?? false, entry.synthetic ?? false, entry.moderation ? [entry.moderation.status, entry.moderation.reason, entry.moderation.decidedAt] : null,
    entry.extraction.needs.map(n => n.id).sort()]);
}
export interface PilotAuthorization {
  entryId: string;
  revision: string;
  consent: "granted" | "withdrawn";
  /** Operator-verified locality; never inferred from text, author or coordinates. */
  locality: string;
}
export interface PilotManifest {
  repository: "adnanwahab/dear_congress";
  taxonomyVersion: string;
  localityVersion: string;
  topicIds: string[];
  authorizations: PilotAuthorization[];
}

/** Private sidecar only. Exact matches abstain from semantic/paraphrase inference. */
export function clusterPilot(entries: JournalEntry[], manifest: PilotManifest) {
  if (manifest.repository !== "adnanwahab/dear_congress" || !manifest.taxonomyVersion || !manifest.localityVersion
    || !Array.isArray(manifest.topicIds) || manifest.topicIds.some(t => !t)) throw new Error("Invalid pilot manifest");
  const sorted = [...entries].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(sorted.map(e => e.id)).size !== sorted.length) throw new Error("Duplicate journal identity");
  const auth = new Map<string, PilotAuthorization>();
  for (const a of manifest.authorizations) {
    if (auth.has(a.entryId)) throw new Error("Duplicate authorization");
    auth.set(a.entryId, a);
  }
  const excluded: { entryId: string; reason: string }[] = [];
  const groups = new Map<string, { id: string; locality: string; window: string; topic: string;
    reason: string; uncertainty: string; status: "pending"; members: { entryId: string; revision: string }[];
    distinctParticipants: null; exemplars: never[] }>();
  for (const entry of sorted) {
    const a = auth.get(entry.id);
    const topics = [...new Set(entry.extraction.needs.map(n => n.id))].sort();
    const timestamp = Date.parse(entry.createdAt);
    const reason = entry.seeded || entry.synthetic ? "non-pilot-source"
      : entry.moderation?.status !== "published" ? "not-published"
      : !a || a.consent !== "granted" ? "no-current-consent"
      : a.revision !== journalRevision(entry) ? "stale-consent"
      : !a.locality?.trim() ? "unknown-locality"
      : !Number.isFinite(timestamp) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(entry.createdAt) ? "invalid-time"
      : topics.length !== 1 || !manifest.topicIds.includes(topics[0]!) ? "ambiguous-topic"
      : !entry.text.trim() ? "empty-wording" : null;
    if (reason) { excluded.push({ entryId: entry.id, reason }); continue; }
    const locality = a!.locality;
    const window = new Date(timestamp).toISOString().slice(0, 7);
    const topic = topics[0]!;
    // Preserve punctuation, negation, Unicode and case. Never join through similarity chains.
    const key = digest([manifest.repository, "journal", entry.source ?? null, locality, window, topic, entry.text]);
    if (!groups.has(key)) groups.set(key, { id: key, locality, window, topic,
      reason: "Identical original wording, source client, verified locality, UTC month and single topic",
      uncertainty: "Exact wording only; shared intent and distinct people are unverified",
      status: "pending", members: [], distinctParticipants: null, exemplars: [] });
    groups.get(key)!.members.push({ entryId: entry.id, revision: journalRevision(entry) });
  }
  const clusters = [...groups.values()].sort((a, b) => a.id < b.id ? -1 : 1);
  const config = { repository: manifest.repository, taxonomyVersion: manifest.taxonomyVersion,
    localityVersion: manifest.localityVersion, topicIds: [...manifest.topicIds].sort(),
    authorizations: [...manifest.authorizations].sort((a,b) => a.entryId < b.entryId ? -1 : 1)
      .map(a => [a.entryId, a.revision, a.consent, a.locality]) };
  const snapshotDigest = digest(sorted.map(e => [e.id, journalRevision(e)]));
  const runId = digest([MODEL, config, snapshotDigest]);
  return { repository: manifest.repository, itemKind: "journal", model: MODEL, runId, snapshotDigest, advisoryOnly: true, privateReviewOnly: true,
    countUnit: "journal entries, not people", clusters, excluded };
}
