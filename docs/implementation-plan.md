# Implementation plan

## SHE-251 — three-application repository voting

Implemented an integrated slice on `codex/she-251-repository-voting`: exact shared repository allowlist; six isolated item scopes; preserved HBL voting baseline; authenticated revision/priority ballots and durable feedback; URL-backed repository/item navigation; explicit unknown/disabled integration states. Required SHE-249 baseline inclusion was approved by the operator. Unrelated dashboard/map/simulation changes in the original checkout were preserved and excluded.

Acceptance evidence and final route/storage/setup contracts are in [repository-voting.md](repository-voting.md). Typecheck, all 165 application tests, 40 focused governance/route tests, and the Playwright browser matrix passed. Screenshots use labeled synthetic API fixtures. No production changes or live comments were made. Live OAuth/publication and SHE-252 companion state require independently configured credentials and operator evidence. Existing production configuration outage awaits deployment authorization.

Material decisions: retain legacy HBL PR table names and advisory community ballots, share only identity/roster tables across scopes, disable non-HBL merge policies and reject issues from merge eligibility, preserve cached items when later GitHub pages fail, and gate new repository comment delivery with an explicit publication allowlist. Future schema changes must update the explicit scoped identifier set and overlapping-number tests.
