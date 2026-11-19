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

## Sprint 8 — compatibility implementation and independent review order

The user explicitly authorized **compatibility repairs only** in App.tsx/server.ts.
This is not permission to mount the new policy workflow or accept dependencies.
All fixes continue existing PR #463; no independent Civic feature PR was created.

Implemented compatibility repairs:
- Preserve `/votes` master-detail index and 308 retirement of `/bills`; preserve
  exact query parameters in that redirect, checked by actual production route smoke.
- Restore the prior sample voting experience only for explicit `?proposal=...`,
  using existing WorkflowScreen. Catalog identities remain separate from samples.
- Restore existing BottomNavigation; measure its wrapped height to reserve space
  and keep controls reachable above it. Restore existing RealityLens in the newer
  headers and the catalog's existing search/category/atlas controls, sharing code.
- Correct actual measured color-contrast defects in the home, visual stories,
  constellation controls and county status. No axe rules or impact thresholds changed.
- Replace retired grid browser expectations with master-detail counts, keyboard
  selection, exact source-detail navigation, filtering, native history, reflow,
  no-write and axe coverage. Games still run on retained bill detail routes;
  moved discovery controls are tested at their real `/dashboard` entrypoint.
- Use exact links/region status locators where restoring navigation introduces
  legitimate second matches. Native type-ahead replaces platform-specific select
  Arrow-key assumptions while retaining real keyboard input, exact values/focus.
  A minimal macOS Chromium153 reproduction did not change native select values
  for ArrowDown/Enter; actual keyboard type-ahead worked. Preview-enabled synthesis
  tests allow only the existing exact `preview:true` POST; every civic write and
  committed synthesis request still fails their no-write assertion.

The first full repaired desktop diagnostic reached 79/82 PASS; its three remaining
cases were corrected (contrast specificity, keyboard case selection, explicit
budget slider boundaries). A later simultaneous full Bun/browser run had resource
contention, including a screenshot hook timeout. It is not a PASS receipt. Final
checks run sequentially with unchanged timeouts. Full five-project acceptance is
NOT PASS unless the final local or hosted receipt explicitly records completion.

### Seven-candidate decisions

| PR / owned implementation | Current source identity before this compatibility push | Specific independent reviewer decision |
| --- | --- | --- |
| #454 / review authorization | `f6d18880641a` on `mini/SHE-1026`, base main | First independent security review: persistent revocation, active token rotation and stale-process rejection, role removal, separate publisher, exact four-decision attestation, fail-closed publication, operator secrets/backup/rollback. New focused 7 tests / 232 assertions and full 964 tests PASS; hosted required checks PASS. Human approval NOT RUN. |
| #461 / persisted catalog ballots | `ea9f4c28fae0`, base `mini/SHE-1026` | Accept #454 first. Review existing real two-browser SQLite/restart/withdraw/retry/timeout receipt, exact revision/publication separation and historical records. Do not retarget or absorb parent review on behalf of a human. Dedicated hosted acceptance PASS; rerun required checks on the eventually accepted base. |
| #452 / isolated HELIOS workbench | `26959fcae11f`, base main | Review exact source/revision/round binding, public consent and privacy, no denominator inference and minority objections. Fresh 5 tests / 25 assertions PASS. UI fixtures do not prove objection persistence: integrator must use authenticated durable adapter responses; actual mounted persistence NOT RUN. |
| #453 / HELIOS service | `1dff9463ff3d`, base main | Review consent to public output and external processing, source/hash binding, unsupported/missing evidence, citation validation, model/version and human authority. Fresh 13 tests / 63 assertions PASS. Authenticated trusted-source route composition remains integrator-owned; no automatic human approval. |
| #460 / exact catalog and picker | `43f38ee4ce03`, base main | Review exact legal source/provenance, mapping identity, pinned software model/seeds and unsupported effects. Software mapping review does not establish legal applicability. Merged HBL fixture remains byte-identical, SHA-256 `1baf5434cd1f4d28107890e74ce0a06d3da6124617f3ca406e8935a90ef1bf2c`. |
| #462 / durable origin binding | `af043ed15ee3`, base `codex/civic-policy-demo-catalog` | Accept #460 first. Review immutable v1 baseline/v2 source and actual legal hashes, trusted persisted origin, publishing-browser ownership, public-transfer consent, recovery and separate v3 histories. Fresh catalog+origin 8 tests / 214 assertions PASS. Browser identity must come from the existing authenticated server boundary when mounted. |
| #463 / this compatibility repair | previous head `bfff656ce51a`, final head in PR checks | Review intended retired-index behavior, restored existing routes/navigation, equivalent browser coverage and actual axe repairs. Final required and broad receipts must bind the pushed head; earlier green required checks do not cover these new changes. |

