# Repository voting — SHE-251

## SHE-279 launch advisory lock

The direct `/vote/happybearlandia` list and detail routes remain available to
testers as **Developer preview / not a binding vote**. Developer PR links are
removed from the main civic voting journey. Community policy proposals express
civic priorities; developer PR responses do not approve or merge code. A verified
maintainer must explicitly decide whether to merge in GitHub.

`src/server/hbl/pilot.ts` fixes `PR_AUTO_MERGE_ENABLED=false` in code. This is a
launch capability lock, not a new runtime opt-in. Environment values (including
`PR_AUTO_MERGE_ENABLED=true`) cannot override it. The signed batch endpoint checks
the lock through the worker kill switch, and `GitHubSource.merge` rejects direct
calls before any network request and rechecks immediately before mutation.
Existing `HBL_MERGE_ENABLED`, dry-run and kill-switch configuration is preserved
but cannot unlock this pilot. There is no GitHub approval mutation endpoint.

Public responses retain actual eligibility reasons and configured requirements,
while returning no PR merge schedule (`nextBatch:null`, omitted `earliestBatch`).
Blocked PRs say **Blocked**, with the base-branch reason. Five-minute community
summary publication is a separate, explicitly configured advisory-comment path;
it is not a merge schedule and its configuration is unchanged. No ballots,
receipts, roster, identities, revisions or stored records are migrated or reset.

Future binding operation requires a reviewed code change and explicit decisions
on named electorate, identity verification, quorum, allowed bases, human override
and explicit maintainer decision, and durable audit logs. Current defaults remain
quorum 10, 24-hour exposure, at least one current-head approval, strict yes
majority, empty base/check allowlists, protected-base evidence and all existing
checks. No one-vote rule is authorized. Broader SHE-249/SHE-251 work is deferred
beyond this launch gating slice.

This extends the existing SHE-249 voting implementation. The prerequisite voting UI/backend was previously uncommitted; the implementation PR includes it with operator approval. The independent local dashboard/map redesign and simulation edits are excluded. Original checkout and production are unchanged.

## Routes and API

Exact allowlist: Dear Congress (`adnanwahab/dear_congress`), HappyBearLandia (`adnanwahab/happybearlandia`), Digital Pensieve (`adnanwahab/digital_pensieve`). Repository keys are their exact trailing names.

- `/vote` preserves the existing civic voting screen; repository voting is available through direct tester links. `/vote/:repoKey?view=prs|issues` selects a list.
- `/vote/:repoKey/pr/:number` and `/vote/:repoKey/issue/:number` select details. Existing HBL PR links are preserved.
- `/api/hbl/repos/:repoKey/pulls` and `/api/hbl/repos/:repoKey/issues`, optionally followed by `/:number`, serve the selected source. Lists retain the additive `hbl-governance.v1` `pulls` array field for compatibility; `kind` identifies the actual item type. Issues are never PR merge candidates.
- `/:number/ballot` (PUT) and `/:number/feedback` (POST) use the existing authenticated approved-roster, origin, CSRF, input bounds and idempotency protections. Ballots bind PR head SHA and base. Issue priorities bind stable repository ID + issue number and survive description updates.
- `/api/hbl/pulls/...`, `/api/hbl/auth/...`, the existing batch and HBL webhook endpoints remain compatible. Existing browser community votes remain advisory and separate from verified ballots. New scopes require verified roster identity.

The selector always returns to the new repository's list. View is URL-backed; browser history, reload and direct links work. Each repo/kind/detail mounts its own request sequence, so responses from an old selection cannot overwrite the active one. Lists paginate locally in 20-row pages after fetching all GitHub pages, including drafts and excluding GitHub issue API entries with `pull_request`. Search covers title, number, author and labels. Partial pages retain cached entries and report incomplete counts; no missing-page result closes cached items. Failed initial fetches show an error rather than an empty list. Later failures retain explicitly stale cache.

## State isolation and preserved policy

