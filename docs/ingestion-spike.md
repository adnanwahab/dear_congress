# Local synthetic ingestion spike (SHE-320)

Run `bun run benchmark:ingestion 1000` from the repository root. The optional
count is an integer from 1 to 1,000,000. Run `bun test src/ingestion` for positive,
negative, restart and transaction-failure checks. Save stdout to a disposable JSON
file to compare runs; record `git rev-parse HEAD` and `git diff` with each run.

The command creates and removes its own temporary SQLite database. It accepts no
endpoint, credentials, source file or database path; it cannot send a load test to
Fly or publish into the application's feeds, metrics, votes or records. Synthetic
text is fixed invented content. No provider is invoked. There is no public route
or deployment flag to enable. `server.ts` does not import this spike.

The executable pipeline connects existing journal validation, the existing
contact-detail heuristic and the existing offline needs extractor to a durable
SQLite queue, idempotency receipts, consent fences, derived contributions and
transactional audit. Synthetic tenant/region/subject scopes use tuple keys;
source IDs remain distinct from receipts. The trusted harness supplies scope;
these strings are not credentials or verified geography. Tenant and region
separation tests prove logical key isolation, not infrastructure residency.

Acceptance returns only after the queue, receipt and audit transaction commits
(WAL, synchronous FULL). Same-key identical retries return the original receipt,
including after restart. Changed source/text/generation conflicts. Consent must
be current before enqueue and processing. Withdrawal increments the fence,
clears queued payloads and contributions, and records an audit atomically.
Regrant requires a new generation and new event keys. Processing commits its
contribution and terminal marker atomically and discards raw text. Contact matches
are terminal `held` with no contribution and no retained text; there is no review
UI. The detector remains a heuristic, with its existing limitations.

Default queue bounds are 100 pending events per subject scope and 60 seconds
oldest age. New events then throw status 429 with retryAfter=1; same-key retries
still resolve, and withdrawal is independent of queue admission. These are local
module errors, not an HTTP service. Persistence failures throw without returning
a receipt. A future authenticated gateway must map storage failures to 503 and
429 to HTTP Retry-After, with bounded retries using the same key. Per-tenant,
per-region, IP and total byte budgets remain unimplemented; the existing beta
limits are unchanged. Do not expose this class to untrusted callers.

The report records source baseline SHA and dirty status, actual event/duplicate counts, elapsed wall time, completed/s,
p95/p99 enqueue-plus-worker duration and withdrawal duration, Bun/platform/arch,
topology and reconciliation. It separately generates the review's 1M/10M/300M
capacity formulas and arbitrary cost sensitivities, with assumptions and units.
Those curves are models, not measured capacity or vendor prices. The generator is
closed-loop and single-process, with one payload and no offered-rate schedule,
network, replication, provider latency or coordinated-omission correction.
Do not compare its latency to an HTTP SLO or extrapolate its events/s to daily
production capacity. There is no 24-hour soak, 1M/day result or 300M/day claim.

Deletion here is logical deletion from active SQL tables only. Digests, source
references, pseudonymous scope keys and audit remain; SQLite pages/WAL/backups
may retain old bytes. This is not secure erasure or complete privacy acceptance.
No cache, provider, replica, DLQ or backup deletion protocol exists. Real text
must never enter this spike. Single-file SQLite is a prototype decision, not a
national-scale architecture selection. The broader threat model, failure drills,
SLO proposals and phased acceptance remain in [the review](reviews/SHE-320.md).

On queue pressure, stop the synthetic producer and drain the affected scope;
withdrawal remains available. On storage/audit failure, do not acknowledge or
continue accepting; fix the disposable store and retry the same key. On restart,
reopen the same test DB and process queued receipts. Never restore real backups
or copy a spike database into production. Actual regional failure and deletion
runbooks still require architecture review and named human owners.
