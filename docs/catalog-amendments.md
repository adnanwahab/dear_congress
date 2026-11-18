# Proposed catalog amendments: SQLite submission MVP

**Scope:** Discussion-concept suggestions, not changes to enacted law, reviewed bill text, or advisory votes. This implementation stores proposed amendments for the current immutable catalog revision without changing source files or voting records.

## User flow

Open /votes?bill=HFL-042, write a suggestion of 20–4,000 characters, optionally preview it, confirm the private-review disclosure, and click **Submit proposed amendment**.

POST /api/catalog-bills/:id/amendments accepts JSON with revision (exact SHA-256), text, requestId (UUID) and confirmForReview=true.

Successful saves return an amendment ID, a durable receipt ID, the exact revision, a timestamp and pending_review. Confirmation displays only after SQLite commits. Failed requests retain the unsaved text. Retrying unchanged text reuses the same request ID.

GET /api/catalog-bills/:id/amendments returns the current revision's submissions **for the originating signed browser identity only**. A different browser/profile does not automatically own earlier submissions.

POST /api/catalog-bills/:id/amendments/:amendmentId/withdraw accepts a JSON revision and UUID requestId. Withdrawal scrubs text from the active SQLite row and removes it from the review queue, while retaining metadata and hashes for audit. Earlier database backups may contain text and need retention/access controls.

## Storage and authorization

Both new tables live inside the existing catalog SQLite database, configured by CATALOG_DB_PATH (usually DB_PATH + ".catalog.sqlite"):

- catalog_amendments: bill ID, exact revision, jurisdiction, owner HMAC, immutable submission identity, pending/withdrawn status, text/hash, idempotency key and timestamps.
- catalog_amendment_events: submission and withdrawal receipt events. No raw visitor identity or amendment text in events.

Writes reuse shared rate limits, signed-cookie browser identity, same-origin policy, bounded JSON, validation, and SQLite transactions. Replaying a request ID with a different body is rejected. A browser is limited to 20 simultaneously active proposals per bill revision.

**Privacy:** Submissions are visible to the submitting browser and authorized reviewers, not shown in public results or counted as votes. Authorized reviewer queue entries for the original HFL-001–HFL-100 proposals include pending amendments and show them at /review. The other 10 research concepts also allow durable private submissions, but their staff inbox is a separate follow-up; do not imply they have completed expert review.

A submitted amendment does not edit the source-controlled concept, approve a review, open a ballot, cast a vote, or enact legislation. Future public posting requires moderation and separate consent.

## Verification

    bun test src/server/catalog-amendments.test.ts
    bun run typecheck
    bun test
    bun run test:routes

Acceptance also requires a keyboard and mobile browser pass. Before production release, back up the SQLite volume including WAL state and obtain a human review. Never publish private amendment text or treat test fixtures as real reviews.