All scopes use one SQLite file with shared `members`, `membership_revisions`, `sessions` and `oauth_states` tables: one global 100-approved-account roster. Item/cache/vote/comment/outbox/job/receipt/batch tables and indexes are scoped by repository key and kind through the store's SQL-identifier adapter. SQL string literals and parameters are unchanged. The legacy HBL PR scope keeps its existing table names, so existing saves require no destructive migration. Any new scope-specific table must be added to that explicit adapter set and isolation tests. Repository and kind are validated before constructing a namespace.

The existing HBL 9 a.m. America/Chicago PR policy, quorum, checks and approval requirements are retained. Other PR scopes are disabled/dry-run; issue scopes cannot merge at both API and eligibility levels. The GitHub source refuses merge calls for issues and non-HBL repositories. No new merge credentials, live approvals or deployment permissions are granted by adding dropdown entries. Community counts never enter the verified merge electorate.

Companion Symphony integration remains explicitly **not configured**. Body-provided GitHub/Linear evidence links are shown only through the trusted-host URL allowlist. No implementation/queue/blocker status is fabricated, and priority does not filter the companion intake. SHE-252 owns live companion evidence integration.

## Setup and operations

Run Bun with the existing durable single-writer volume. Production requires `HBL_SINGLE_WRITER=1`, `HBL_DB_PATH=/data/db.json.hbl.sqlite`, and `HBL_PUBLIC_ORIGIN=https://civic-synthesis.fly.dev`; these are recorded in `fly.toml`. These local declarations have not been applied to production. Keep one writer and back up the volume before deployment.

Public repository reads can run without a token; configure server-only `HBL_READ_TOKEN` for authenticated API limits. OAuth uses `HBL_OAUTH_CLIENT_ID` and `HBL_OAUTH_CLIENT_SECRET`; approve stable GitHub account IDs using `scripts/hbl-roster.ts`. Never use civic browser voter IDs as merge authority.

Public written feedback requires explicit submit and consent. Delivery uses the existing durable bot-comment reconciliation queue, with a 30-second wakeup independent of merge scheduling. Enable `HBL_PUBLISH_FEEDBACK=1`, a suitably scoped `HBL_COMMENT_TOKEN`, and numeric `HBL_BOT_USER_ID`. `HBL_FEEDBACK_REPOSITORIES` is an explicit comma-separated repository-key publication allowlist, defaulting to `happybearlandia`; new applications are not silently authorized for publication. Pending or failed receipts preserve saved feedback. A lost POST response is reconciled by exact bot-authored feedback marker before retrying. No individual vote or view switch creates a GitHub comment. HBL's separately configured aggregate summaries and companion intake keep their existing switches and scope.

## Executed verification

- `bun run typecheck`: passed.
- `bun test`: 165 passed, zero failed, 28 files, 97,954 assertions (4.26 seconds).
- Focused governance/route tests: 40 passed, including six scopes with overlapping #7, 100 approved accounts per scope, changed votes without duplicate voters, shared roster cap, restart retention, CSRF rejection, two GitHub pages, draft inclusion, issue/PR exclusion, partial/rate-limit responses and exact-repository public-comment retry reconciliation.
- `PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/playwright bun scripts/test-repository-voting.cjs`: passed on an isolated local Bun server at port 54431. Set `PLAYWRIGHT_MODULE` to an installed Playwright package or install Playwright locally. The script uses synthetic intercepted API contract fixtures, not live ballots or comments. It exercised all six list/detail routes, plain-text contributor rendering, selector-to-list, keyboard, refresh, back/forward, delayed obsolete responses, unavailable/empty/partial states, list pagination and a 390px mobile viewport without horizontal overflow or page errors.
- Screenshots: [desktop](evidence/she-251-desktop.png), [mobile](evidence/she-251-mobile.png). Both are synthetic contract-fixture captures of actual rendered UI, not live repository data.

No production deployment, live GitHub comment, merge, external issue mutation, roster change, or Symphony dispatch was performed. Production's previously diagnosed missing single-writer configuration still needs explicit deployment approval. Live OAuth, bot publication and companion integration require operator configuration and remain unverified.
