import index from "./index.html";
import { NEEDS, SEED_JOURNALS, CHANGE_LEVELS } from "./src/engine/catalog";
import {
  ARCHETYPES, POPULATION, JOURNAL_HALF_LIFE_DAYS, JOURNAL_REFERENCE, buildContext, clusterAnswer, diffPackages, emptyDB, extract, synthesize, tokens, DEFAULT_WEIGHTS,
} from "./src/engine/engine";
import type { Context } from "./src/engine/engine";
import type { DB, JournalEntry, NeedDef, Proposal, SynthesisOutcomes, UserVote, Weights } from "./src/engine/types";
import { publishLabelsOptions, publishLabelsPost } from "./src/server/publish-labels";
import { extractWithLLM } from "./src/server/llm-extract";
import { journalClientSchema } from "./src/server/publish-draft";
import { handlePublishDraftPost, PublishDraftInputError, type PublishDraftBody } from "./src/server/publish-draft-handler";
import { applyPurge, planPurge, type PurgeMode } from "./src/server/purge-world-journals";
import { assessIdea } from "./src/server/assess-idea";
import { recordEstimate, voterKey } from "./src/server/estimate-idea";
import { findNeedByLabel, mergeDuplicateNeeds } from "./src/server/need-dedupe";
import { DEFAULT_RUNS, DEFAULT_YEARS, SnapshotError, createSimulationSnapshot, simulationUrl, storeSnapshot } from "./src/server/simulation-snapshot";
import { timingSafeEqual } from "node:crypto";
import { CELL_SIZE_DEG, cellCoord, storeRealCoord, storeSimulatedCoord } from "./src/server/geo-cell";
import {
  loadOutcomesFile,
  measuredNeedsOutcomes,
  measuredPreviewByPackage,
  mergeOutcomes,
  parseOutcomesMode,
  type OutcomesMode,
} from "./src/server/outcomes";

const DB_PATH = process.env.DB_PATH ?? "data/db.json";
const FRAME_ANCESTORS = (process.env.FRAME_ANCESTORS ?? "'self' *").trim() || "'self' *";
const EMBED_CSP = `frame-ancestors ${FRAME_ANCESTORS}`;
const DEBUG_REQUEST_LOGS = (process.env.DEBUG_REQUEST_LOGS ?? "1") !== "0";
const PUBLISH_CORS_ALLOW_ORIGIN = (process.env.PUBLISH_CORS_ALLOW_ORIGIN ?? "*").trim() || "*";
const READ_CORS_ALLOW_ORIGIN = (process.env.READ_CORS_ALLOW_ORIGIN ?? PUBLISH_CORS_ALLOW_ORIGIN).trim() || "*";
const PUBLISH_DRAFT_DEFAULT_KIND = (process.env.PUBLISH_DRAFT_DEFAULT_KIND ?? "journal").trim().toLowerCase();
const MAP_STYLE_URL = (process.env.MAP_STYLE_URL ?? "").trim();
/** HappyBearLandia deploy that runs "Simulate realities". */
const HBL_URL = (process.env.HBL_URL ?? "https://happybearlandia.fly.dev").trim() || "https://happybearlandia.fly.dev";
const OUTCOMES_PATH = (process.env.OUTCOMES_PATH ?? "data/outcomes.json").trim() || "data/outcomes.json";
const OUTCOMES_MODE: OutcomesMode = parseOutcomesMode(process.env.OUTCOMES_MODE);

