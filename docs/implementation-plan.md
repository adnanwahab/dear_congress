# Implementation plan

## SHE-251 — three-application repository voting

Implemented an integrated slice on `codex/she-251-repository-voting`: exact shared repository allowlist; six isolated item scopes; preserved HBL voting baseline; authenticated revision/priority ballots and durable feedback; URL-backed repository/item navigation; explicit unknown/disabled integration states. Required SHE-249 baseline inclusion was approved by the operator. Unrelated dashboard/map/simulation changes in the original checkout were preserved and excluded.

Acceptance evidence and final route/storage/setup contracts are in [repository-voting.md](repository-voting.md). Typecheck, all 165 application tests, 40 focused governance/route tests, and the Playwright browser matrix passed. Screenshots use labeled synthetic API fixtures. No production changes or live comments were made. Live OAuth/publication and SHE-252 companion state require independently configured credentials and operator evidence. Existing production configuration outage awaits deployment authorization.

Material decisions: retain legacy HBL PR table names and advisory community ballots, share only identity/roster tables across scopes, disable non-HBL merge policies and reject issues from merge eligibility, preserve cached items when later GitHub pages fail, and gate new repository comment delivery with an explicit publication allowlist. Future schema changes must update the explicit scoped identifier set and overlapping-number tests.

Delivery: implementation commit `a766380`; [draft PR #1](https://github.com/adnanwahab/dear_congress/pull/1) targets `main`. Production remains unchanged.

## Civic launch — November 14, 2026

Next integrated slice implemented: `/synth` direct reviewed-policy action →
structured local amendment recipe → bounded actual HBL request → native paired
checkpoints/actor inspector → safe reciprocal/reproducible context. Advanced
package controls remain available but collapsed. Existing voting, journal,
governance, authentication and receipt-v1 interfaces are preserved.

Acceptance: 100%/50% law-83 requests must preserve seed/baseline; inputs invalidate
prior outputs; malformed/unmatched/version-mismatched records fail visibly;
45-second deadline/cancel/retry prevent permanent loading; same actor IDs and
recorded time are inspectable; only allowlisted public context travels in links.
See `live-law-behavior-loop.md` and `scripts/verify-law-launch-browser.mjs`.

Browser QA also found inherited literal merge markers/duplicate entries in the
HTML shell, a duplicate loading header transition identity, hidden navigation
URLs throwing during optional transitions, and missing HBL origin in the CSP.
These are corrected with focused regression coverage. Production identity,
tagged release, staging/rollback and human deployment approval remain gates.
The structured recipe is a local synthetic discussion draft; saving an actual
civic proposal still uses the existing proposal editor and authorization flow.
