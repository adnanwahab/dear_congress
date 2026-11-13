# Codex CLI master prompt: ship a safe Civic Synthesis pilot

You are working in the repository `adnanwahab/dear_congress` on Civic Synthesis, a Bun + React civic deliberation prototype. Read `AGENTS.md` and all files under `docs/helios-pilot/` before implementing. Use `docs/helios-pilot/10_ENGINEERING_BACKLOG.md` as the prioritized task list. Do not treat any attached proposal as binding legislation.

## Mission

Implement a **genuine but non-binding pilot** for private journaling, voluntary civic input, authenticated advisory votes, transparent proposal versions, and receipts. Retain the existing six-stage demo and HappyBearLandia integration. A future national scale of 300 million daily inputs is a design target, not today's throughput promise.

## First action: source-of-truth reconciliation (no writes or deployment yet)

1. Inspect `git status`, remotes, branch, recent commits, existing tests, `server.ts`, `src/client/App.tsx`, `src/server`, `src/engine`, `fly.toml`, README, workflow and infrastructure files.
2. Verify whether `https://civic-synthesis.fly.dev/` is actually deployed from this repository/branch. `fly.toml` currently names `dear-congress`; do not assume the app mapping. Record Fly app IDs, deployment image/commit if available, deployment configuration and release procedure. Do not invent access or assume secrets.
3. Inventory ALL public write/read routes and their auth, data exposure, CORS, synthetic-vs-real handling, moderation and persistence. At minimum inspect `/api/journal`, `/api/journal/:id`, `/api/entries`, `/api/entries/events`, `/api/journals`, `/api/ballot_entries`, `/api/publish_draft`, `/api/publish_labels`, `/api/votes`, `/api/state`, `/api/citizen-proposals/*`, `/api/answers` and `/api/debug/request`.
4. Write a concise status report: verified facts, missing prerequisites and a P0/P1 cutline. If repository or deployment mapping is uncertain, do not deploy; continue with a reviewable PR.

## Engineering priorities in order

**P0-A: Storage and mode boundaries.** Introduce managed PostgreSQL or an existing maintained Postgres service, migrations, transaction-safe writes, unique keys and migration tests. Keep `DEMO` and `PILOT` modes and datasets clearly separated; never silently import publicly shared demo entries into a private production journal. Keep demo compatibility wherever possible. Do not replace JSON persistence without a rollback/backfill plan.

**P0-B: Auth and authorization.** Add or connect a maintainable login mechanism (prefer passwordless/email-link or existing provider) with a durable server-side account identifier. Treat `x-voter-id` only as an untrusted legacy demo identifier. Never imply a login proves unique-human or district eligibility. Authorize all personal read/write endpoints and admin operations server-side. Protect all alternate/legacy routes, not just new ones.

**P0-C: Private journal.** Create personal journals as `private` by default. Display a distinct, explicit consent step to share an anonymized issue label (`aggregate`) or publish a particular entry (`public`), with preview. Separate consent for third-party AI processing. Support owner-only view, correction, deletion and revocation behavior; include limitations of previously published content. No private journal bodies in public feed, SSE, map, synthesis, logs, debugging or errors.

**P0-D: Authentic advisory votes.** Implement one *current* vote per authenticated account per proposal; permit changing it within the open window, keep immutable revision history, issue a non-public receipt, enforce proposal version and close time, and prevent duplicate insertion under concurrency. Separate sample and genuine counts in queries and UI. Label all results non-binding and non-representative unless a valid methodology establishes otherwise. Never infer votes from journals or let AI vote.

**P0-E: Proposal and outcome traceability.** Include jurisdiction, source link, text versions, discussion window, administrative vs legislative authority, and status. Provide public outcome events with verified citations or marked demo examples. Make it easy to see "What happened after I contributed?" without exposing private ballots.

**P0-F: Test and ship safely.** Implement integration and security tests named in `07_TEST_AND_RELEASE.md`, run `bun test` and `bun run typecheck`, validate staging, document rollback, and only release production when all gates pass. If a gate fails, keep the insecure functionality demo-only or disabled and report exactly why.

## Constraints

- Preserve core routes `/`, `/journal`, `/votes`, `/needs`, `/synth`, and six-stage screens observed on the current live app, after source mapping is confirmed.
- Never present synthetic/model outputs as measured facts. Preserve `synthetic` markers, but do **not trust client-controlled `synthetic: true`** to assert internal provenance; authorize simulation ingestion separately.
- No partisan recommendations, personalized political persuasion, dark patterns or targeted turnout campaigns. Show balanced information, dissent, abstention and optional engagement.
- No involuntary journal publication. No identity or personal voting history in public result payloads.
- Do not expose credentials. Mask logs and disable the request-header echo debug endpoint in production.
- Do not contact government offices, create accounts, buy infrastructure, publish personal entries, merge to protected branches or deploy production without the required access and approval.
- For all design shortcuts, write down the residual risk. If a true P0 security control cannot be finished, **do not claim the real participation pilot is launch-ready**.

## Work pattern

Make small, reviewable changes and explain them. Prefer adapting the current Bun/React app to a rewrite. Update docs as implementation differs. After each P0, supply: changed files, migration notes, tests, demo compatibility, remaining blockers. Finish with a complete matrix against `07_TEST_AND_RELEASE.md`, staging URL if created, exact deployment target, and clear "Shippable / Not shippable" state. Do not invent passing tests or claim deployment unless verified.

## Optional next phase (not required today)

Once the safe pilot exists, work from `08_REFORM_CONCEPTS.md` to seed clearly labeled **review-only** proposals with research placeholders. Build opt-in notification and public response tracking. Plan national-scale architecture separately under `09_NATIONAL_SCALE.md` rather than building distributed complexity into the pilot.
