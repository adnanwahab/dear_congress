// Find and remove journals that happybearlandia's /world posted before dear-congress
// understood the `synthetic` flag. Those were stored as ordinary entries (author
// "Journal Client"), so they count as real people.
//
// Matching is by the exact text the world generates, never by author alone: other real
// journal clients also post as "Journal Client".

import type { DB, JournalEntry, NeedDef } from "../engine/types";

/** Old template in world/render.js (commits 85ff5ee … 25339f7). */
const OLD_TEMPLATE =
  /^.{1,80} from tile -?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?: I'm worried about .+ I want policies that improve daily life in this neighborhood\.$/s;

/** Every sentence world/journal.js can produce (`{place}` = a building name). */
const JOURNAL_JS_SENTENCES = [
  "Our street flooded in the storm and the drainage couldn't keep up.",
  "Flood water reached our home area again, and the drainage failed us.",
  "After the storm, we saw flood water around us and weak drainage made it worse.",
  "My commute keeps getting longer and I lose too much time each day.",
  "The bus trip for my commute takes too long and throws off my day.",
  "I need a shorter commute because the bus connection is too slow.",
  "I reported the trashed park to 311 again and it still needs attention.",
  "After repeated dirty park visits, I called 311 again for cleanup.",
  "I had to use 311 again because the park stayed filthy.",
  "I went to {place} and basic groceries were sold out when I got there.",
  "{place} had empty shelves when I arrived for groceries.",
  "At {place}, the shelves were empty again when I tried to buy groceries.",
  "Our fridge was empty tonight and it was hard to find groceries nearby.",
  "I came home to an empty fridge and struggled to get basic groceries.",
  "We ran out at home and finding groceries nearby was difficult.",
  "This keeps disrupting my daily life.",
  "I'm sharing this because it keeps happening.",
  "I need a practical fix soon.",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SENTENCE_RE = new RegExp(
  `^(?:${JOURNAL_JS_SENTENCES.map((s) => esc(s).replace("\\{place\\}", "[^.!?]{1,80}")).join("|")})$`,
);

/** A journal.js entry is 2–4 known sentences and nothing else. */
function isJournalJsText(text: string): boolean {
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences.length >= 2 && sentences.length <= 4 && sentences.every((s) => SENTENCE_RE.test(s));
}

export type WorldMatch = "old-template" | "journal-js";

export function worldSignature(text: string): WorldMatch | null {
  const t = text.trim();
  if (OLD_TEMPLATE.test(t)) return "old-template";
  if (isJournalJsText(t)) return "journal-js";
  return null;
}

export interface PurgePlan {
  /** Unflagged world journals posted as "Journal Client": these get removed/flagged. */
  entries: { id: string; createdAt: string; match: WorldMatch; text: string }[];
  /** World-looking text under another author: reported only, never touched. */
  review: { id: string; author: string; createdAt: string; match: WorldMatch; text: string }[];
  /** Emergent needs created only because of those entries. */
  emergentNeeds: { id: string; label: string }[];
  alreadyFlagged: number;
}

export function planPurge(db: DB, author = "Journal Client"): PurgePlan {
  const entries: PurgePlan["entries"] = [];
  const review: PurgePlan["review"] = [];
  let alreadyFlagged = 0;

  for (const e of db.entries) {
    const match = worldSignature(e.text);
    if (!match) continue;
    if (e.synthetic) { alreadyFlagged++; continue; }
    if (e.seeded) continue;
    const row = { id: e.id, createdAt: e.createdAt, match, text: e.text };
    if (e.author === author) entries.push(row);
    else review.push({ ...row, author: e.author });
  }

  const removed = new Set(entries.map((e) => e.id));
  const removedTexts = db.entries.filter((e) => removed.has(e.id)).map((e) => e.text);
  const stillUsed = new Set<string>();
  for (const e of db.entries) if (!removed.has(e.id)) for (const n of e.extraction.needs) stillUsed.add(n.id);
  for (const a of db.answers ?? []) stillUsed.add(a.needId);
  for (const p of db.emergent ?? []) stillUsed.add(p.needId);

  const emergentNeeds = (db.emergentNeeds ?? [])
    .filter((n: NeedDef) =>
      !stillUsed.has(n.id) &&
      !!n.sourceText &&
      removedTexts.some((t) => t.startsWith(n.sourceText!)))
    .map((n) => ({ id: n.id, label: n.label }));

  return { entries, review, emergentNeeds, alreadyFlagged };
}

export type PurgeMode = "delete" | "flag";

/**
 * Apply a plan from planPurge. "delete" removes the entries and their orphaned emergent
 * needs. "flag" keeps them but marks them synthetic (excluded from needs by default).
 */
export function applyPurge(db: DB, plan: PurgePlan, mode: PurgeMode): { entries: number; emergentNeeds: number } {
  const ids = new Set(plan.entries.map((e) => e.id));
  if (mode === "flag") {
    for (const e of db.entries as JournalEntry[]) {
      if (ids.has(e.id)) { e.synthetic = true; e.source = e.source ?? "happybearlandia-world (flagged by purge)"; }
    }
    return { entries: ids.size, emergentNeeds: 0 };
  }
  const needIds = new Set(plan.emergentNeeds.map((n) => n.id));
  db.entries = db.entries.filter((e) => !ids.has(e.id));
  db.emergentNeeds = (db.emergentNeeds ?? []).filter((n) => !needIds.has(n.id));
  return { entries: ids.size, emergentNeeds: needIds.size };
}
