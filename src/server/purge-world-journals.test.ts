import { describe, expect, test } from "bun:test";
import { emptyDB, extract } from "../engine/engine";
import type { DB, JournalEntry } from "../engine/types";
import { applyPurge, planPurge, worldSignature } from "./purge-world-journals";

const OLD = "Hana Smith from tile 29.729,-95.475: I'm worried about burnout. Today I noticed: Patel Diner sold out. I want policies that improve daily life in this neighborhood.";
const OLD_STORM = "Ivan Chen from tile 40.727,-73.982: I'm worried about exhaustion. After the storm, 22 parcels flooded. I want policies that improve daily life in this neighborhood.";
const NEW = "Our street flooded in the storm and the drainage couldn't keep up. I need a practical fix soon.";
const NEW_PLACE = "Khan Market had empty shelves when I arrived for groceries. This keeps disrupting my daily life.";
const REAL_FLOOD = "Our street flooded in the storm and the drainage couldn't keep up. My kids missed a week of school and we lost the car.";
const REAL = "Rent went up again and the bus to work takes over an hour.";

let n = 0;
const entry = (text: string, author = "Journal Client", extra: Partial<JournalEntry> = {}): JournalEntry => ({
  id: `e${n++}`, author, text, createdAt: "2026-10-31T20:00:00.000Z", extraction: extract(text), corrected: false, ...extra,
});

function db(entries: JournalEntry[]): DB {
  const d = emptyDB();
  d.entries = entries;
  return d;
}

describe("worldSignature", () => {
  test("recognizes both world formats", () => {
    expect(worldSignature(OLD)).toBe("old-template");
    expect(worldSignature(OLD_STORM)).toBe("old-template");
    expect(worldSignature(NEW)).toBe("journal-js");
    expect(worldSignature(NEW_PLACE)).toBe("journal-js");
  });
  test("leaves real writing alone, even when it shares a sentence", () => {
    expect(worldSignature(REAL)).toBeNull();
    expect(worldSignature(REAL_FLOOD)).toBeNull();
    expect(worldSignature("I need a practical fix soon.")).toBeNull(); // one sentence alone isn't enough
  });
});

describe("planPurge / applyPurge", () => {
  const build = () => {
    const d = db([
      entry(OLD), entry(NEW),
      entry(REAL),                                    // real, Journal Client
      entry(REAL_FLOOD),                              // real, shares a world sentence
      entry(NEW, "Simulated resident", { synthetic: true, source: "happybearlandia-world" }),
      entry(OLD, "Jordan · East End"),                // world-looking text, other author → review only
    ]);
    // An emergent need created by the old-template entry, and one still used by a real entry.
    d.emergentNeeds = [
      { id: "emergent_need_hana_1", label: "Hana Smith Tile", value: "", goal: "", metric: "", level: "", keywords: [], emergent: true, sourceText: OLD.slice(0, 240) },
      { id: "emergent_need_rent_2", label: "Rent", value: "", goal: "", metric: "", level: "", keywords: [], emergent: true, sourceText: REAL },
    ];
    d.entries[0]!.extraction = { ...d.entries[0]!.extraction, needs: [{ id: "emergent_need_hana_1", confidence: 1 }] };
    d.entries[2]!.extraction = { ...d.entries[2]!.extraction, needs: [{ id: "emergent_need_rent_2", confidence: 1 }] };
    return d;
  };

  test("plans only unflagged Journal Client world entries", () => {
    const plan = planPurge(build());
    expect(plan.entries.map((e) => e.text)).toEqual([OLD, NEW]);
    expect(plan.review.length).toBe(1);
    expect(plan.alreadyFlagged).toBe(1);
    expect(plan.emergentNeeds.map((x) => x.id)).toEqual(["emergent_need_hana_1"]);
  });

  test("delete removes them and their orphaned emergent need, nothing else", () => {
    const d = build();
    const before = d.entries.length;
    const applied = applyPurge(d, planPurge(d), "delete");
    expect(applied).toEqual({ entries: 2, emergentNeeds: 1 });
    expect(d.entries.length).toBe(before - 2);
    expect(d.entries.map((e) => e.text)).toContain(REAL);
    expect(d.entries.map((e) => e.text)).toContain(REAL_FLOOD);
    expect(d.emergentNeeds.map((x) => x.id)).toEqual(["emergent_need_rent_2"]);
  });

  test("flag keeps them but marks them synthetic", () => {
    const d = build();
    const before = d.entries.length;
    applyPurge(d, planPurge(d), "flag");
    expect(d.entries.length).toBe(before);
    expect(d.entries.filter((e) => worldSignature(e.text) && e.author === "Journal Client").every((e) => e.synthetic)).toBe(true);
    expect(d.entries.find((e) => e.text === REAL)!.synthetic).toBeUndefined();
  });

  test("running it twice finds nothing the second time", () => {
    const d = build();
    applyPurge(d, planPurge(d), "delete");
    expect(planPurge(d).entries.length).toBe(0);
  });
});
