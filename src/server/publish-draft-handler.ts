import { resolvePublishDraftKind, type PublishDraftKind } from "./publish-draft";
import type { Extraction, JournalEntry, NeedDef, Proposal } from "../engine/types";

export interface PublishDraftBody {
  /** Explicit no-inference publication; never invokes providers or keyword extraction. */
  inference?: "none";
  text?: string;
  author?: string;
  labels?: string[];
  needs?: string[];
  kind?: PublishDraftKind;
  needId?: string;
  /** true when a simulated resident wrote this (see JournalEntry.synthetic). */
  synthetic?: unknown;
  source?: unknown;
  location?: unknown;
  tileId?: unknown;
  metadata?: unknown;
}

function isSynthetic(v: unknown) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function validLatLng(loc: { lat: number; lng: number }) {
  return Number.isFinite(loc.lat) && Number.isFinite(loc.lng) && loc.lat >= -90 && loc.lat <= 90 && loc.lng >= -180 && loc.lng <= 180;
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
    synthetic?: boolean;
    source?: string;
    location?: { lat: number; lng: number };
    tileId?: string;
  }) => JournalEntry;
  save: () => Promise<void>;
  onExtract?: (meta: { provider: string; matchedNeedIds: string[]; mode: "journal" | "answer:auto-need" }) => void;
}

export async function handlePublishDraftPost(body: PublishDraftBody, deps: PublishDraftDeps): Promise<PublishDraftSuccess> {
  if (!body || typeof body !== "object" || typeof body.text !== "string" || !body.text.trim()) throw new PublishDraftInputError("text is required");
  if (body.text.length > 10000) throw new PublishDraftInputError("text must be at most 10000 characters");
  if (body.author !== undefined && (typeof body.author !== "string" || body.author.length > 120)) throw new PublishDraftInputError("author must be a string of at most 120 characters");
  if (body.needId !== undefined && typeof body.needId !== "string") throw new PublishDraftInputError("needId must be a string");
  const text = body.text.trim();

  const mode = resolvePublishDraftKind({
    kind: body.kind,
    needId: body.needId,
    defaultKind: deps.defaultKind,
  });

  if (body.inference !== undefined && body.inference !== "none") throw new PublishDraftInputError("inference must be none when supplied");
  if (body.inference === "none" && mode !== "journal") throw new PublishDraftInputError("no-inference publication requires kind journal");
  if (body.inference === "none" && [body.labels, body.needs].some(v => v !== undefined && (!Array.isArray(v) || v.some(id => typeof id !== "string")))) throw new PublishDraftInputError("labels and needs must be string arrays");

  const synthetic = isSynthetic(body.synthetic);
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 64) || undefined : undefined;
  const meta = (body.metadata && typeof body.metadata === "object") ? body.metadata as Record<string, unknown> : undefined;
  const rawLoc = body.location ?? ((meta && typeof meta.lat === "number" && typeof meta.lng === "number") ? { lat: meta.lat, lng: meta.lng } : undefined);
  const location = rawLoc && typeof rawLoc === "object" && Number.isFinite(Number((rawLoc as { lat?: unknown }).lat)) && Number.isFinite(Number((rawLoc as { lng?: unknown }).lng))
    ? { lat: Number((rawLoc as { lat: unknown }).lat), lng: Number((rawLoc as { lng: unknown }).lng) }
    : undefined;
  if (rawLoc && !location) throw new PublishDraftInputError("location must include numeric lat/lng");
  if (location && !validLatLng(location)) throw new PublishDraftInputError("location lat/lng out of range");
  const tileId = typeof body.tileId === "string"
    ? body.tileId.trim().slice(0, 120) || undefined
    : (meta && typeof meta.tileId === "string" ? meta.tileId.trim().slice(0, 120) || undefined : undefined);

  if (mode === "answer") {
    // Answers can create new ballot options, so simulated residents can't post them.
    if (synthetic) throw new PublishDraftInputError("synthetic posts must be kind \"journal\"");
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

  const labels = deps.normalizeNeedIds(body.labels ?? body.needs);
  let extraction: Extraction;
  if (body.inference === "none") {
    // Author-selected categories only. Neutral importance is the engine default,
    // not a judgment inferred from the author's words.
    extraction = { needs: labels.valid.map(id => ({ id, confidence: 1 })), importance: 0.5, concerns: [], constraints: [], proposalIds: [] };
  } else {
    const ctx = deps.buildContext();
    const llm = await deps.extractWithLLM(text, ctx.proposals, ctx.needs);
    extraction = llm.extraction;
    if (labels.valid.length > 0) {
      extraction = { ...extraction, needs: labels.valid.map(id => extraction.needs.find(n => n.id === id) ?? { id, confidence: 1 }) };
    } else {
      extraction = deps.ensureNeedCoverage(text, extraction, llm.proposedNeed);
    }
    deps.onExtract?.({ provider: llm.provider, matchedNeedIds: extraction.needs.map(n => n.id), mode: "journal" });
  }

  const entry = deps.createJournalEntry({
    text,
    author: body.author,
    extraction,
    corrected: body.inference === "none" || labels.valid.length > 0,
    synthetic,
    source,
    location,
    tileId,
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