function logRequest(req: Request, route: string) {
  if (!DEBUG_REQUEST_LOGS) return;
  const url = new URL(req.url);
  console.log("[REQ]", JSON.stringify({
    ts: new Date().toISOString(),
    route,
    method: req.method,
    path: url.pathname,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    host: req.headers.get("host"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    secFetchMode: req.headers.get("sec-fetch-mode"),
    secFetchDest: req.headers.get("sec-fetch-dest"),
    userAgent: req.headers.get("user-agent"),
  }));
}

function logResponse(route: string, res: Response, extra: Record<string, unknown> = {}) {
  if (!DEBUG_REQUEST_LOGS) return;
  console.log("[RES]", JSON.stringify({
    ts: new Date().toISOString(),
    route,
    status: res.status,
    csp: res.headers.get("content-security-policy"),
    xfo: res.headers.get("x-frame-options"),
    ...extra,
  }));
}



function logPublishEvent(event: string, payload: Record<string, unknown>) {
  console.log(`[${event}]`, JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}

function corsAllowOrigin(req: Request, configured: string) {
  const requestOrigin = req.headers.get("origin");
  return configured === "auto"
    ? (requestOrigin ?? "*")
    : configured;
}

function publishCorsHeaders(req: Request) {
  return {
    "access-control-allow-origin": corsAllowOrigin(req, PUBLISH_CORS_ALLOW_ORIGIN),
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-voter-id",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function readCorsHeaders(req: Request) {
  return {
    "access-control-allow-origin": corsAllowOrigin(req, READ_CORS_ALLOW_ORIGIN),
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-voter-id",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function withPublishCors(req: Request, res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(publishCorsHeaders(req))) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function publishBad(req: Request, msg: string, status = 400) {
  return withPublishCors(req, Response.json({ error: msg }, { status }));
}

function withReadCors(req: Request, res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(readCorsHeaders(req))) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function entriesNewestFirst() {
  return [...db.entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const DB_SCHEMA_VERSION = 2;

async function load(): Promise<DB> {
  const f = Bun.file(DB_PATH);
  if (!(await f.exists())) return seed();

  const raw = (await f.json()) as Partial<DB>;
  const loaded = { ...emptyDB(), ...raw } as DB;

  // Migrate legacy single-user fields into the multi-voter maps.
  if (Object.keys(loaded.votesByVoter ?? {}).length === 0 && Object.keys(loaded.votes ?? {}).length > 0) {
    loaded.votesByVoter = { legacy: { ...loaded.votes } };
  }
  if (Object.keys(loaded.allocationByVoter ?? {}).length === 0 && Object.keys(loaded.allocation ?? {}).length > 0) {
    loaded.allocationByVoter = { legacy: { ...loaded.allocation } };
  }
  if (Object.keys(loaded.goalVotesByVoter ?? {}).length === 0 && Object.keys(loaded.goalVotes ?? {}).length > 0) {
    loaded.goalVotesByVoter = { legacy: { ...loaded.goalVotes } };
  }

  loaded.votesByVoter = loaded.votesByVoter ?? {};
  loaded.allocationByVoter = loaded.allocationByVoter ?? {};
  loaded.goalVotesByVoter = loaded.goalVotesByVoter ?? {};
  loaded.emergentNeeds = loaded.emergentNeeds ?? [];
  loaded.lastPlan = loaded.lastPlan ?? {};
  loaded.challengerStreak = loaded.challengerStreak ?? {};

  const merged = mergeDuplicateNeeds(loaded, NEEDS);
  if (Object.keys(merged).length) {
    console.log(`[needs] merged duplicate needs: ${JSON.stringify(merged)}`);
    await Bun.write(DB_PATH, JSON.stringify(loaded, null, 2));
  }

  const schemaVersion = Number.isFinite(raw.schemaVersion as number) ? Number(raw.schemaVersion) : 0;
  if (schemaVersion < DB_SCHEMA_VERSION) {
    // Privacy migration (one-time per schema version):
    // - real entries stored at 0.01° floored cells
    // - simulated entries stored at 3-decimal floored coords
    for (const e of loaded.entries ?? []) {
      if (!e?.location) continue;
      const lat = Number(e.location.lat);
      const lng = Number(e.location.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      e.location = e.synthetic
        ? { lat: storeSimulatedCoord(lat), lng: storeSimulatedCoord(lng) }
        : { lat: storeRealCoord(lat), lng: storeRealCoord(lng) };
    }
    loaded.schemaVersion = DB_SCHEMA_VERSION;
    await Bun.write(DB_PATH, JSON.stringify(loaded, null, 2));
  } else {
    loaded.schemaVersion = schemaVersion;
  }

  return loaded;
}

function seed(): DB {
  const db = emptyDB();
  db.schemaVersion = DB_SCHEMA_VERSION;
  const t0 = Date.now() - SEED_JOURNALS.length * 3600_000;
  db.entries = SEED_JOURNALS.map((s, i) => ({
    id: crypto.randomUUID(),
    author: s.author,
    text: s.text,
    createdAt: new Date(t0 + i * 3600_000).toISOString(),
    extraction: extract(s.text),
    corrected: false,
    seeded: true,
  }));
  return db;
}

function resolveVoterId(req: Request) {
  const fromHeader = req.headers.get("x-voter-id")?.trim();
  return fromHeader || "anon";
}

function currentNeeds() {
  return [...NEEDS, ...db.emergentNeeds];
}

function toNeedId(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
}

function ensureNeedCoverage(
  text: string,
  extraction: JournalEntry["extraction"],
  proposedNeed?: { label: string; goal: string; metric: string; keywords?: string[]; value?: string; level?: string } | null,
) {
  if (extraction.needs.length > 0) return extraction;

  // The model often proposes a need that already exists ("Food access"). Reuse it rather than
  // creating a duplicate that splits journals, votes and ideas away from the real one.
  const existing = proposedNeed?.label ? findNeedByLabel(proposedNeed.label, currentNeeds()) : undefined;
  if (existing) return { ...extraction, needs: [{ id: existing.id, confidence: 1 }] };

  const tk = tokens(text).filter((t) => t.length >= 4);
  const labelCore = proposedNeed?.label?.trim() || tk.slice(0, 3).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ") || "Community need";
  const base = toNeedId(labelCore) || "community_need";
  const id = `emergent_need_${base}_${db.emergentNeeds.length + 1}`;

  const emergentNeed: NeedDef = {
    id,
    label: labelCore,
    value: proposedNeed?.value?.trim() || "Community wellbeing",
    goal: proposedNeed?.goal?.trim() || `Improve outcomes related to ${labelCore.toLowerCase()}`,
    metric: proposedNeed?.metric?.trim() || `Tracked improvement in ${labelCore.toLowerCase()} concerns`,
    level: proposedNeed?.level?.trim() || "To be determined",
    keywords: [...new Set([...(proposedNeed?.keywords ?? []), ...tk])].slice(0, 12),
    emergent: true,
    sourceText: text.slice(0, 240),
  };

  db.emergentNeeds.push(emergentNeed);
  return {
    ...extraction,
    needs: [{ id: emergentNeed.id, confidence: 1 }],
  };
}

function parseAndRoundLocation(raw: unknown, synthetic: boolean): { lat: number; lng: number } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const lat = Number((raw as { lat?: unknown }).lat);
  const lng = Number((raw as { lng?: unknown }).lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new PublishDraftInputError("location must include numeric lat/lng");
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new PublishDraftInputError("location lat/lng out of range");
  if (synthetic) return { lat: storeSimulatedCoord(lat), lng: storeSimulatedCoord(lng) };
  // Real entries are stored directly at 0.01° cell coordinates (privacy floor).
  return { lat: storeRealCoord(lat), lng: storeRealCoord(lng) };
}

function createJournalEntry(input: {
  text: string;
  author?: string;
  extraction: JournalEntry["extraction"];
  corrected: boolean;
  synthetic?: boolean;
  source?: string;
  location?: { lat: number; lng: number };
  tileId?: string;
}) {
  const roundedLoc = input.location ? parseAndRoundLocation(input.location, !!input.synthetic) : undefined;
  const tileId = input.tileId?.trim().slice(0, 120) || undefined;
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    author: input.author?.trim() || (input.synthetic ? "Simulated resident" : "Journal Client"),
    text: input.text.trim(),
    createdAt: new Date().toISOString(),
    extraction: input.extraction,
    corrected: input.corrected,
    ...(input.synthetic ? { synthetic: true } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(roundedLoc ? { location: roundedLoc } : {}),
    ...(tileId ? { tileId } : {}),
  };
  db.entries.push(entry);
  return entry;
}

function recordAnswer(needId: string, text: string, voterId?: string) {
  const ctx = buildContext(db);
  let proposalId = clusterAnswer(text, needId, ctx.proposals);
  let isNew = false;
  if (!proposalId) {
    isNew = true;
    const emergent: Proposal = {
      id: `emergent_${db.emergent.length + 1}`,
      needId,
      title: text.trim().length > 90 ? text.trim().slice(0, 87) + "…" : text.trim(),
      mechanism: "To be determined",
      authority: "Unassigned",
      jurisdiction: "Unassigned",
      costB: null,
      changeLevel: 3,
      reversibility: 0.5,
      evidence: 0.3,
      effectiveness: 0.5,
      keywords: tokens(text).slice(0, 12),
      metrics: [],
      legalChange: "Needs legal analysis",
      emergent: true,
      sourceText: text.trim(),
    };
    db.emergent.push(emergent);
    proposalId = emergent.id;
  }

  db.answers.push({
    id: crypto.randomUUID(),
    needId,
    text: text.trim(),
    proposalId,
    createdAt: new Date().toISOString(),
    voterId,
  });

  return { proposalId, isNew };
}

let db = await load();
let outcomesFile = await loadOutcomesFile(OUTCOMES_PATH);
const save = () => Bun.write(DB_PATH, JSON.stringify(db, null, 2));
await save();

function state(voterId = "anon") {
  const measuredOutcomes = OUTCOMES_MODE === "on" ? measuredNeedsOutcomes(outcomesFile) : undefined;
  const ctxReal = buildContext(db, undefined, { outcomes: measuredOutcomes });
  const ctxBlended = buildContext(db, undefined, { includeSynthetic: true, outcomes: measuredOutcomes });
  const userVotes = db.votesByVoter[voterId] ?? {};
  const userAllocation = db.allocationByVoter[voterId] ?? {};
  const userGoalVotes = db.goalVotesByVoter[voterId] ?? {};
  const realVoters = new Set([
    ...Object.keys(db.votesByVoter),
    ...Object.keys(db.allocationByVoter),
    ...Object.keys(db.goalVotesByVoter),
  ].filter((id) => id !== "anon" && id !== "legacy")).size;

  const userAnswers = db.answers.filter((a) => a.voterId === voterId || (voterId === "anon" && !a.voterId));

  return {
    needs: ctxReal.needs,
    changeLevels: CHANGE_LEVELS,
    // Send the estimate count and this voter's own estimate, not everyone's list.
    proposals: ctxReal.proposals.map(({ estimates, ...p }) => (estimates?.length
      ? { ...p, estimateCount: estimates.length, myEstimate: estimates.find((e) => e.voterKey === voterKey(voterId)) ?? null }
      : p)),
    stats: ctxReal.stats,
    demand: ctxReal.demand,
    demandReal: ctxReal.demand,
    demandBlended: ctxBlended.demand,
    mechanismShare: ctxReal.mechanismShare,
    goalSupport: ctxReal.goalSupport,
    entries: [...db.entries].reverse(),
    population: {
      n: POPULATION.length,
      archetypes: ARCHETYPES.map((a) => ({ name: a.name, share: a.share })),
      realVoices: realVoters,
    },
    user: { votes: userVotes, allocation: userAllocation, goalVotes: userGoalVotes, answers: userAnswers },
    defaultWeights: DEFAULT_WEIGHTS,
    mapStyleUrl: MAP_STYLE_URL,
    outcomesMode: OUTCOMES_MODE,
  };
}

const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

// Admin routes are off unless ADMIN_TOKEN is set (fly secrets set ADMIN_TOKEN=...).
const ADMIN_TOKEN = process.env.ADMIN_TOKEN?.trim() || "";
function isAdmin(req: Request) {
  if (!ADMIN_TOKEN) return false;
  const got = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(ADMIN_TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

type StageEvent =
  | { stage: "journal"; status: "done"; entry_id: string; labels: string[] }
  | { stage: "needs"; status: "done"; matched: { need_id: string; name: string; voices: number; isNew: boolean }[] }
  | { stage: "vote"; status: "done"; deltas: { item_id: string; name: string; rankBefore: number; rankAfter: number }[] }
  | { stage: "synthesize"; status: "running" | "done"; diff?: { added: string[]; removed: string[]; reinforced: string[]; nearMiss?: { item: string; entriesNeeded: number } } }
  | { stage: string; status: "error"; message: string };

interface ForkState {
  id: string;
  entryId: string;
  baseCtx: Context;
  labels: string[];
  events: StageEvent[];
  listeners: Set<(ev: StageEvent) => void>;
  done: boolean;
  undone: boolean;
  undoUntil: number | null;
  matchedNeedIds: string[];
}

const forks = new Map<string, ForkState>();
const entryListeners = new Set<(payload: string) => void>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function entriesPayload() {
  return JSON.stringify({ entries: [...db.entries].reverse() });
}

function emitEntriesUpdate() {
  const payload = entriesPayload();
  for (const send of entryListeners) send(payload);
}

function emitForkEvent(fork: ForkState, ev: StageEvent) {
  fork.events.push(ev);
  for (const send of fork.listeners) send(ev);
}

function rankByNeedDemand(ctx: Context) {
  const sorted = [...ctx.needs].sort((a, b) => ctx.demand[b.id]!.demand - ctx.demand[a.id]!.demand);
  return new Map(sorted.map((n, i) => [n.id, i + 1]));
}

function synthDiff(baseCtx: Context, nextCtx: Context, matchedNeedIds: string[]) {
  const basePkg = synthesize(baseCtx, DEFAULT_WEIGHTS, 0.25, 40)[0];
  const nextPkg = synthesize(nextCtx, DEFAULT_WEIGHTS, 0.25, 40)[0];
  if (!basePkg || !nextPkg) {
    return { added: [], removed: [], reinforced: [] };
  }
  const baseTitles = new Set(basePkg.items.map((i) => i.proposal.title));
  const nextTitles = new Set(nextPkg.items.map((i) => i.proposal.title));
  const added = [...nextTitles].filter((t) => !baseTitles.has(t));
  const removed = [...baseTitles].filter((t) => !nextTitles.has(t));
  const reinforced = [...nextTitles].filter((t) => baseTitles.has(t));

  const nearMiss = added.length === 0 && removed.length === 0
    ? (() => {
      const candidate = nextCtx.proposals
        .filter((p) => matchedNeedIds.includes(p.needId))
        .find((p) => !nextTitles.has(p.title));
      return candidate ? { item: candidate.title, entriesNeeded: 3 } : undefined;
    })()
    : undefined;

  return { added, removed, reinforced, nearMiss };
}

async function runPipeline(forkId: string) {
  const fork = forks.get(forkId);
  if (!fork || fork.undone) return;

  try {
    await sleep(140);
    const ctxAfterEntry = buildContext(db);
    const matched = fork.labels.map((needId) => {
      const def = ctxAfterEntry.needs.find((n) => n.id === needId);
      return {
        need_id: needId,
        name: def?.label ?? needId,
        voices: ctxAfterEntry.demand[needId]?.journalCount ?? 0,
        isNew: Boolean(def?.emergent),
      };
    });
    fork.matchedNeedIds = matched.map((m) => m.need_id);
    emitForkEvent(fork, { stage: "needs", status: "done", matched });

    await sleep(220);
    const beforeRanks = rankByNeedDemand(fork.baseCtx);
    const afterRanks = rankByNeedDemand(ctxAfterEntry);
    const deltas = fork.matchedNeedIds.map((needId) => ({
      item_id: needId,
      name: ctxAfterEntry.needs.find((n) => n.id === needId)?.label ?? needId,
      rankBefore: beforeRanks.get(needId) ?? ctxAfterEntry.needs.length,
      rankAfter: afterRanks.get(needId) ?? ctxAfterEntry.needs.length,
    }));
    emitForkEvent(fork, { stage: "vote", status: "done", deltas });

    await sleep(200);
    emitForkEvent(fork, { stage: "synthesize", status: "running" });

    await sleep(950);
    const diff = synthDiff(fork.baseCtx, ctxAfterEntry, fork.matchedNeedIds);
    emitForkEvent(fork, { stage: "synthesize", status: "done", diff });
    fork.done = true;
    fork.undoUntil = Date.now() + 10_000;
  } catch (err) {
    emitForkEvent(fork, {
      stage: "synthesize",
      status: "error",
      message: err instanceof Error ? err.message : "Plan update queued",
    });
    fork.done = true;
    fork.undoUntil = Date.now() + 10_000;
  }
}

const toStringList = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean) : [];
const normalizeNeedIds = (v: unknown) => {
  const needIds = new Set(currentNeeds().map((n) => n.id));
  const submitted = toStringList(v);
  const valid = submitted.filter((id) => needIds.has(id));
  const ignored = submitted.filter((id) => !needIds.has(id));
  return { submitted, valid, ignored };
};

function parseBBox(raw: string | null) {
  if (!raw) return { ok: false as const, error: "bbox is required as s,w,n,e" };
  const parts = raw.split(",").map((x) => Number(x.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return { ok: false as const, error: "bbox must be s,w,n,e" };
  const s = parts[0]!;
  const w = parts[1]!;
  const n = parts[2]!;
  const e = parts[3]!;
  if (s < -90 || n > 90 || w < -180 || e > 180 || s >= n || w >= e) return { ok: false as const, error: "bbox out of range" };
  return { ok: true as const, bbox: { s, w, n, e } };
}

function recencyWeight(createdAt: string, newestMs: number) {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 1;
  const ageDays = Math.max(0, (newestMs - t) / 86_400_000);
  return 0.5 ** (ageDays / JOURNAL_HALF_LIFE_DAYS);
}

function needsGeo(bbox: { s: number; w: number; n: number; e: number }, mode: "real" | "simulated" | "both") {
  const includeReal = mode === "real" || mode === "both";
  const includeSim = mode === "simulated" || mode === "both";
  const entries = db.entries.filter((e) => e.location
    && e.location.lat >= bbox.s && e.location.lat <= bbox.n
    && e.location.lng >= bbox.w && e.location.lng <= bbox.e
    && ((includeReal && !e.synthetic) || (includeSim && !!e.synthetic)));

  const newestMs = entries.length
    ? Math.max(...entries.map((e) => Date.parse(e.createdAt)).filter(Number.isFinite))
    : Date.now();

  type Bucket = {
    lat: number;
    lng: number;
    realCount: number;
    simCount: number;
    realNeedCount: Record<string, number>;
    simNeedCount: Record<string, number>;
    realNeedScore: Record<string, number>;
    simNeedScore: Record<string, number>;
  };

  const byCell = new Map<string, Bucket>();

  for (const e of entries) {
    const lat = cellCoord(e.location!.lat);
    const lng = cellCoord(e.location!.lng);
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const b = byCell.get(key) ?? {
      lat,
      lng,
      realCount: 0,
      simCount: 0,
      realNeedCount: {},
      simNeedCount: {},
      realNeedScore: {},
      simNeedScore: {},
    };
    const isSim = !!e.synthetic;
    if (isSim) b.simCount += 1;
    else b.realCount += 1;

    const w = recencyWeight(e.createdAt, newestMs);
    for (const hit of e.extraction.needs) {
      const c = e.extraction.importance * hit.confidence * w;
      if (isSim) {
        b.simNeedCount[hit.id] = (b.simNeedCount[hit.id] ?? 0) + 1;
        b.simNeedScore[hit.id] = (b.simNeedScore[hit.id] ?? 0) + c;
      } else {
        b.realNeedCount[hit.id] = (b.realNeedCount[hit.id] ?? 0) + 1;
        b.realNeedScore[hit.id] = (b.realNeedScore[hit.id] ?? 0) + c;
      }
    }

    byCell.set(key, b);
  }

  const cells = [...byCell.values()]
    .map((b) => {
      const suppressReal = b.realCount > 0 && b.realCount < 3;
      const real = {
        count: suppressReal ? 0 : b.realCount,
        perNeed: Object.entries(suppressReal ? {} : b.realNeedCount).map(([needId, count]) => ({
          needId,
          count,
          demand: Math.min(1, (b.realNeedScore[needId] ?? 0) / JOURNAL_REFERENCE),
        })),
      };
      const simulated = {
        count: b.simCount,
        perNeed: Object.entries(b.simNeedCount).map(([needId, count]) => ({
          needId,
          count,
          demand: Math.min(1, (b.simNeedScore[needId] ?? 0) / JOURNAL_REFERENCE),
        })),
      };

      const keep = (includeReal && real.count >= 3) || (includeSim && simulated.count > 0);
      return keep ? { lat: Number(b.lat.toFixed(2)), lng: Number(b.lng.toFixed(2)), real, simulated } : null;
    })
    .filter((x): x is { lat: number; lng: number; real: { count: number; perNeed: { needId: string; count: number; demand: number }[] }; simulated: { count: number; perNeed: { needId: string; count: number; demand: number }[] } } => Boolean(x));

  return { bbox, mode, cellSizeDeg: CELL_SIZE_DEG, cells };
}

function parsePreviousPlans(input: unknown) {
  if (input === undefined) return { ok: true as const, previous: undefined as Record<string, string[]> | undefined };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false as const, error: "previous must be an object keyed by package id" };

  const out: Record<string, string[]> = {};
  for (const [pkg, ids] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(ids)) return { ok: false as const, error: `previous.${pkg} must be an array of proposal ids` };
    out[pkg] = ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean);
  }
  return { ok: true as const, previous: out };
}

function parseChallengerStreak(input: unknown) {
  if (input === undefined) return { ok: true as const, challengerStreak: undefined as Record<string, Record<string, number>> | undefined };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false as const, error: "challengerStreak must be an object keyed by package id" };

  const out: Record<string, Record<string, number>> = {};
  for (const [pkg, streakByProposal] of Object.entries(input as Record<string, unknown>)) {
    if (!streakByProposal || typeof streakByProposal !== "object" || Array.isArray(streakByProposal)) {
      return { ok: false as const, error: `challengerStreak.${pkg} must be an object keyed by proposal id` };
    }

    const rows: Record<string, number> = {};
    for (const [proposalId, streak] of Object.entries(streakByProposal as Record<string, unknown>)) {
      if (typeof proposalId !== "string" || !proposalId.trim()) continue;
      const n = typeof streak === "number" && Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
      rows[proposalId.trim()] = n;
    }
    out[pkg] = rows;
  }

  return { ok: true as const, challengerStreak: out };
}

function parseOutcomes(input: unknown) {
  if (input === undefined) return { ok: true as const, outcomes: undefined as SynthesisOutcomes | undefined };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false as const, error: "outcomes must be an object" };
  }

  const out: SynthesisOutcomes = { needs: {}, items: {} };
  const root = input as Record<string, unknown>;

  if (root.needs !== undefined) {
    if (!root.needs || typeof root.needs !== "object" || Array.isArray(root.needs)) {
      return { ok: false as const, error: "outcomes.needs must be an object keyed by need id" };
    }
    for (const [needId, row] of Object.entries(root.needs as Record<string, unknown>)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const severityRaw = (row as { severity?: unknown }).severity;
      const severityNum = Number(severityRaw);
      if (!Number.isFinite(severityNum)) continue;
      out.needs![needId] = { severity: Math.max(0, Math.min(1, severityNum)) };
    }
  }

  if (root.items !== undefined) {
    if (!root.items || typeof root.items !== "object" || Array.isArray(root.items)) {
      return { ok: false as const, error: "outcomes.items must be an object keyed by proposal id" };
    }
    for (const [proposalId, row] of Object.entries(root.items as Record<string, unknown>)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const impactRaw = (row as { impact?: unknown }).impact;
      const impactNum = Number(impactRaw);
      if (!Number.isFinite(impactNum)) continue;
      out.items![proposalId] = {
        impact: Math.max(0, Math.min(1, impactNum)),
        maturing: Boolean((row as { maturing?: unknown }).maturing),
      };
    }
  }

  return { ok: true as const, outcomes: out };
}

function parseWhatIfExtraEntries(input: unknown) {
  if (input === undefined) return { ok: true as const, entries: [] as JournalEntry[] };
  if (!Array.isArray(input)) return { ok: false as const, error: "extraEntries must be an array" };
  if (input.length > 200) return { ok: false as const, error: "extraEntries exceeds maximum of 200" };

  const ctx = buildContext(db);
  const entries: JournalEntry[] = [];

  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    if (!item || typeof item !== "object") return { ok: false as const, error: `extraEntries[${i}] must be an object` };

    const text = typeof (item as { text?: unknown }).text === "string" ? (item as { text?: string }).text!.trim() : "";
    if (!text) return { ok: false as const, error: `extraEntries[${i}].text is required` };
    if (text.length > 2000) return { ok: false as const, error: `extraEntries[${i}].text exceeds 2000 characters` };

    const authorRaw = (item as { author?: unknown }).author;
    const author = typeof authorRaw === "string" && authorRaw.trim() ? authorRaw.trim().slice(0, 120) : "What-if resident";
    const createdAtRaw = (item as { createdAt?: unknown }).createdAt;
    const createdAt = typeof createdAtRaw === "string" && Number.isFinite(Date.parse(createdAtRaw))
      ? new Date(createdAtRaw).toISOString()
      : new Date().toISOString();

    entries.push({
      id: `extra_${i}`,
      author,
      text,
      createdAt,
      extraction: extract(text, ctx.proposals, ctx.needs),
      corrected: false,
      synthetic: true,
      source: "what-if",
    });
  }

  return { ok: true as const, entries };
}

export const server = Bun.serve({
  port: Number(process.env.PORT ?? 8000),
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,

    // Explicit embed route.
    "/embed": index,

    "/api/debug/request": {
      GET: (req) => {
        logRequest(req, "/api/debug/request");
        const headers = Object.fromEntries(req.headers.entries());
        const payload = { ok: true, url: req.url, method: req.method, headers, frameAncestors: FRAME_ANCESTORS, embedCsp: EMBED_CSP };
        const res = Response.json(payload);
        logResponse("/api/debug/request", res);
        return res;
      },
    },

    "/api/state": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => withReadCors(req, Response.json(state(resolveVoterId(req)))),
    },

    "/api/outcomes": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => withReadCors(req, Response.json({
        mode: OUTCOMES_MODE,
        path: OUTCOMES_PATH,
        outcomes: outcomesFile,
      })),
    },

    "/api/needs/geo": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => {
        const url = new URL(req.url);
        const parsed = parseBBox(url.searchParams.get("bbox"));
        if (!parsed.ok) return bad(parsed.error);
        const m = (url.searchParams.get("mode") || "both").toLowerCase();
        const mode = m === "real" || m === "simulated" || m === "both" ? m : null;
        if (!mode) return bad("mode must be real, simulated, or both");
        return withReadCors(req, Response.json(needsGeo(parsed.bbox, mode)));
      },
    },

    "/api/geo/:id": {
      GET: async (req) => {
        const id = req.params.id;
        const map: Record<string, string> = {
          houston: "data/geo/houston-city-limits.geojson",
          "harris-county": "data/geo/harris-county.geojson",
          texas: "data/geo/texas.geojson",
        };
        const path = map[id];
        if (!path) return bad("unknown geography");
        const f = Bun.file(path);
        if (!(await f.exists())) return bad("missing geography file");
        return withReadCors(req, new Response(await f.text(), { headers: { "content-type": "application/geo+json" } }));
      },
    },

    "/api/journal": {
      POST: async (req) => {
        const { text, author, location } = (await req.json()) as { text?: string; author?: string; location?: { lat?: number; lng?: number } };
        if (!text?.trim()) return bad("text is required");
        const ctx = buildContext(db);
        const llm = await extractWithLLM(text.trim(), ctx.proposals, ctx.needs);
        const extraction = ensureNeedCoverage(text.trim(), llm.extraction, llm.proposedNeed);

        logPublishEvent("EXTRACT_PROVIDER", {
          route: "/api/journal",
          provider: llm.provider,
          matchedNeedIds: extraction.needs.map((n) => n.id),
        });

        let roundedLoc: { lat: number; lng: number } | undefined;
        try {
          roundedLoc = location ? parseAndRoundLocation(location, false) : undefined;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "invalid location";
          return bad(msg);
        }
        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          author: author?.trim() || "You",
          text: text.trim(),
          createdAt: new Date().toISOString(),
          extraction,
          corrected: false,
          ...(roundedLoc ? { location: roundedLoc } : {}),
        };
        db.entries.push(entry);
        await save();
        emitEntriesUpdate();
        return Response.json(entry);
      },
    },

    // "No, that's not what I meant" — the person corrects the interpretation
    "/api/journal/:id": {
      PATCH: async (req) => {
        const entry = db.entries.find((e) => e.id === req.params.id);
        if (!entry) return bad("entry not found");
        const { needs } = (await req.json()) as { needs: string[] };
        const valid = needs.filter((id) => currentNeeds().some((n) => n.id === id));
        entry.extraction.needs = valid.map((id) => entry.extraction.needs.find((n) => n.id === id) ?? { id, confidence: 1 });
        entry.corrected = true;
        await save();
        return Response.json(entry);
      },
    },

    "/api/votes": {
      POST: async (req) => {
        const voterId = resolveVoterId(req);
        const body = (await req.json()) as { votes?: UserVote[]; allocation?: Record<string, number>; goalVotes?: Record<string, boolean> };

        const existingVotes = db.votesByVoter[voterId] ?? {};
        for (const v of body.votes ?? []) existingVotes[v.proposalId] = v;
        db.votesByVoter[voterId] = existingVotes;

        if (body.allocation) {
          const total = Object.values(body.allocation).reduce((s, v) => s + v, 0);
          if (total > 100) return bad("allocation exceeds 100 points");
          db.allocationByVoter[voterId] = body.allocation;
        }

        if (body.goalVotes) {
          db.goalVotesByVoter[voterId] = { ...(db.goalVotesByVoter[voterId] ?? {}), ...body.goalVotes };
        }

        await save();
        return Response.json({ ok: true, voterId });
      },
    },

    // Open-ended "how should we accomplish that?" answers
    "/api/answers": {
      POST: async (req) => {
        const voterId = resolveVoterId(req);
        const { needId, text } = (await req.json()) as { needId: string; text: string };
        if (!text?.trim() || !currentNeeds().some((n) => n.id === needId)) return bad("needId and text are required");
        const result = recordAnswer(needId, text, voterId);
        await save();
        return Response.json(result);
      },
    },

    "/api/entries/events": {
      GET: (req) => {
        let listener: ((payload: string) => void) | null = null;

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const write = (payload: string) => controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

            // initial snapshot
            write(entriesPayload());

            listener = (payload: string) => write(payload);
            entryListeners.add(listener);

            const cleanup = () => {
              if (listener) entryListeners.delete(listener);
              try { controller.close(); } catch {
                // already closed
              }
            };

            const abort = req.signal;
            if (abort.aborted) {
              cleanup();
              return;
            }
            abort.addEventListener("abort", cleanup, { once: true });
          },
          cancel() {
            if (listener) entryListeners.delete(listener);
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
          },
        });
      },

      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
    },

    "/api/entries": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => {
        const entries = entriesNewestFirst();
        return withReadCors(req, Response.json({ entries }));
      },
      POST: async (req) => {
        const body = (await req.json()) as { text?: string; author?: string; labels?: string[]; needs?: string[]; location?: { lat?: number; lng?: number } };
        if (!body.text?.trim()) return bad("text is required");

        const baseCtx = buildContext(db);
        const llm = await extractWithLLM(body.text.trim(), baseCtx.proposals, baseCtx.needs);
        let extraction = llm.extraction;
        const labels = normalizeNeedIds(body.labels ?? body.needs);
        if (labels.valid.length > 0) {
          extraction = { ...extraction, needs: labels.valid.map((id) => extraction.needs.find((n) => n.id === id) ?? { id, confidence: 1 }) };
        } else {
          extraction = ensureNeedCoverage(body.text.trim(), extraction, llm.proposedNeed);
        }

        logPublishEvent("EXTRACT_PROVIDER", {
          route: "/api/entries",
          provider: llm.provider,
          matchedNeedIds: extraction.needs.map((n) => n.id),
        });

        let roundedLoc: { lat: number; lng: number } | undefined;
        try {
          roundedLoc = body.location ? parseAndRoundLocation(body.location, false) : undefined;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "invalid location";
          return bad(msg);
        }
        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          author: body.author?.trim() || "You",
          text: body.text.trim(),
          createdAt: new Date().toISOString(),
          extraction,
          corrected: labels.valid.length > 0,
          ...(roundedLoc ? { location: roundedLoc } : {}),
        };

        db.entries.push(entry);
        await save();
        emitEntriesUpdate();

        const forkId = crypto.randomUUID();
        const fork: ForkState = {
          id: forkId,
          entryId: entry.id,
          baseCtx,
          labels: extraction.needs.map((n) => n.id),
          events: [],
          listeners: new Set(),
          done: false,
          undone: false,
          undoUntil: null,
          matchedNeedIds: [],
        };
        forks.set(forkId, fork);

        emitForkEvent(fork, { stage: "journal", status: "done", entry_id: entry.id, labels: fork.labels });
        void runPipeline(forkId);

        return Response.json({ entry_id: entry.id, fork_id: forkId, entry });
      },
    },

    "/api/forks/:id/events": {
      GET: async (req) => {
        const fork = forks.get(req.params.id);
        if (!fork) return new Response("fork not found", { status: 404 });

        let listener: ((ev: StageEvent) => void) | null = null;
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const write = (ev: StageEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));

            for (const ev of fork.events) write(ev);
            if (fork.done) {
              controller.close();
              return;
            }

            listener = (ev: StageEvent) => {
              write(ev);
              if (fork.done || (ev.status === "error" && ev.stage === "synthesize")) {
                if (listener) fork.listeners.delete(listener);
                controller.close();
              }
            };
            fork.listeners.add(listener);
          },
          cancel() {
            if (listener) fork.listeners.delete(listener);
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
          },
        });
      },
    },

    "/api/forks/:id/undo": {
      POST: async (req) => {
        const fork = forks.get(req.params.id);
        if (!fork) return bad("fork not found");
        if (fork.undone) return bad("fork already undone");
        if (!fork.undoUntil || Date.now() > fork.undoUntil) return bad("undo window expired");

        const idx = db.entries.findIndex((e) => e.id === fork.entryId);
        if (idx >= 0) {
          db.entries.splice(idx, 1);
          await save();
          emitEntriesUpdate();
        }
        fork.undone = true;
        fork.done = true;
        emitForkEvent(fork, { stage: "journal", status: "error", message: "Publish undone" });
        return Response.json({ ok: true });
      },
    },

    "/api/journals": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => {
        const journals = entriesNewestFirst();
        return withReadCors(req, Response.json({ journals }));
      },
    },

    "/api/ballot_entries": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => {
        const data = entriesNewestFirst();
        return withReadCors(req, Response.json({ data }));
      },
    },

    "/api/entries/preview": {
      POST: async (req) => {
        const body = (await req.json()) as { text?: string; labels?: string[]; needs?: string[] };
        if (!body.text?.trim()) return Response.json({ labels: [], matched: [], deltas: [] });

        const baseCtx = buildContext(db);
        let extraction = extract(body.text.trim(), baseCtx.proposals, baseCtx.needs);
        const labels = normalizeNeedIds(body.labels ?? body.needs);
        if (labels.valid.length > 0) {
          extraction = { ...extraction, needs: labels.valid.map((id) => extraction.needs.find((n) => n.id === id) ?? { id, confidence: 1 }) };
        } else {
          // Preview synthetic fallback without mutating DB.
          if (extraction.needs.length === 0) extraction = { ...extraction, needs: [{ id: "emergent_preview", confidence: 1 }] };
        }

        const matched = extraction.needs.map((n) => ({
          need_id: n.id,
          name: baseCtx.needs.find((d) => d.id === n.id)?.label ?? "Emerging need",
          voices: (baseCtx.demand[n.id]?.journalCount ?? 0) + 1,
          isNew: n.id === "emergent_preview",
        }));

        const beforeRanks = rankByNeedDemand(baseCtx);

        const shadow: DB = {
          ...db,
          entries: [...db.entries, {
            id: "preview",
            author: "preview",
            text: body.text.trim(),
            createdAt: new Date().toISOString(),
            extraction,
            corrected: labels.valid.length > 0,
          }],
        };
        const afterCtx = buildContext(shadow);
        const afterRanks = rankByNeedDemand(afterCtx);
        const deltas = extraction.needs.map((n) => ({
          item_id: n.id,
          name: baseCtx.needs.find((d) => d.id === n.id)?.label ?? "Emerging need",
          rankBefore: beforeRanks.get(n.id) ?? baseCtx.needs.length,
          rankAfter: afterRanks.get(n.id) ?? afterCtx.needs.length,
        }));

        return Response.json({ labels: extraction.needs.filter((n) => n.id !== "emergent_preview").map((n) => n.id), matched, deltas });
      },
    },

    "/api/journal-client/schema": {
      GET: () => Response.json(journalClientSchema({
        defaultKind: PUBLISH_DRAFT_DEFAULT_KIND,
        needs: currentNeeds().map((n) => ({ id: n.id, label: n.label })),
      })),
    },

    // For external journal UIs: publish a draft entry into Civic Synthesis.
    "/api/publish_draft": {
      OPTIONS: (req) => {
        logPublishEvent("PUBLISH_DRAFT_PREFLIGHT", {
          method: req.method,
          origin: req.headers.get("origin"),
          referer: req.headers.get("referer"),
          requestMethod: req.headers.get("access-control-request-method"),
          requestHeaders: req.headers.get("access-control-request-headers"),
        });
        return new Response(null, { status: 204, headers: publishCorsHeaders(req) });
      },
      POST: async (req) => {
        const voterId = resolveVoterId(req);
        const origin = req.headers.get("origin");
        const referer = req.headers.get("referer");
        const remote = req.headers.get("fly-client-ip") ?? req.headers.get("x-forwarded-for") ?? null;
        const contentType = req.headers.get("content-type");
        const secFetchMode = req.headers.get("sec-fetch-mode");

        logPublishEvent("PUBLISH_DRAFT_HIT", {
          method: req.method,
          origin,
          referer,
          remote,
          contentType,
          secFetchMode,
        });

        let body: PublishDraftBody;
        try {
          body = (await req.json()) as PublishDraftBody;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logPublishEvent("PUBLISH_DRAFT_REJECTED", {
            reason: "invalid json body",
            message,
            origin,
            referer,
            remote,
            contentType,
          });
          return publishBad(req, "invalid json body");
        }

        try {
          const result = await handlePublishDraftPost(body, {
            defaultKind: PUBLISH_DRAFT_DEFAULT_KIND,
            voterId,
            currentNeeds,
            normalizeNeedIds,
            buildContext: () => buildContext(db),
            extractWithLLM,
            ensureNeedCoverage,
            recordAnswer,
            createJournalEntry,
            save: async () => { await save(); },
            onExtract: (meta) => {
              logPublishEvent("EXTRACT_PROVIDER", {
                route: "/api/publish_draft",
                provider: meta.provider,
                matchedNeedIds: meta.matchedNeedIds,
                mode: meta.mode,
              });
            },
          });

          if (result.mode === "journal") emitEntriesUpdate();

          logPublishEvent("PUBLISH_DRAFT_OK", {
            ...result,
            textLength: body.text?.trim().length ?? 0,
            textPreview: body.text?.trim().slice(0, 120) ?? "",
            origin,
            referer,
            remote,
          });

          return withPublishCors(req, Response.json(result));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const reason = error instanceof PublishDraftInputError ? message : "publish draft failed";
          logPublishEvent("PUBLISH_DRAFT_REJECTED", {
            reason,
            message,
            origin,
            referer,
            remote,
            contentType,
          });
          return publishBad(req, reason);
        }
      },
    },

    // For external journal UIs: publish final labels onto an existing entry.
    "/api/publish_labels": {
      OPTIONS: (req) => publishLabelsOptions(req, {
        logPublishEvent,
        publishCorsHeaders,
      }),
      POST: (req) => publishLabelsPost(req, {
        db,
        save,
        normalizeNeedIds,
        logPublishEvent,
        publishCorsHeaders,
      }),
    },

    // Freeze the current plan (optionally tied to one journal entry) for HappyBearLandia to
    // simulate in many paired futures. Returns the snapshot and a shareable HBL URL.
    "/api/simulation-snapshots": {
      POST: async (req) => {
        let body: { entryId?: string; package?: string; runs?: number; years?: number } = {};
        try {
          body = (await req.json()) ?? {};
        } catch {
          return bad("body must be JSON");
        }
        try {
          const outcomes = OUTCOMES_MODE === "on" ? measuredNeedsOutcomes(outcomesFile) : undefined;
          const snapshot = createSimulationSnapshot(db, { entryId: body.entryId, packageName: body.package, needs: currentNeeds(), outcomes });
          storeSnapshot(db, snapshot);
          await save();
          const runs = Math.min(1000, Math.max(1, Math.floor(Number(body.runs) || DEFAULT_RUNS)));
          const years = Math.min(10, Math.max(1, Math.floor(Number(body.years) || DEFAULT_YEARS)));
          return Response.json({ snapshot, simulationUrl: simulationUrl(HBL_URL, snapshot, { runs, years }) }, { status: 201 });
        } catch (err) {
          if (err instanceof SnapshotError) return Response.json({ error: err.message }, { status: err.status });
          throw err;
        }
      },
    },

    "/api/simulation-snapshots/:id": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => {
        const snapshot = (db.simulationSnapshots ?? []).find((s) => s.id === req.params.id);
        if (!snapshot) return withReadCors(req, Response.json({ error: "simulation snapshot not found" }, { status: 404 }));
        return withReadCors(req, Response.json({ snapshot }));
      },
    },

    "/api/synthesize": {
      POST: async (req) => {
        const { weights, lambda, budget, includeSynthetic, extraEntries, previous, challengerStreak, now, outcomes, compare } = (await req.json()) as {
          weights?: Weights;
          lambda?: number;
          budget?: number;
          includeSynthetic?: boolean;
          extraEntries?: { text: string; author?: string; createdAt?: string }[];
          previous?: Record<string, string[]>;
          challengerStreak?: Record<string, Record<string, number>>;
          now?: string | number;
          outcomes?: SynthesisOutcomes;
          compare?: boolean;
        };

        const parsed = parseWhatIfExtraEntries(extraEntries);
        if (!parsed.ok) return bad(parsed.error);
        const parsedPrev = parsePreviousPlans(previous);
        if (!parsedPrev.ok) return bad(parsedPrev.error);
        const parsedChallengerStreak = parseChallengerStreak(challengerStreak);
        if (!parsedChallengerStreak.ok) return bad(parsedChallengerStreak.error);
        const parsedOutcomes = parseOutcomes(outcomes);
        if (!parsedOutcomes.ok) return bad(parsedOutcomes.error);

        const hasWhatIfEntries = parsed.entries.length > 0;
        const previousUsed = parsedPrev.previous ?? db.lastPlan;
        const challengerStreakUsed = parsedChallengerStreak.challengerStreak ?? db.challengerStreak;

        const measuredOutcomes = measuredNeedsOutcomes(outcomesFile);
        const baseOutcomes = OUTCOMES_MODE === "on"
          ? mergeOutcomes(measuredOutcomes, parsedOutcomes.outcomes)
          : parsedOutcomes.outcomes;

        if (compare === true) {
          const ctxReal = buildContext(db, undefined, {
            includeSynthetic: false,
            extraEntries: parsed.entries,
            now,
            outcomes: baseOutcomes,
          });
          const ctxBlended = buildContext(db, undefined, {
            includeSynthetic: true,
            extraEntries: parsed.entries,
            now,
            outcomes: baseOutcomes,
          });
          const real = synthesize(ctxReal, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
          const blended = synthesize(ctxBlended, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);

          let measuredPreview: Record<string, { items: string[]; diff: { added: string[]; removed: string[]; moneyMovedB: number } }> = {};
          if (OUTCOMES_MODE === "shadow") {
            const measuredCtxReal = buildContext(db, undefined, {
              includeSynthetic: false,
              extraEntries: parsed.entries,
              now,
              outcomes: mergeOutcomes(measuredOutcomes, parsedOutcomes.outcomes),
            });
            const measuredReal = synthesize(measuredCtxReal, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
            measuredPreview = measuredPreviewByPackage(real, measuredReal);
          }

          // In compare mode, persist only the REAL side exactly like a normal real-only run.
          // what-if requests (extraEntries) remain read-only.
          if (!hasWhatIfEntries) {
            db.lastPlan = Object.fromEntries(real.map((pkg) => [pkg.id, pkg.items.map((i) => i.proposal.id)]));
            db.challengerStreak = Object.fromEntries(real.map((pkg) => [pkg.id, pkg.challengerStreak]));
            await save();
          }

          return Response.json({ real, blended, diff: diffPackages(real, blended), measuredPreview, outcomesMode: OUTCOMES_MODE });
        }

        const ctx = buildContext(db, undefined, {
          includeSynthetic: includeSynthetic === true,
          extraEntries: parsed.entries,
          now,
          outcomes: baseOutcomes,
        });
        const results = synthesize(ctx, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);

        if (OUTCOMES_MODE === "shadow") {
          const measuredCtx = buildContext(db, undefined, {
            includeSynthetic: includeSynthetic === true,
            extraEntries: parsed.entries,
            now,
            outcomes: mergeOutcomes(measuredOutcomes, parsedOutcomes.outcomes),
          });
          const measured = synthesize(measuredCtx, weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40, previousUsed, challengerStreakUsed);
          const preview = measuredPreviewByPackage(results, measured);
          for (const pkg of results) pkg.measuredPreview = preview[pkg.id];
        }

        // What-if requests must be read-only: include request-scoped extra entries
        // in synthesis without mutating or persisting server state.
        const isRealOnly = includeSynthetic !== true;
        if (!hasWhatIfEntries && isRealOnly) {
          db.lastPlan = Object.fromEntries(results.map((pkg) => [pkg.id, pkg.items.map((i) => i.proposal.id)]));
          db.challengerStreak = Object.fromEntries(results.map((pkg) => [pkg.id, pkg.challengerStreak]));
          await save();
        }

        return Response.json(results);
      },
    },

    "/api/admin/purge-world-journals": {
      POST: async (req) => {
        if (!isAdmin(req)) return new Response("Not found", { status: 404 });
        const body = (await req.json().catch(() => ({}))) as { apply?: boolean; mode?: PurgeMode };
        const mode: PurgeMode = body.mode === "flag" ? "flag" : "delete";
        const plan = planPurge(db);
        if (body.apply !== true) return Response.json({ dryRun: true, mode, plan });

        const backupPath = `${DB_PATH}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        await Bun.write(backupPath, JSON.stringify(db, null, 2));
        const applied = applyPurge(db, plan, mode);
        await save();
        emitEntriesUpdate();
        console.log("[ADMIN_PURGE]", JSON.stringify({ mode, ...applied, backupPath }));
        return Response.json({ dryRun: false, mode, applied, backupPath, plan });
      },
    },

    // Any voter can estimate an uncosted citizen idea so it competes in the plan.
    "/api/emergent/:id/estimate": {
      POST: async (req) => {
        const voterId = resolveVoterId(req);
        const idea = db.emergent.find((p) => p.id === req.params.id);
        if (!idea) return bad("unknown citizen idea");
        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return bad("JSON body required");
        const result = recordEstimate(idea, voterId, body);
        if ("error" in result) return bad(result.error);
        await save();
        return Response.json({ ok: true });
      },
    },

    "/api/admin/emergent/:id/assess": {
      POST: async (req) => {
        if (!isAdmin(req)) return new Response("Not found", { status: 404 });
        const idea = db.emergent.find((p) => p.id === req.params.id);
        if (!idea) return bad("unknown emergent idea");
        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return bad("JSON body required");
        const result = assessIdea(idea, body);
        if ("error" in result) return bad(result.error);
        await save();
        return Response.json({ ok: true, proposal: idea });
      },
    },

    "/api/reset": {
      POST: async () => {
        db = seed();
        await save();
        return Response.json({ ok: true });
      },
    },
  },
  error(error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[SERVER_ERROR]", JSON.stringify({
      ts: new Date().toISOString(),
      message,
      stack,
    }));
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(`Civic Synthesis prototype running at ${server.url}`);
console.log(`[CONFIG] frame-ancestors=${FRAME_ANCESTORS} | embed-csp="${EMBED_CSP}" | publishDraftDefaultKind=${PUBLISH_DRAFT_DEFAULT_KIND} | debugRequestLogs=${DEBUG_REQUEST_LOGS}`);
