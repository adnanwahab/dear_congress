import index from "./index.html";
import { NEEDS, SEED_JOURNALS, CHANGE_LEVELS } from "./src/engine/catalog";
import {
  ARCHETYPES, POPULATION, buildContext, clusterAnswer, emptyDB, extract, synthesize, tokens, DEFAULT_WEIGHTS,
} from "./src/engine/engine";
import type { Context } from "./src/engine/engine";
import type { DB, JournalEntry, NeedDef, Proposal, UserVote, Weights } from "./src/engine/types";
import { publishLabelsOptions, publishLabelsPost } from "./src/server/publish-labels";
import { extractWithLLM } from "./src/server/llm-extract";

const DB_PATH = process.env.DB_PATH ?? "data/db.json";
const FRAME_ANCESTORS = (process.env.FRAME_ANCESTORS ?? "'self' *").trim() || "'self' *";
const EMBED_CSP = `frame-ancestors ${FRAME_ANCESTORS}`;
const DEBUG_REQUEST_LOGS = (process.env.DEBUG_REQUEST_LOGS ?? "1") !== "0";
const PUBLISH_CORS_ALLOW_ORIGIN = (process.env.PUBLISH_CORS_ALLOW_ORIGIN ?? "*").trim() || "*";
const READ_CORS_ALLOW_ORIGIN = (process.env.READ_CORS_ALLOW_ORIGIN ?? PUBLISH_CORS_ALLOW_ORIGIN).trim() || "*";

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
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function readCorsHeaders(req: Request) {
  return {
    "access-control-allow-origin": corsAllowOrigin(req, READ_CORS_ALLOW_ORIGIN),
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
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

async function load(): Promise<DB> {
  const f = Bun.file(DB_PATH);
  if (!(await f.exists())) return seed();

  const loaded = { ...emptyDB(), ...(await f.json()) } as DB;

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

  return loaded;
}

function seed(): DB {
  const db = emptyDB();
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

function upsertEmergentProposalFromDraft(needId: string, text: string, voterId?: string) {
  const ctx = buildContext(db);
  const proposalId = clusterAnswer(text, needId, ctx.proposals);
  if (proposalId) {
    db.answers.push({ id: crypto.randomUUID(), needId, text: text.trim(), proposalId, createdAt: new Date().toISOString(), voterId });
    return { proposalId, isNew: false };
  }

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
  db.answers.push({ id: crypto.randomUUID(), needId, text: text.trim(), proposalId: emergent.id, createdAt: new Date().toISOString(), voterId });
  return { proposalId: emergent.id, isNew: true };
}

let db = await load();
const save = () => Bun.write(DB_PATH, JSON.stringify(db, null, 2));
await save();

function state(voterId = "anon") {
  const ctx = buildContext(db);
  const userVotes = db.votesByVoter[voterId] ?? {};
  const userAllocation = db.allocationByVoter[voterId] ?? {};
  const userGoalVotes = db.goalVotesByVoter[voterId] ?? {};
  const realVoters = new Set([
    ...Object.keys(db.votesByVoter),
    ...Object.keys(db.allocationByVoter),
    ...Object.keys(db.goalVotesByVoter),
  ]).size;

  const userAnswers = db.answers.filter((a) => a.voterId === voterId || (voterId === "anon" && !a.voterId));

  return {
    needs: ctx.needs,
    changeLevels: CHANGE_LEVELS,
    proposals: ctx.proposals,
    stats: ctx.stats,
    demand: ctx.demand,
    mechanismShare: ctx.mechanismShare,
    goalSupport: ctx.goalSupport,
    entries: [...db.entries].reverse(),
    population: {
      n: POPULATION.length,
      archetypes: ARCHETYPES.map((a) => ({ name: a.name, share: a.share })),
      realVoices: realVoters,
    },
    user: { votes: userVotes, allocation: userAllocation, goalVotes: userGoalVotes, answers: userAnswers },
    defaultWeights: DEFAULT_WEIGHTS,
  };
}

const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    "/api/journal": {
      POST: async (req) => {
        const { text, author } = (await req.json()) as { text?: string; author?: string };
        if (!text?.trim()) return bad("text is required");
        const ctx = buildContext(db);
        const llm = await extractWithLLM(text.trim(), ctx.proposals, ctx.needs);
        const extraction = ensureNeedCoverage(text.trim(), llm.extraction, llm.proposedNeed);

        logPublishEvent("EXTRACT_PROVIDER", {
          route: "/api/journal",
          provider: llm.provider,
          matchedNeedIds: extraction.needs.map((n) => n.id),
        });

        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          author: author?.trim() || "You",
          text: text.trim(),
          createdAt: new Date().toISOString(),
          extraction,
          corrected: false,
        };
        db.entries.push(entry);
        await save();
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
            keywords: [],
            metrics: [],
            legalChange: "Needs legal analysis",
            emergent: true,
            sourceText: text.trim(),
          };
          db.emergent.push(emergent);
          proposalId = emergent.id;
        }
        db.answers.push({ id: crypto.randomUUID(), needId, text: text.trim(), proposalId, createdAt: new Date().toISOString(), voterId });
        await save();
        return Response.json({ proposalId, isNew });
      },
    },

    "/api/entries": {
      OPTIONS: (req) => new Response(null, { status: 204, headers: readCorsHeaders(req) }),
      GET: (req) => {
        const entries = entriesNewestFirst();
        return withReadCors(req, Response.json({ entries }));
      },
      POST: async (req) => {
        const body = (await req.json()) as { text?: string; author?: string; labels?: string[]; needs?: string[] };
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

        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          author: body.author?.trim() || "You",
          text: body.text.trim(),
          createdAt: new Date().toISOString(),
          extraction,
          corrected: labels.valid.length > 0,
        };

        db.entries.push(entry);
        await save();

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
      GET: () => Response.json({
        version: 1,
        endpoints: {
          publish_draft: "/api/publish_draft",
          publish_labels: "/api/publish_labels",
        },
        needs: currentNeeds().map((n) => ({ id: n.id, label: n.label })),
      }),
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

        let body: { text?: string; author?: string; labels?: string[]; needs?: string[] };
        try {
          body = (await req.json()) as { text?: string; author?: string; labels?: string[]; needs?: string[] };
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

        if (!body.text?.trim()) {
          logPublishEvent("PUBLISH_DRAFT_REJECTED", {
            reason: "text is required",
            origin,
            referer,
            remote,
            author: body.author?.trim() || null,
          });
          return publishBad(req, "text is required");
        }

        const ctx = buildContext(db);
        const llm = await extractWithLLM(body.text.trim(), ctx.proposals, ctx.needs);
        let extraction = llm.extraction;
        const labels = normalizeNeedIds(body.labels ?? body.needs);
        if (labels.valid.length > 0) {
          extraction = { ...extraction, needs: labels.valid.map((id) => extraction.needs.find((n) => n.id === id) ?? { id, confidence: 1 }) };
        } else {
          extraction = ensureNeedCoverage(body.text.trim(), extraction, llm.proposedNeed);
        }

        logPublishEvent("EXTRACT_PROVIDER", {
          route: "/api/publish_draft",
          provider: llm.provider,
          matchedNeedIds: extraction.needs.map((n) => n.id),
        });

        const createdFromDraft = extraction.needs.map((n) => upsertEmergentProposalFromDraft(n.id, body!.text!.trim(), voterId));

        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          author: body.author?.trim() || "Journal Client",
          text: body.text.trim(),
          createdAt: new Date().toISOString(),
          extraction,
          corrected: labels.valid.length > 0,
        };

        db.entries.push(entry);
        await save();

        logPublishEvent("PUBLISH_DRAFT_OK", {
          entryId: entry.id,
          author: entry.author,
          textLength: entry.text.length,
          textPreview: entry.text.slice(0, 120),
          acceptedNeedIds: labels.valid,
          ignoredNeedIds: labels.ignored,
          extractedNeedIds: extraction.needs.map((n) => n.id),
          createdProposalIds: createdFromDraft.map((x) => x.proposalId),
          origin,
          referer,
          remote,
        });

        return withPublishCors(req, Response.json({
          ok: true,
          entryId: entry.id,
          acceptedNeedIds: labels.valid,
          ignoredNeedIds: labels.ignored,
          proposalIds: createdFromDraft.map((x) => x.proposalId),
          createdNewCount: createdFromDraft.filter((x) => x.isNew).length,
          entry,
        }));
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

    "/api/synthesize": {
      POST: async (req) => {
        const { weights, lambda, budget } = (await req.json()) as { weights?: Weights; lambda?: number; budget?: number };
        return Response.json(synthesize(buildContext(db), weights ?? DEFAULT_WEIGHTS, lambda ?? 0.25, budget ?? 40));
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
console.log(`[CONFIG] frame-ancestors=${FRAME_ANCESTORS} | embed-csp="${EMBED_CSP}" | debugRequestLogs=${DEBUG_REQUEST_LOGS}`);
