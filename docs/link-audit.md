# Public link audit (SHE-979)

Run `bun scripts/audit-links.ts`. The read-only weekly Monday 08:23 UTC workflow
also supports manual dispatch after human review and merge. It uploads JSON and
Markdown reports for 30 days, even on failure. No secrets or deployment permissions
are provided. GitHub scheduled execution requires the workflow on the default branch.

The queue seeds the public route inventory, all curated bill pages, the live
sitemap (including public proposal IDs), and explicit missing-ID probes. It walks
same-origin HTML anchors and sitemap locations. External requests are limited to
three reviewed outcome-source URLs in `src/server/link-audit.ts`; their bodies
are never traversed. Requests are serial, delayed 100 ms internally and 1500 ms
externally, with ten-second timeouts, no retries, no automatic redirects and a
400-target / 1500-queue / 2 MB response ceiling. Redirects require human review;
403/429 do not trigger retries or bypasses. Query-bearing discovered links, API
links and credentials are excluded. No writes, cookies or authentication are sent.

Each finding identifies an owning source module or referring page. These are
triage locations, not invented individual assignees. Maintainers review failures,
confirm a destination manually, and route fixes to that module's reviewer. Never
silently replace source provenance. Reports retain URLs/statuses only, not response
bodies, cookies, headers or raw exception messages. A nonzero exit covers bad
statuses, unexpected 200s on missing IDs, network failures, redirects and truncation.

Coverage limits: this HTTP crawler does not execute React, inspect client-only
card anchors, validate fragments, or detect arbitrary soft-error text inside a
200 page. Add reviewed sources explicitly as coverage expands. Existing browser
and route smoke checks complement this audit. The report is evidence for human
triage, not merge or release authorization.

Governance remains unchanged: disabled/dry-run merge defaults, active kill switch,
quorum 10, 24-hour exposure, current-head approval/checks and human review.
Production deployment still requires a human-published tagged release; see
[launch merge policy](launch-merge-policy.md). This workflow changes none of those
settings and does not establish that remote branch protections are active.
