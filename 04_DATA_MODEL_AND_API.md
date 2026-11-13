# Data model and proposed API contract

This is a **target interface**, not a claim these endpoints already exist. Adapt to repository conventions, create forward-only migrations, and document real API changes. Keep legacy routes behind explicit mode boundaries until secured.

## Proposed core SQL (illustrative; review and harden before running)

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auth_email_verified_at TIMESTAMPTZ,
  verification_level TEXT NOT NULL DEFAULT 'account_only'
    CHECK (verification_level IN ('account_only','additional_checked'))
);

CREATE TABLE journals (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES accounts(id),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','aggregate','public')),
  synthetic BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'human',
  consent_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX journals_owner_created_idx ON journals(owner_id, created_at DESC);

CREATE TABLE journal_consent_events (
  id UUID PRIMARY KEY,
  journal_id UUID NOT NULL REFERENCES journals(id),
  actor_id UUID NOT NULL REFERENCES accounts(id),
  prior_visibility TEXT NOT NULL,
  new_visibility TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proposals (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  jurisdiction_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'advisory',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE proposal_versions (
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  full_text TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, version)
);

CREATE TABLE advisory_ballots (
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  proposal_version INTEGER NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('support','oppose','unsure')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, account_id),
  FOREIGN KEY (proposal_id, proposal_version)
    REFERENCES proposal_versions(proposal_id, version)
);
CREATE TABLE advisory_ballot_events (
  id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL,
  account_id UUID NOT NULL,
  proposal_version INTEGER NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('support','oppose','unsure')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proposal_outcome_events (
  id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  source_url TEXT,
  evidence_status TEXT NOT NULL CHECK (evidence_status IN ('demo','unverified','verified')),
  recorded_by UUID REFERENCES accounts(id),
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Security note:** SQL constraints are only one layer. Add row-level policies or equivalent application-level filters for EVERY query; restrict direct table access; enforce journal visibility/consent and signed human provenance at the server. Consider encrypting journal body with application-managed keys after initial private pilot. A human-authenticated request must never be allowed to set `synthetic` arbitrarily. Add moderation, deletion, retention and access-audit support as needed.

## Transaction semantics

- An advisory ballot is created/updated in **one DB transaction** that verifies an open proposal version, performs an upsert into `advisory_ballots`, and writes exactly one history event for each accepted revision. Unique `(proposal_id, account_id)` prevents multiple current ballots, including concurrent requests.
- Use an idempotency key or deterministic request ID to avoid duplicate history events on retries. An `advisory_ballot_events` unique idempotency index or write-request table is recommended before launch.
- A substantive version change must close the old ballot or explicitly require renewed consent/revote. Never silently transfer votes to materially different text.
- Results should be computed exclusively from current ballots in PILOT mode. Publish count and denominator caveats; do not expose account IDs or individual choices.

## API: examples

### `POST /api/pilot/journals` (authenticated)

Request: `{ "text": "My bus was late", "visibility": "private" }` (default is private). Response: `201 {"id":"...","visibility":"private","createdAt":"..."}`. Do not return model-extracted labels until the user has consented to applicable processing.

### `GET /api/pilot/journals` (authenticated)

Owner-only paginated list. `GET/PATCH/DELETE /api/pilot/journals/:id` requires owner checks; cross-account requests return 404 or 403 consistently without leaking existence.

### `POST /api/pilot/journals/:id/visibility` (authenticated)

Request: `{ "visibility":"aggregate", "consentVersion":"2026-11-pilot-v1" }`. Requires explicit confirmation; stores audit event. Aggregate mode shares approved need labels, not raw text. Public mode should include a preview of exactly what will appear.

### `POST /api/pilot/journals/:id/need-confirmations` (authenticated)

Request: `{ "needIds":["transit"], "reviewedVersion": 2 }`. Server validates taxonomy IDs. Owner can reject model labels; no silent policy ballot side effect.

### `PUT /api/pilot/proposals/:id/ballot` (authenticated)

Request: `{ "proposalVersion": 3, "choice": "support", "idempotencyKey": "uuid" }`. Response: `{ "recorded": true, "receiptId":"opaque-uuid", "recordedAt":"...", "proposalVersion": 3 }`. Window, auth, version and uniqueness checked server-side. Permit modifications until close time, including `unsure`; no default vote choice.

### `GET /api/pilot/me/receipts` (authenticated)

Private list of the user's own advisory ballot receipts. No receipt exposes ballot choices to third parties. Public integrity audits use aggregate logs not a searchable registry of choices tied to people.

### `GET /api/pilot/proposals/:id/results` (public)

Example:

```json
{
  "kind": "advisory",
  "dataMode": "real_pilot",
  "proposalId": "...",
  "proposalVersion": 3,
  "counts": {"support": 12, "oppose": 5, "unsure": 3},
  "distinctAuthenticatedAccounts": 20,
  "uniquePeopleVerified": false,
  "representativeSample": false,
  "binding": false,
  "updatedAt": "2026-11-13T18:00:00Z"
}
```

### `GET /api/pilot/proposals/:id/outcomes` (public)

Sourced timeline of actions, with clear `verified`, `unverified`, or `demo` status. Never label a demo email as a real legislative response.

## Compatibility and endpoints to audit

Protect old `/api/journal`, `/api/journal/:id`, `/api/entries`, `/api/entries/events`, `/api/journals`, `/api/ballot_entries`, `/api/publish_draft`, `/api/publish_labels`, `/api/votes`, `/api/state`, `/api/answers` and citizen-proposal routes. Public reads must never return new private journals. For HappyBearLandia simulation ingestion, introduce separate trusted integration credentials and a distinct dataset. Never assume endpoint naming alone creates a security boundary.

## Data retention

Define and document retention for raw journals, consent evidence, ballot revisions and admin audit trails. Delete/erase personal data as required by applicable policy/law, while describing limits on previously published content and legitimate immutable audit records. No personal information is used to personalize political persuasion or hidden scoring.
