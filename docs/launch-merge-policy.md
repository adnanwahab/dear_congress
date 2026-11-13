# Launch merge and release controls

Agents prepare draft PRs; a human maintainer reviews and merges. No agent merge,
auto-merge enablement, release publication or production deployment is authorized
on launch day, November 13, 2026. A successful process or merged analysis report
does not establish acceptance.

## GitHub administrator setup (still required)

After CI has run, protect `main` with these exact required check names from the
GitHub Actions app: `bun test`, `bun run typecheck`, `route smoke test`. Require
up-to-date branches and PR review with at least one approval, dismiss stale
approvals and require approval of the latest reviewable push. Human maintainers
must supply approval; bot reviews are not human acceptance. Enforce for admins,
disable force pushes/deletion and avoid agent/bot bypass actors. Preserve any
stricter existing settings or additional required checks. Do not replace an
unread protection object with a guessed configuration.

Verify with a disposable PR: failing and missing checks must block merging,
passing checks without human approval must block merging, and a new push must
invalidate prior review. Verify agent credentials cannot bypass protections or
write directly to main. No such live verification was performed for SHE-288.

Repository instructions do not control an external Mini Symphony merge loop.
Its operator must keep launch orchestration in draft-PR-only mode and disable
its direct merge path. Do not consider this active until the operator verifies
the running orchestrator configuration and branch protection.

## Linear and analysis-only PRs

Use a plain `Refs: <Linear issue URL>` in analysis-only PRs and commits. Avoid
closing keywords. Keep outstanding implementation and acceptance criteria in
the review document; leave the issue open. The PR template applies to future
manual PRs; an external PR generator may override it and must obey AGENTS.md.

If the Linear GitHub integration moves every linked issue to Done on merge,
its administrator must disable that transition for analysis PRs or avoid linking
them through the integration. This repository cannot configure Linear's workflow.
Previously closed SHE-270/271/278/279 need human triage; no issue state was changed.
Their inspected PR bodies already contained plain issue links and no closing
keywords. Therefore omitting keywords alone cannot be claimed to solve the
reported closures; verify the external integration/orchestrator transition rule.

## Tagged production releases (SHE-281 coordination)

Fly Deploy now proposes `release: published` only, for non-prerelease `v*` tags.
Main/master pushes, PRs, bare tag pushes and workflow dispatch do not deploy.
The validation job checks out the tag, requires its commit to be an ancestor of
main, and runs all three checks. Deployment checks out that exact validated SHA,
so moving the tag between jobs cannot select unvalidated code. Only the deploy
step receives the Fly secret. No release was published or deployment executed.
The deploy job additionally requires repository variable
`PRODUCTION_RELEASES_ENABLED=true`; leave it unset/false during launch recovery.
SHE-281 explicitly requires recovery of the deployed source and confirmation of
the Fly target before rollout. The current fly.toml targets `dear-congress`,
while that issue identifies the live app as `civic-synthesis`. No target was
changed here, and this work does not establish source alignment or live readiness.

A human release owner must coordinate the final release/tag naming and rollout
with SHE-281. Restrict release/tag publishing credentials and protect release tags
against replacement/deletion. These permissions and any Fly-side deployment paths
remain unverified. Existing Fly app/volume/data settings are unchanged.

## Preserved governance configuration

The merged baseline contains governance modules used by repository voting; this
work adds no HappyBearLandia product requirements or behavior changes. Defaults
remain disabled, dry-run, quorum 10, 24-hour exposure, one current-head approval,
empty base/check allowlists (fail closed), 9 AM America/Chicago, recovery at most
six hours. Strict yes majority, protected-base evidence, clean mergeability,
successful current-head checks, no blocking reviews/requested reviewers, and
maintainer approval for sensitive changes remain required. Main/master need
explicit production-base authorization. The kill switch defaults active.

Non-HBL PR scopes remain disabled/dry-run; issues never merge. Browser advisory
choices remain separate from verified GitHub membership/ballots. Shared roster
capacity 100, auth/CSRF, revision isolation and durable records are unchanged.
These are source defaults, not an assertion about production environment values.
