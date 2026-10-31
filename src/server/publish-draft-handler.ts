import { resolvePublishDraftKind, type PublishDraftKind } from "./publish-draft";
import type { Extraction, JournalEntry, NeedDef, Proposal } from "../engine/types";

export interface PublishDraftBody {
  text?: string;
  author?: string;
  labels?: string[];
  needs?: string[];
  kind?: PublishDraftKind;
  needId?: string;
}

interface LLMResult {
  provider: string;
  extraction: Extraction;
  proposedNeed: {
    label: string;
    goal: string;
    metric: string;
    keywords?: string[];
    value?: string;
    level?: string;
  } | null;
}

export type PublishDraftSuccess =
  | {
    ok: true;
    mode: "journal";
    entryId: string;
    acceptedNeedIds: string[];
    ignoredNeedIds: string[];
    entry: JournalEntry;
  }
  | {
    ok: true;
    mode: "answer";
    needId: string;
    proposalId: string;
    isNew: boolean;
  };

export class PublishDraftInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishDraftInputError";
  }
}

export interface PublishDraftDeps {
  defaultKind: string;
  voterId?: string;
  currentNeeds: () => NeedDef[];
  normalizeNeedIds: (v: unknown) => { submitted: string[]; valid: string[]; ignored: string[] };
  buildContext: () => { proposals: Proposal[]; needs: NeedDef[] };
  extractWithLLM: (text: string, proposals: Proposal[], needs: NeedDef[]) => Promise<LLMResult>;
  ensureNeedCoverage: (text: string, extraction: Extraction, proposedNeed?: LLMResult["proposedNeed"]) => Extraction;
  recordAnswer: (needId: string, text: string, voterId?: string) => { proposalId: string; isNew: boolean };
  createJournalEntry: (input: {
    text: string;
    author?: string;
    extraction: Extraction;
    corrected: boolean;
  }) => JournalEntry;
  save: () => Promise<void>;
  onExtract?: (meta: { provider: string; matchedNeedIds: string[]; mode: "journal" | "answer:auto-need" }) => void;
}

export async function handlePublishDraftPost(body: PublishDraftBody, deps: PublishDraftDeps): Promise<PublishDraftSuccess> {
  if (!body.text?.trim()) throw new PublishDraftInputError("text is required");
  const text = body.text.trim();

  const mode = resolvePublishDraftKind({
    kind: body.kind,
    needId: body.needId,
    defaultKind: deps.defaultKind,
  });

  if (mode === "answer") {
    let targetNeedId = body.needId?.trim() || "";

    if (!targetNeedId) {
      const ctx = deps.buildContext();
      const llm = await deps.extractWithLLM(text, ctx.proposals, ctx.needs);
      const extraction = deps.ensureNeedCoverage(text, llm.extraction, llm.proposedNeed);
      targetNeedId = extraction.needs[0]?.id ?? "";
      deps.onExtract?.({ provider: llm.provider, matchedNeedIds: extraction.needs.map((n) => n.id), mode: "answer:auto-need" });
    }

    if (!targetNeedId || !deps.currentNeeds().some((n) => n.id === targetNeedId)) {
      throw new PublishDraftInputError("answer kind requires a valid needId or detectable need");
    }

    const result = deps.recordAnswer(targetNeedId, text, deps.voterId);
    await deps.save();
    return {
      ok: true,
      mode: "answer",
      needId: targetNeedId,
      proposalId: result.proposalId,
      isNew: result.isNew,
    };
  }

  const ctx = deps.buildContext();
  const llm = await deps.extractWithLLM(text, ctx.proposals, ctx.needs);
  let extraction = llm.extraction;
  const labels = deps.normalizeNeedIds(body.labels ?? body.needs);

  if (labels.valid.length > 0) {
    extraction = {
      ...extraction,
      needs: labels.valid.map((id) => extraction.needs.find((n) => n.id === id) ?? { id, confidence: 1 }),
    };
  } else {
    extraction = deps.ensureNeedCoverage(text, extraction, llm.proposedNeed);
  }

  deps.onExtract?.({ provider: llm.provider, matchedNeedIds: extraction.needs.map((n) => n.id), mode: "journal" });

  const entry = deps.createJournalEntry({
    text,
    author: body.author,
    extraction,
    corrected: labels.valid.length > 0,
  });

  await deps.save();

  return {
    ok: true,
    mode: "journal",
    entryId: entry.id,
    acceptedNeedIds: labels.valid,
    ignoredNeedIds: labels.ignored,
    entry,
  };
}
