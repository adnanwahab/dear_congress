# January 1, 2027 launch readiness

Target: January 1, 2027. Current release: a daily demo, not a million-user production system.

## What this release supports

- Twelve clearly fictional civic proposals across eight topics, with official background references.
- Search, topic filtering, single-voter advisory votes persisted on the Fly volume, and draft downloads.
- A sponsor workflow saved in the viewer's browser, with explicitly simulated replies and outcomes. No external messages are sent.
- A small dashboard endpoint with cached aggregate counts, avoiding the simulation engine and public journal payload.
- Serialized atomic database writes, vote validation before mutation, and Fly HTTP health checks.
- One warm Fly machine for a predictable daily demo. Existing data is retained. Mock scenarios do not overwrite user journals.

## Capacity contract to settle before sizing infrastructure

“One million users” means registered accounts, monthly active users, or simultaneous visitors? Model all three independently. A preliminary planning workload is one million registered accounts, 100,000 daily active users, 10,000 peak concurrent sessions, 1,000 read requests/second, and 100 write requests/second. These are assumptions, not measured capacity or commitments. Confirm geography, retention, uptime expectations, and spend limits.

## Remaining production gates

| Date | Deliverable | Evidence needed |
| --- | --- | --- |
| Nov 19 | Durable shared data and recovery | Move journals, users, votes, and drafts into managed Postgres; unique voter/proposal constraints; transactions; migration rehearsal; tested backup restore. |
| Nov 26 | Identity and abuse protection | Verified sessions, authorization for each mutation, CSRF strategy, rate limits, request validation, privacy review, and audit records. Browser IDs are currently unverified and spoofable. |
| Dec 3 | Stateless request path | Paginated feeds; precomputed aggregate votes and need scores; cache invalidation; asynchronous synthesis and source ingestion with bounded queues. Keep CPU-intensive simulation off request workers. |
| Dec 10 | Operational safety | Metrics and alerts, error tracking, deployment rollback, retention controls, restore drill, and independent staging/demo data. Global reset is now admin-only; complete authorization for all other mutations. |
| Dec 17 | Representative load test | Exercise authenticated reads and writes using realistic account and record cardinality. Verify no vote loss or double counts, bounded queue depth, database utilization and stable memory. |
| Dec 24 | Launch rehearsal | Recovery and failover drill, accessibility and mobile review, documented ownership and response procedures. Freeze high-risk changes. |
| Jan 1 | Launch gate | Sign off on measured capacity, authentication, privacy, recovery, and incident response. A passing demo is not this signoff. |

Suggested acceptance targets for the agreed workload: p95 read latency below 300 ms and p95 write latency below 500 ms at the origin, error rate below 0.1%, no data loss or duplicate votes, a one-hour peak soak plus a two-times-peak burst. Validate the targets with stakeholders; do not advertise them before measurement.

## Current boundaries

The application still holds the full database in memory and rewrites a JSON snapshot after writes. Atomic rename protects against partially written files, but does not provide database transactions, multi-machine coordination, or memory rollback after a disk error. Keep one writer machine until the database migration is complete. A volume is not a backup. A second independent machine with its own JSON file would split state.

The legacy journal/needs/synthesis screens still use prototype endpoints and compute simulation state on demand. The demo dashboard is isolated from those expensive requests, but legacy endpoints are not ready for public scale. Sponsor cards are browser-local. Their workflow is a demonstration, not a shared outreach system. Official background links are not proof that a fictional sample clause exists in law.

## Daily demo checklist

1. Check `/healthz` and Fly service checks, then open the dashboard.
2. Search a proposal, filter a topic, vote, change the vote, and refresh to verify persistence.
3. Prepare a sponsor draft, download it, move a tracker card, and refresh. Explain that sponsor progress is simulated and browser-local.
4. Walk through journal → shared needs → synthesis using sample content, without real personal information.
5. Record what worked, failures, and the next release. Run typecheck and tests before deploying; smoke-test production afterward.

## Deployment

Run `bun run typecheck`, `bun test`, `fly config validate`, and `fly deploy --remote-only --app civic-synthesis`. Check `fly checks list --app civic-synthesis` and production `/healthz` plus `/api/demo`. Do not increase writer replicas until shared storage is in place. The always-on machine trades idle savings for predictable demo availability.

References: [Fly configuration](https://fly.io/docs/reference/configuration/), [Fly health checks](https://fly.io/docs/reference/health-checks/).