All seven had zero submitted reviews at the refreshed audit. Existing #452/#453/
#460 broad runs and prior #463 broad run are CANCELLED with recorded failures;
#454's current broad run was still in progress at audit time. No all-CI-green claim.
Exact complete SHAs and check links are retained in the PR snapshots/updated workpads.

Dependency order: independent human review of #454 and compatibility #463; #461
only after accepted #454. Independently review #452/#453 and #460; #462 only after
accepted #460. A human must verify required checks on accepted integration heads.
Keep SHE-1032/SHE-1044 dispatch labels and dependency relations until their actual
acceptance. #452/#453 keep exclusive module ownership; this patch edits none of them.

First review-ready security candidate: #454. No new shared policy integration is
currently dispatchable. The first integration task after legitimate acceptance is
SHE-1032's designated owner mounting the existing PolicyDemoPicker callback into
the existing proposal save, invoking PolicyOriginStore create/prepare with trusted
browser identity and explicit public consent, then calling the existing server HBL
client and using its actual returned URL/lifecycle. Revisions must retain prior
previews and independent advisory histories. No new engine/editor/catalog/client.

Remote three-policy staging, native WebGPU per demo, production durability,
deployment and human acceptance remain NOT RUN. No production mutation occurred.

Final local evidence update before push: typecheck PASS; production route smoke
PASS. The full Bun suite was run at standard timeouts; resource-sensitive UI tests
(reality-lens and then the Map walkthrough) timed out on separate full attempts.
The isolated reality-lens recheck passed in 545ms. Retain these as FAIL receipts,
not a full-suite PASS; exact pushed-head hosted required checks must rerun.
The complete five-project browser attempt was interrupted after contention and
is NOT RUN to completion. Latest desktop diagnostic: 79/82 PASS before the last
three corrections; no broad accessibility PASS is asserted. New source and tests
must be evaluated by the existing broad CI job on this pushed revision.

Final three-case correction: scoped the synthesis test to the engine's actual
Synthesis settings section (another component has its own Annual budget slider),
fixed the shared hover cascade overriding constellation contrast, and contained
Tab/Shift+Tab at the mobile More dialog boundaries. Fresh isolated-server native
verification: all 6 desktop/mobile cases PASS (24.7s), unchanged axe/focus/value
assertions and timeouts. Full broad acceptance still requires a completed run at
the final pushed head. At prior cceb3ed all hosted required checks, dedicated
browser and immutable preview replay passed; broad job was still installing deps.

The reflow matrix additionally exposed fixed navigation intercepting a chapter
preview's Open-stage link at 720x500. Bound the preview using the measured
navigation height and place its controls above navigation. Original pointer and
keyboard/cancellation reflow cases PASS on a fresh server (2/2, 3.2s), with no
assertion/timeout change. All known failing classes have a concrete repair;
full final-head matrix verification remains mandatory.

Final route handoff investigation found two more actual defects, now repaired:
summary popovers used a fixed bottom offset and covered the link opening them;
and deferred history/data-load restoration could steal focus already claimed by
an incoming visitor. Position summary windows using measured navigation height,
and share guarded restoration between native BFCache and delayed workflow data.
Add the pre-pageshow claimed-focus regression. Navigation also refreshes its
selected-source query after the workflow canonicalizes the URL; native tests now
assert the same actual demo proposal ID across back/forward and draft stages.
Fresh isolated-server verification: all 18 native history/summary/navigation cases
PASS across desktop, mobile390 and reflow (19.5s). Focused history/navigation units:
8 PASS / 96 assertions. Typecheck and route smoke rerun after the test typing fix.
The earlier full diagnostic was 400 PASS / 10 FAIL; its failure records are kept,
not relabeled green. A fresh complete final-source matrix is required.
