# SHE-1032 — Sprint 7 compatibility and human review handoff

Refs: https://linear.app/shel-bernstein/issue/SHE-1032

Audited 2026-11-18 against main `e9483fc802484d12cd6374f8e6fcdef5c51135d7`.
This patch fixes actual main accessibility defects, without mounting the gated policy workflow.
No dependency acceptance, merge, deployment or production write is authorized by this report.

## Review matrix

| Candidate | Exact head | Base | Current hosted checks | Remaining human/integration gate |
| --- | --- | --- | --- | --- |
| [#454](https://github.com/adnanwahab/dear_congress/pull/454) / SHE-1026 | `0ed32b53400ec53443193ee7f6ce4edb4c5af561` | `main` | bun test: SUCCESS; immutable Civic preview replay: SUCCESS; route smoke test: SUCCESS; accessibility acceptance evidence: CANCELLED; bun run typecheck: SUCCESS | revocation survives restart; human authorization review |
| [#461](https://github.com/adnanwahab/dear_congress/pull/461) / SHE-1031 | `ea9f4c28fae0891f6930e25db8bfc92b3dd821d0` | `mini/SHE-1026` | acceptance: SUCCESS | SQLite restart/browser evidence; accept parent #454 first |
| [#452](https://github.com/adnanwahab/dear_congress/pull/452) / SHE-1028 | `26959fcae11f8dbf29279ce29c04313e8bef8054` | `main` | bun test: SUCCESS; route smoke test: SUCCESS; accessibility acceptance evidence: CANCELLED; bun run typecheck: SUCCESS | revision/privacy UI tests; human accessibility and adapter review |
| [#453](https://github.com/adnanwahab/dear_congress/pull/453) / SHE-1027 | `1dff9463ff3d6b264e993bdf326c7d6ad71b23a6` | `main` | bun test: SUCCESS; route smoke test: SUCCESS; accessibility acceptance evidence: CANCELLED; bun run typecheck: SUCCESS | consent/citation/isolation tests; trusted lookup and semantic review |
| [#460](https://github.com/adnanwahab/dear_congress/pull/460) / SHE-1044 | `43f38ee4ce03bf8a02c43795138eb6052cf7eabf` | `main` | bun run typecheck: SUCCESS; accessibility acceptance evidence: CANCELLED; bun test: SUCCESS; immutable Civic preview replay: SUCCESS; route smoke test: SUCCESS | exact handoff/catalog/picker tests; human source/mapping review |
| [#462](https://github.com/adnanwahab/dear_congress/pull/462) / SHE-1032 | `af043ed15ee3edda46f2611ba81706f65ec78106` | `codex/civic-policy-demo-catalog` | binding: SUCCESS | restart/forgery/v2-v3 tests; accept parent #460 first |

#461 and #462 have only their dedicated checks reported on their stacked branches;
parent required checks do not establish required-check coverage for their combined merge result.
Rerun all required checks after human-accepted parents are integrated and before advancing.
Required main check names: `bun test`, `bun run typecheck`, `route smoke test`.

## Accessibility findings and scope

The cancelled #460 run 44402464746, job 135148848696 retained actual browser failures,
not just an installation cancellation. Artifact 14473144604 contains 46 error contexts.
Its catalog trace expects 110 `.bill-grid article` elements but receives zero after
`/bills` responds 308 to `/votes`. `docs/bill-catalog.md` explicitly retires the index;
restoring the old route would conflict with current design. The legacy grid assertion
requires a deliberate product/test-contract reconciliation. Existing assertions remain intact.
Installation also consumed 9m40s downloading browser system dependencies; this explains
part of the cancelled job budget but does not excuse the recorded assertion failures.
#454's broad job likewise records failures before cancellation. Neither broad suite is PASS.

Main already contains both the role-less named `.tl-marker` spans and the master-detail
catalog without a main h1. These paths are outside #454 and #460's changed files;
they predate those candidates. This patch gives named noninteractive markers `role=img`
and adds exactly one h1 in selected/empty catalog states, retaining existing typography.
Native browser tests check the current catalog route and the prohibited ARIA rule in all
five existing projects; existing legacy test files and thresholds are unchanged.

The `/bills` redirect also drops query filters. NOT FIXED here: refreshed SHE-1032
reservation explicitly owns server.ts exclusively. Owner's narrow future correction is
constructing `/votes` plus `url.search`, with manual-redirect status/location tests.
No server.ts, App.tsx, policy-preview route or proposal-save integration edits remain.
Open #446 and several older PRs overlap BillCatalog; this patch changes only its two
heading tags and corresponding selectors. Reviewers must reconcile those lines when integrating.
The visual-story marker change has no open-PR file overlap in the audited inventory.

## Identity and dispatch readiness

Reuse #460 PolicyDemoPicker's callback and #462 PolicyOriginStore create/prepare APIs;
never treat its old process-local catalog capability as restart-safe authorization.
The adapter binds exact template/handoff provenance and immutable saved Civic versions,
recomputes legal hashes and checks publisher ownership, public state and transfer consent.
Its explicit v1 illustrative baseline remains separate from exact template v2; changed v3
is Not Modeled unless independently reviewed. Preserve old preview payloads and separate ballots.
The canonical existing authenticated HBL client remains the sole remote client.

HBL #563 merged as `1715fc6291a933f00ab375f04bef88ef1d01f306` from
`bf08f457188e38a277d744c236dfba9fc0b02731`. The main handoff fetched during this audit
is byte-identical to Civic’s committed fixture: SHA-256
`1baf5434cd1f4d28107890e74ce0a06d3da6124617f3ca406e8935a90ef1bf2c`.
Retain that candidate provenance; do not invent new source identities. No production preview URLs are supplied.

SHE-1032 remains Backlog with review-before-dispatch labels and blockers SHE-1031,
SHE-1028, SHE-1029 and SHE-1027 (SHE-1029 implementation already Done). Do not remove
relations simply to dispatch. #454 before #461; #460 before #462. Human acceptance remains
pending for all six reviewed candidates. Next dependency-ready action: human review of
#454/#452/#453/#460 and this compatibility patch, then their stacked children at current heads.
Only after acceptance may SHE-1032's sole integration owner mount the existing picker,
persisted adapter and authenticated preview client in the existing save/impact flow.

Real remote three-policy save → preview → 0/12/24 checkpoints → revise → reload old
preview: NOT RUN; no approved HBL staging target/credentials. Native WebGPU per-demo,
production restart/storage durability and deployment: NOT RUN. No model result is a
real-world forecast or completed legal review.

## Local verification

Typecheck PASS; route smoke PASS. Targeted Playwright PASS (10/10 across desktop,
mobile, reduced motion, high contrast and reflow), using installed Chromium build 1243
through a temporary local config. Pinned build 1194 installation stalled with an incomplete
framework; the version-matching hosted browser run remains required. Local tracing was
disabled only in that temporary config; committed assertions/config thresholds remain intact.
The first new test mistakenly used a source asset URL; corrected to actual `/visual-lab/latency`.

Full-suite intermediate result: 983/984 passed with motion source-scanner timeout.
Installing nested Playwright dependencies exposes third-party minified CSS to its global
glob; generated reports have the same issue. Moved temporary browser dependencies/reports
outside checkout before final required-suite rerun. An intermittent behavior-explorer failure
passed independently. No test assertions, production code or timeouts changed for these.
Broad accessibility remains unresolved; the full legacy suite is not claimed green.

Final local required suite: PASS, 984 tests / 0 failures / 140770 assertions (32.41s).
Final typecheck and route smoke: PASS. Dedicated hosted browser workflow added;
its result must be reviewed separately at the pushed head.

First hosted browser attempt failed before tests: ubuntu-latest resolved to Ubuntu26.04,
unsupported by pinned Playwright1.56.1. Dedicated workflow now pins Ubuntu24.04;
no assertion, dependency or timeout was weakened. Exact new-head rerun required.
