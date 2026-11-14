import { journalOrigin } from "../shared/journal-origin";
import { createHash } from "node:crypto";
import type { DB, JournalEntry } from "../engine/types";

const ownerHash = (id: string) => createHash("sha256").update(`journal-owner:${id}`).digest("hex");

/** Drop coordinates and client tile identifiers on every public journal surface. */
export function publicJournal(entry: JournalEntry): JournalEntry {
  const { id, author, text, createdAt, extraction, corrected, seeded, synthetic, source } = entry;
  return { id, author, text, createdAt, extraction, corrected, origin: journalOrigin(entry),
    ...(seeded !== undefined ? { seeded } : {}),
    ...(synthetic !== undefined ? { synthetic } : {}),
    ...(source !== undefined ? { source } : {}),
  };
}

export function claimJournal(db: DB, entryId: string, browserId: string) {
  (db.journalOwners ??= {})[entryId] = ownerHash(browserId);
}

export function ownJournalIds(db: DB, browserId: string) {
  const hash = ownerHash(browserId);
  return db.entries.filter(entry => db.journalOwners?.[entry.id] === hash).map(entry => entry.id);
}

export function deleteJournal(db: DB, entryId: string, browserId: string): 200 | 403 | 404 {
  const index = db.entries.findIndex(entry => entry.id === entryId);
  if (index < 0) return 404;
  if (db.journalOwners?.[entryId] !== ownerHash(browserId)) return 403;
  db.entries.splice(index, 1);
  delete db.journalOwners[entryId];
  // Published proposals retain their source ID and independently reviewed text.
  // Frozen plans remain intact, but no longer retain this entry's location.
  for (const snapshot of db.simulationSnapshots ?? []) {
    if (snapshot.entryId === entryId) snapshot.location = null;
  }
  return 200;
}
