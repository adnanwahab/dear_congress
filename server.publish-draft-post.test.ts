import { describe, expect, test } from "bun:test";
import type { Extraction, JournalEntry, NeedDef, Proposal } from "./src/engine/types";
import { handlePublishDraftPost, PublishDraftInputError } from "./src/server/publish-draft-handler";

const needs: NeedDef[] = [{
  id: "housing",
  label: "Housing affordability",
  value: "Family stability",
  goal: "Rent should be affordable",
  metric: "rent burden",
  level: "City",
  keywords: ["rent"],
}];

const proposals: Proposal[] = [{
  id: "h_vouchers",
  needId: "housing",
  title: "Expand vouchers",
  mechanism: "Voucher",
  authority: "HUD",
  jurisdiction: "United States",
  costB: 12,
  changeLevel: 2,
  reversibility: 0.7,
  evidence: 0.7,
  effectiveness: 0.7,
  keywords: ["voucher"],
  metrics: [],
  legalChange: "Appropriations",
}];

function extraction(needId = "housing"): Extraction {
  return {
    needs: [{ id: needId, confidence: 0.9 }],
    importance: 0.6,
    concerns: [],
    constraints: [],
    proposalIds: [],
  };
}

describe("handlePublishDraftPost", () => {
  test("returns journal response shape in default journal mode", async () => {
    let saved = 0;
    const created: JournalEntry[] = [];

    const result = await handlePublishDraftPost(
      { text: "Rent is too high", author: "A" },
      {
        defaultKind: "journal",
        currentNeeds: () => needs,
        normalizeNeedIds: () => ({ submitted: [], valid: [], ignored: [] }),
        buildContext: () => ({ proposals, needs }),
        extractWithLLM: async () => ({ provider: "fallback", extraction: extraction(), proposedNeed: null }),
        ensureNeedCoverage: (_text, ex) => ex,
        recordAnswer: () => ({ proposalId: "h_vouchers", isNew: false }),
        createJournalEntry: ({ text, author, extraction, corrected }) => {
          const entry: JournalEntry = {
            id: "entry-1",
            text,
            author: author ?? "",
            extraction,
            corrected,
            createdAt: new Date().toISOString(),
          };
          created.push(entry);
          return entry;
        },
        save: async () => { saved += 1; },
      },
    );

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("journal");
    if (result.mode === "journal") {
      expect(result.entryId).toBe("entry-1");
      expect(result.acceptedNeedIds).toEqual([]);
      expect(result.ignoredNeedIds).toEqual([]);
      expect(result.entry.text).toBe("Rent is too high");
    }
    expect(created.length).toBe(1);
    expect(saved).toBe(1);
  });

  test("returns answer response shape when kind=answer with explicit needId", async () => {
    let saved = 0;
    let recordCalls = 0;

    const result = await handlePublishDraftPost(
      { text: "More vouchers", kind: "answer", needId: "housing" },
      {
        defaultKind: "journal",
        voterId: "v1",
        currentNeeds: () => needs,
        normalizeNeedIds: () => ({ submitted: [], valid: [], ignored: [] }),
        buildContext: () => ({ proposals, needs }),
        extractWithLLM: async () => ({ provider: "fallback", extraction: extraction(), proposedNeed: null }),
        ensureNeedCoverage: (_text, ex) => ex,
        recordAnswer: () => {
          recordCalls += 1;
          return { proposalId: "h_vouchers", isNew: false };
        },
        createJournalEntry: () => {
          throw new Error("should not create journal entry in answer mode");
        },
        save: async () => { saved += 1; },
      },
    );

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("answer");
    if (result.mode === "answer") {
      expect(result.needId).toBe("housing");
      expect(result.proposalId).toBe("h_vouchers");
      expect(result.isNew).toBe(false);
    }
    expect(recordCalls).toBe(1);
    expect(saved).toBe(1);
  });

  test("throws input error for missing text", async () => {
    await expect(handlePublishDraftPost(
      { kind: "journal" },
      {
        defaultKind: "journal",
        currentNeeds: () => needs,
        normalizeNeedIds: () => ({ submitted: [], valid: [], ignored: [] }),
        buildContext: () => ({ proposals, needs }),
        extractWithLLM: async () => ({ provider: "fallback", extraction: extraction(), proposedNeed: null }),
        ensureNeedCoverage: (_text, ex) => ex,
        recordAnswer: () => ({ proposalId: "h_vouchers", isNew: false }),
        createJournalEntry: () => {
          throw new Error("unreachable");
        },
        save: async () => undefined,
      },
    )).rejects.toBeInstanceOf(PublishDraftInputError);
  });
});

describe("handlePublishDraftPost · synthetic", () => {
  const deps = (created: JournalEntry[]) => ({
    defaultKind: "journal",
    currentNeeds: () => needs,
    normalizeNeedIds: () => ({ submitted: [], valid: [], ignored: [] }),
    buildContext: () => ({ proposals, needs }),
    extractWithLLM: async () => ({ provider: "fallback", extraction: extraction(), proposedNeed: null }),
    ensureNeedCoverage: (_text: string, ex: Extraction) => ex,
    recordAnswer: () => ({ proposalId: "h_vouchers", isNew: false }),
    createJournalEntry: (input: { text: string; author?: string; extraction: Extraction; corrected: boolean; synthetic?: boolean; source?: string }) => {
      const entry: JournalEntry = { id: `e${created.length}`, text: input.text, author: input.author ?? "x", createdAt: "", extraction: input.extraction, corrected: input.corrected, synthetic: input.synthetic, source: input.source };
      created.push(entry);
      return entry;
    },
    save: async () => {},
  });

  test("stores the synthetic flag and source on journals", async () => {
    const created: JournalEntry[] = [];
    await handlePublishDraftPost({ text: "Rent is too high", synthetic: true, source: "happybearlandia-world" }, deps(created));
    await handlePublishDraftPost({ text: "Rent is too high" }, deps(created));
    expect(created[0]!.synthetic).toBe(true);
    expect(created[0]!.source).toBe("happybearlandia-world");
    expect(created[1]!.synthetic).toBe(false);
  });

  test("rejects synthetic answers, which could create ballot options", async () => {
    await expect(handlePublishDraftPost({ text: "More vouchers", kind: "answer", needId: "housing", synthetic: true }, deps([])))
      .rejects.toBeInstanceOf(PublishDraftInputError);
  });
});
