# Civic Synthesis (prototype)

A Bun + React prototype of the civic synthesis loop:

everyday is a list of journal entries from everyone
- plan is the input of function?




**Journal → need extraction → needs graph → open-ended voting → synthesis → plan**

## Run

```bash
bun install
bun dev          # http://localhost:3000 (hot reload)
bun test         # engine tests
bun run typecheck
```

State is saved to `data/db.json` (delete it or use "Reset demo" to start over).

## What's in it

| Step | What it does |
|---|---|
| **1 · Journal** | Free-text entry ("What's happening in your life?"). Extracts needs, importance, concerns and constraints. The original text stays attached, and you can correct the interpretation. |
| **2 · Needs** | Ranks shared needs by blending journal urgency with priority points. Shows the Value → Goal → Metric → Policies ladder per need, plus top priorities per jurisdiction (Houston, Harris County, Texas, US). |
| **3 · Vote** | 100 priority points, a yes/no vote on the *goal* before the policy, an open-ended "how should we get there?" box (clustered into existing ideas or turned into a new option), and 5-point stances with importance, compromise, concern and "what would change your mind". |
| **4 · Synthesize** | Scores every option (support, welfare, fairness, feasibility, reversibility, evidence) minus an institutional-change penalty, then picks a budget-constrained package. Produces three packages (Balanced, Minimal change, Most popular), each item explaining why, who asked, who disagrees, what changed because of objections, who implements it, what law changes, metrics, and a legislative-handoff JSON. Shows budget conflicts, rights-blocked options and emerging uncosted ideas. |

Hard rule: a proposal with a `rightsIssue` is never selected, however popular. The demo includes one (a durational residency requirement for vouchers) that polls at ~80% to show this.

## Layout

```
server.ts                 Bun.serve: HTML import + JSON API
index.html                entry, bundled by Bun
src/engine/catalog.ts     needs, proposals, seed journals
src/engine/engine.ts      extraction, clustering, simulated population, scoring, synthesis
src/engine/types.ts       shared types
src/client/App.tsx        React UI (4 steps)
src/client/styles.css
```

## API

- `GET  /api/state`
- `POST /api/journal` `{ text, author? }`
- `PATCH /api/journal/:id` `{ needs: string[] }` (correction)
- `POST /api/votes` `{ votes?, allocation?, goalVotes? }`
- `POST /api/answers` `{ needId, text }`
- `POST /api/publish_draft` (external clients; supports `kind` modes below)
- `POST /api/publish_labels` `{ entryId, labels[] | needs[] }`
- `POST /api/synthesize` `{ weights?, lambda?, budget? }`
- `POST /api/reset`

### External journal client: `publish_draft` modes

For browser clients on another origin, send:

- `Content-Type: application/json`
- `x-voter-id: <stable-client-id>` (recommended; enables per-voter aggregation)

#### 1) Journal mode (default)
Creates a journal entry only (feeds Needs tab), and does **not** force-create a ballot option.

```json
{
  "text": "Rent went up again and the bus to work takes over an hour.",
  "author": "Jordan · East End",
  "kind": "journal"
}
```

You can omit `kind` and it defaults to `"journal"`.

#### 2) Answer mode with explicit need
Treats text as an open-ended policy answer and routes through the same path as `/api/answers`.

```json
{
  "text": "Expand housing vouchers in high-cost areas.",
  "kind": "answer",
  "needId": "housing"
}
```

#### 3) Answer mode without need
Server auto-detects/creates need first, then records the answer.

```json
{
  "text": "Create evening express buses for shift workers.",
  "kind": "answer"
}
```

## Prototype shortcuts → next steps

- **Extraction now supports LLM providers** with automatic fallback order `Gemini → OpenAI → Claude → local keyword extractor`. Set any of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (and optional model env vars `GEMINI_MODEL`, `OPENAI_MODEL`, `CLAUDE_MODEL`). If no keys are set, it stays fully offline.
- **Opinions come from 600 simulated residents** (5 archetypes, deterministic) plus your own inputs. Replace `POPULATION` with real aggregated votes.
- **Costs, support and legal details are illustrative**, not real estimates.
- **Storage is a JSON file.** The Postgres schema in the design doc (journals, needs, proposals, votes, plans, experiments, outcomes) is the natural next step.
- Not yet built: user accounts, outcome measurement / policy experiments feeding back into journals, district-level views.
