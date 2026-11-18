# Catalog expert review center

`/review` accepts public review suggestions and exposes the review queue only to
configured reviewers. Suggestions are stored as pending and cannot change a
review status. Reviewer decisions are written to the separate SQLite file
`CATALOG_REVIEW_DB` (default: `data/catalog-review.sqlite`, production default:
`/data/catalog-review.sqlite`). The database enables WAL and foreign keys; the
schema creates a versioned migration ledger. Do not point this at the application
JSON database or HBL databases.

## Configure reviewers

Set `CATALOG_REVIEWERS` to a JSON array in the server environment. Tokens must be
at least 32 characters and are sent only in the Authorization Bearer header. For
example, a local development reviewer can be configured with:

```sh
export CATALOG_REVIEWERS='[{"id":"local-legal","name":"Local Legal Reviewer","token":"replace-with-a-random-secret-at-least-32-chars","roles":["legal"]}]'
```

Supported roles are `legal`, `evidence`, `fiscal`, `editorial`, and `publisher`.
Use independently generated credentials for each reviewer, store them in the
secret manager, and never commit tokens. Without configured reviewers, the
queue and decision APIs fail closed. The example is a disposable local fixture,
not a production identity.

## Review workflow

Anyone may submit a source-linked finding on `/review`; it is explicitly a
suggestion and remains pending. A reviewer loads the protected queue by entering
the configured token, opens the bill and its exact revision, then records an
approval, request for changes, or decline with rationale. Decisions and audit
events retain reviewer, category, revision digest, jurisdiction, and timestamp.
Stale digests are rejected. The publisher endpoint separately checks that legal,
evidence, fiscal, and editorial decisions all approve the exact current revision.
It records `review_ready`; it does not open a public ballot. Public ballots remain
subject to the separate exact-publication ballot service and its existing review
ledger gate. The database review decisions recorded here are not yet connected
to that publication gate, so a `review_ready` record alone cannot open a ballot.

Back up the separate SQLite file using SQLite's online backup API or while the
application is stopped, including its WAL state. Do not copy only the main file
while writes are active. Restore to a new path, verify the review queue and audit
events, then change `CATALOG_REVIEW_DB` during a separately authorized release.
Rollback is forward-safe: retain the database and point the app to the prior
compatible image. Never delete or overwrite production participation data.
