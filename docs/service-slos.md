# Launch service indicators — SHE-968

Repository implementation; production rollout, live alert routing and on-call
acceptance remain unverified. This independent advisory beta is not election
infrastructure. These signals do not establish verified participation or vote authority.

Open `/admin/stats` with the existing admin credential. The Service SLOs section
refreshes with the page and evaluates the trailing **600 seconds** at observation
time. Windows are `(now − 600s, now]`; thresholds are breached strictly above the
limits below. No samples means unknown, never 100% availability.

| Indicator | Calculation and threshold | Responsible owner |
| --- | --- | --- |
| Route latency | Nearest-rank p95 of eligible response-header durations by method and configured route template; ≤ 1,000 ms | Repository maintainer Adnan; shift acceptance pending |
| Server errors / request availability | HTTP 500–599 / eligible completed requests for each route; ≤ 1% errors, ≥ 99% request availability | Repository maintainer Adnan; shift acceptance pending |
| Client advisory save failures | Failed HTTP 5xx or network exceptions / (successful HTTP saves + failures); ≤ 1% | Repository maintainer Adnan; shift acceptance pending |

A single sample can breach: counts are displayed so low-volume noise is visible.
These are initial operational targets, not measured production baselines or a
contractual uptime promise. Revisit with observed traffic, not headline user counts.
The panel shows BREACH when either applicable threshold is exceeded. There is no
background alert scheduler or external notification delivery in this change.

## Scope and classification

Server observation wraps registered route functions after existing security and
application handlers. Exceptions count as 500 and propagate to the existing
error handler. Timing includes security and metrics work through response creation;
it excludes network body transfer, SSE connection lifetime and time before Bun
invokes the handler. Shell routes use existing normalized page templates;
unknown paths and assets share a fixed label. Admin pages and telemetry ingestion
are excluded to avoid observer traffic distorting results. Query strings, request
IDs, bodies, identity, IPs and cookies are not stored in the operations collector.

Paused journal submission responses retain their existing 503 status and gain
`x-service-outcome: blocked`. The server sets this classification; request headers
cannot opt out of error counting. These writes are shown as blocked and excluded
from latency/error denominators. Other 503s, including upstream outages, remain
server errors. 4xx responses remain successful server availability responses,
although they do not imply that a save succeeded. Never exclude all 503s or hide
real server errors by changing their status.

Client coverage is the main `App.tsx` API helper for journal create/edit/delete,
answers, civic votes and citizen proposal advisory votes. Each HTTP save result
reports only `saved`, `failed` or `blocked`. HTTP 4xx and explicit paused-write 503s
are blocked, excluded from its denominator and displayed separately. Network errors
are failures; deliberate AbortError cancellation is omitted. Success means HTTP
success, not a durable-read verification; JSON decoding and subsequent rendering
failures are outside this indicator. Other modules' direct fetch calls, repository
ballots, local draft storage, and offline actions never attempted by this helper
are outside coverage. Server and client failures are separate signals, never added
together. Lost responses may be counted as failed even if persistence succeeded.

The same-origin, 256-byte, separately rate-limited reporting endpoint accepts no
extra fields, issues no identity/cookie and does not consume voting budgets.
Reports are unverified, can be forged, and may be dropped due to network loss,
blocking or rate limits. Reporting is best effort, without retries; its failure
cannot change the save response. It sends no journal text, stance or target ID.

## Availability limitations and response

The bounded collector retains up to 100,000 events in this process. It resets on
restart. Warm-up and overflow label the window incomplete; values in an incomplete
window cannot prove compliance. Keep the existing single-writer topology; this is
not an aggregate across replicas. Process death and network outages cannot be
measured by an in-process request ratio. Pair with the independent `/healthz`
monitor in [launch-alerts.md](launch-alerts.md), whose target and delivery still
need operator confirmation. Do not treat a healthy process as proof of persistence.

The responsible maintainer must accept a dated shift and name an accepted backup
before operational acceptance. Proposed response: acknowledge any breached
10-minute window within five minutes; escalate to the accepted backup if missed.
Inspect the affected route, counts, blocked writes and deployed revision, then
read-only health and provider error evidence. Record impact and recovery time.
A block surge is a configuration/access signal, not permission to reopen writes
or weaken authorization. Deploys and rollback retain existing human release controls.

## Operator acceptance still required

1. Confirm origin, Fly app and deployed `/version` revision match the reviewed source.
2. On a disposable environment, generate successful, slow, real 500/503, paused
   write and client-network-failure samples; verify classifications and exact
   10-minute expiry. Verify content-free payloads in browser network inspection.
3. Verify desktop/mobile admin readability, real browser save reporting and an
   independent uptime probe. Verify restart/warm-up and missing-data states.
4. Configure approved external alert collection/routing for the same definitions,
   including a telemetry-missing alert. Prove breach and recovery delivery with
   disposable targets and record recipient acknowledgment. Do not send test
   messages or modify production records without separate authorization.
5. Record dated primary/backup acceptance and live dashboard/monitor evidence.

No release, deployment, production writes, notifications or governance changes
were performed for SHE-968. Required checks, human review, tagged human release,
disabled/dry-run merge policy and all stricter existing protections remain as
specified in [launch-merge-policy.md](launch-merge-policy.md).
