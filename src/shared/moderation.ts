import type { JournalEntry } from "../engine/types";
export const isPublicEntry = (entry: JournalEntry) => !entry.moderation || entry.moderation.status === "published";

/** Moderation reasons and audit metadata are private, even after approval. */
export function publicEntry(entry: JournalEntry): JournalEntry {
  const { moderation, ...published } = entry;
  return published;
}
