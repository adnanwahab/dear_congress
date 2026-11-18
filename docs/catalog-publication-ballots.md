# Catalog publication and advisory ballots — implementation candidate

**Status:** Review branch only. Not merged, deployed, or authorized. All original 100 HFL bills remain blocked until legitimate human reviews are recorded.

## Separation and persistence

The existing Markdown and generated JSON are still the original source of the 100 editorial draft concepts. A **separate SQLite database** holds exact published bill/review snapshots, current browser advisory choices, ballot events and publication audit entries. The default path is DB_PATH + ".catalog.sqlite" (on Fly normally /data/db.json.catalog.sqlite), or the operator may set CATALOG_DB_PATH to a persistent mounted location.

The tables are catalog_publications, catalog_publication_audit, catalog_current_ballots, catalog_ballot_events, catalog_draft_choices, and catalog_draft_choice_events. The backend uses WAL, foreign keys, busy timeout and transactional writes. It does not migrate, reset or overwrite /data/db.json, existing citizen proposal records, or the HBL developer-governance database.

SQLite with one attached Fly volume is an early single-writer pilot, **not** a global-scale distributed ballot system.

## Requirements for publication

An authorized reviewer with the configured `publisher` role can call the publication endpoint and attest review readiness in the Review Center. The existing ADMIN_TOKEN + CATALOG_PUBLISHER_ID operator path also remains supported; identity never comes from request JSON. Publication requires a same-origin request, an immutable current HFL source revision, a specified UTC opening/closing window and all four human review categories approved for that exact text and jurisdiction.

The protected `/review` center now stores suggestions and reviewer decisions in a separate database, using server-configured reviewer credentials. The ballot publication lookup now consumes publisher-attested SQLite review receipts instead of the source-controlled ledger. The attestation contains the exact four latest approved decision IDs; subsequent changes close the ballot for new votes. No production reviewer credentials or approvals are configured. Do not claim a configured token proves legal/fiscal/research qualifications, and do not add fake approvals or set `advisoryPublicationAllowed` to unconditional true. Until the review center is deliberately integrated with publication authorization and actual human decisions are recorded for each exact revision, all 100 original source records remain blocked.

HFL-051 is additionally held until its separate legislative supplement receives a revision-specific review binding; the catalog digest alone does not cover that supplement.

## Read-only and ballot endpoints

- GET /api/catalog-bills/:id — current publication status and the browser's own choice, if any
- GET /api/catalog-bills/:id/results — publication state and aggregate counts without any individual choice
- GET /api/catalog-bills/:id/ballot — publication state and the current browser's own advisory choice
- PUT /api/catalog-bills/:id/ballot — current choice upsert or withdrawal for an open, reviewed, exact publication
- POST /api/catalog-bills/:id/publications — protected human-publisher publication of an approved revision

Publication POST payload: revision, opensAt and closesAt (UTC timestamps). Ballot PUT payload: revision, publicationId, choice and requestId. Choices are support, oppose, unsure, or null for withdrawal; requestId is a stable UUID used for idempotent retries. Status responses are non-cacheable.

Shared middleware replaces any untrusted voter header with the signed-cookie browser identity; the ballot store retains a secret-keyed hash rather than that raw identity. Public write rate and origin controls apply. A saved receipt ID only appears after transactional commit.

Changes to an approved bill or a revoked/replaced review make the existing publication non-votable, even though its historical record and choices remain auditable. A new substantive revision requires a new publication and fresh explicit choices; no old votes are transferred. Aggregates represent **unverified browser identifiers**, not validated electorate turnout, representative polling, or legally binding votes. The new catalog tables remain separate from actual citizen proposals, demo residents, legislation metadata, and GitHub developer PR voting.

## Local verification

Use an isolated test directory and stable ANON_COOKIE_SECRET (32+ characters). Run:

    bun test src/server/catalog-ballots.test.ts src/server/catalog-ballots-api.test.ts src/server/catalog-review-ballot-flow.test.ts
    bun run typecheck
    bun test
    bun run test:routes

Test fixtures inject synthetic complete reviews; they **do not** authorize production bills. Also verify an isolated server restart, current-vote restoration, replayed idempotent request receipts, rejection of stale revisions and unauthorized publishers, and protection against cross-origin writes.

Actual deployment/browser acceptance, reviewer identity verification beyond configured credentials, connecting database review decisions to ballot publication, public voting windows, multi-writer behavior, migrations from static catalog to edited versions, and scale testing are separate human-reviewed milestones.

## Safe deployment / rollback

Before any authorized release, back up Fly's persistent volume, including a consistent snapshot of the catalog SQLite database and its WAL/SHM files, and verify restore on an isolated machine. Rolling back code must retain the new database and its history. Never delete existing JSON records, reset public votes, fake source approvals, automatically publish bills, or use this feature to enact legislation.


## Durable feedback before publication (review-integration branch)

GET and PUT `/api/catalog-bills/:id/draft-feedback` read or save a Yes/No/Unsure choice for the immutable current source revision before any approved ballot. PUT uses `{revision,choice,requestId}`, where `choice:null` withdraws. The server's signed-cookie browser identity, rate limits, same-origin policy, transactions, idempotency receipts and version validation apply.

**This is unpublished draft feedback, not a vote in the reviewed ballot.** Its current choices and append-only event receipts remain in separate SQLite tables. No draft feedback is migrated into a later ballot; when publication opens, the draft feedback write lane closes. The UI only reports successful saves after a server receipt. All figures remain unverified-browser counts, not people or official turnout. 
