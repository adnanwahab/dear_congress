import index from "./index.html";
import { NEEDS, SEED_JOURNALS, CHANGE_LEVELS } from "./src/engine/catalog";
import {
  ARCHETYPES, POPULATION, buildContext, clusterAnswer, emptyDB, extract, synthesize, DEFAULT_WEIGHTS,
} from "./src/engine/engine";
import type { DB, JournalEntry, Proposal, UserVote, Weights } from "./src/engine/types";

const DB_PATH = process.env.DB_PATH ?? "data/db.json";

async function load(): Promise<DB> {
  const f = Bun.file(DB_PATH);
  if (await f.exists()) return { ...emptyDB(), ...(await f.json()) };
  return seed();
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

let db = await load();
const save = () => Bun.write(DB_PATH, JSON.stringify(db, null, 2));
await save();

function state() {
  const ctx = buildContext(db);
  return {
    needs: NEEDS,
    changeLevels: CHANGE_LEVELS,
    proposals: ctx.proposals,
    stats: ctx.stats,
    demand: ctx.demand,
    mechanismShare: ctx.mechanismShare,
    goalSupport: ctx.goalSupport,
    entries: [...db.entries].reverse(),
    population: { n: POPULATION.length, archetypes: ARCHETYPES.map((a) => ({ name: a.name, share: a.share })) },
    user: { votes: db.votes, allocation: db.allocation, goalVotes: db.goalVotes, answers: db.answers },
    defaultWeights: DEFAULT_WEIGHTS,
  };
}

const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8000),
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,

    "/api/state": { GET: () => Response.json(state()) },

    "/api/journal": {
      POST: async (req) => {
        const { text, author } = (await req.json()) as { text?: string; author?: string };
        if (!text?.trim()) return bad("text is required");
        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          author: author?.trim() || "You",
          text: text.trim(),
          createdAt: new Date().toISOString(),
          extraction: extract(text, buildContext(db).proposals),
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
        const valid = needs.filter((id) => NEEDS.some((n) => n.id === id));
        entry.extraction.needs = valid.map((id) => entry.extraction.needs.find((n) => n.id === id) ?? { id, confidence: 1 });
        entry.corrected = true;
        await save();
        return Response.json(entry);
      },
    },

    "/api/votes": {
      POST: async (req) => {
        const body = (await req.json()) as { votes?: UserVote[]; allocation?: Record<string, number>; goalVotes?: Record<string, boolean> };
        for (const v of body.votes ?? []) db.votes[v.proposalId] = v;
        if (body.allocation) {
          const total = Object.values(body.allocation).reduce((s, v) => s + v, 0);
          if (total > 100) return bad("allocation exceeds 100 points");
          db.allocation = body.allocation;
        }
        if (body.goalVotes) db.goalVotes = { ...db.goalVotes, ...body.goalVotes };
        await save();
        return Response.json({ ok: true });
      },
    },

    // Open-ended "how should we accomplish that?" answers
    "/api/answers": {
      POST: async (req) => {
        const { needId, text } = (await req.json()) as { needId: string; text: string };
        if (!text?.trim() || !NEEDS.some((n) => n.id === needId)) return bad("needId and text are required");
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
        db.answers.push({ id: crypto.randomUUID(), needId, text: text.trim(), proposalId, createdAt: new Date().toISOString() });
        await save();
        return Response.json({ proposalId, isNew });
      },
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
});

console.log(`Civic Synthesis prototype running at ${server.url}`);
