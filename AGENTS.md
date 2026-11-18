# Dear Congress repository instructions

Work only on this repository's requirements. Read readme.md and relevant module
docs before changes. Preserve source repository identities, repository/item-kind
isolation, PR head/base binding, existing votes, records and receipts.

## Launch review and merge policy

Agents may prepare branches and draft PRs. On launch day (2026-11-13), agents must
not merge, enable auto-merge, approve their own work, publish releases, or deploy.
A human maintainer reviews the current revision and explicitly decides to merge
after all required checks pass. A draft PR or successful agent process is only a
review candidate, not acceptance evidence. Do not bypass branch protections.

Analysis-only work belongs in docs/reviews/<ISSUE-ID>.md. Its PR title, body and
commit messages must use a plain `Refs: <issue URL>` reference, without issue
closing keywords. Leave the Linear issue open until a human verifies acceptance;
merging a review document does not establish implementation or acceptance. If
Linear closes all linked issues on merge, the integration must be configured by
its administrator before analysis PRs are merged.

## Mini Symphony parallel-PR hygiene

- `mini/*` and `symphony/*` feature workers must not edit shared `readme.md` or `src/client/public-guide.ts`. Put proposed copy/integration changes and actual acceptance in `docs/reviews/<ISSUE-ID>.md` for the integration coordinator.
- Reserve exact files and shared source interfaces before dispatch. When another active PR owns the same interface, park the ticket rather than producing duplicate conflicting changes.
- Do not commit generated screenshots, `.mini-symphony-evidence/`, `artifacts/` or `test-results/` output. Use trusted GitHub Actions artifacts tied to the exact tested head SHA, and preserve historical evidence before removing it from tracked branches.
- Follow [PR hygiene](docs/pr-hygiene.md). Existing approval, branch protection, merge and release policies remain authoritative.

Run bun test, bun run typecheck and bun run test:routes for changed behavior.
Required main checks are `bun test`, `bun run typecheck`, and `route smoke test`.
GitHub protection must require at least one human approval; repository files alone
do not activate branch protection. See docs/launch-merge-policy.md.

Preserve the configured governance policy. Do not enable live automated merges,
reduce quorum, weaken checks/auth, change production data or use advisory browser
votes as verified merge authority. A question about quorum one is not permission
to configure it. Production deploys require a human-published tagged release.
