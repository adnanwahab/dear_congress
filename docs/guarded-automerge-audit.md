# Guarded PR audit evidence

The guarded workflow's eligibility check requires both GitHub's explicit
`APPROVED` decision and a submitted approval of the exact current head commit by
someone other than the PR author. The reviewer must be a non-bot GitHub user
whose repository permission is verified through GitHub as `write`, `maintain`, or
`admin`. Read/triage access, unavailable permission evidence, stale approval,
unknown review state and incomplete review data fail closed. The complete review
list is paginated; the latest substantive review per reviewer determines whether
an approval is still valid. An outstanding change request blocks the candidate,
even when it refers to a previous commit. Comments do not erase that request.
Requested reviewers or teams also block the candidate.

Approval and permission evidence is fetched again after CI inspection, alongside
a fresh PR head, base, labels and mergeability check. Required GitHub Actions
checks must identify that exact head SHA; incomplete check/status lists block.
The target main branch must have explicit protected-branch metadata; missing,
unreadable or false protection evidence blocks, and is rechecked before PUT.
Existing sensitive-path and analysis-only exclusions remain in place. The merge
request retains GitHub's exact-head `sha` precondition, and branch protections
must still enforce the repository's human review policy against concurrent
changes. This audit is not a replacement for those protections.

No checkout, PR code, dependency installation or PR-provided script executes in
the token-bearing workflow. Successful completions of the repository's `CI`
workflow also trigger an audit of current open PRs. The completion payload is
never used as checkout code or merge authority: every head, approval, permission,
protection and CI check is read again from GitHub. Scheduled/manual/PR-triggered
audits retain the same policy. No repository setting is changed.
It does not enable disabled integrations or authorize deployment, governance
changes, issue acceptance, or release publication. See the existing
[launch merge and release policy](launch-merge-policy.md).

Each completed audit emits machine-readable JSON with `audit`, `audited`,
`skipped`, `merged`, `errors` and `outcome`. An Actions step summary uses the same
counters. `audit: succeeded` with `merged: 0` means the inspection completed and
no PR merged. Only GitHub's literal `merged: true` response with a valid merge
commit SHA increments the merge count. A rejected or malformed merge response
fails the audit and reports zero confirmed merges. Neither a merge nor a green
audit establishes issue acceptance.

`bun test scripts/tests/guarded-automerge.test.ts` extracts the actual inline
policy functions and exercises the complete workflow script with a mock GitHub
transport. Coverage includes absent, stale, bot and non-maintainer approval;
changed heads and changed approval during audit; incomplete evidence; sensitive
paths; wrong-head/missing CI; merge response rejection; the SHA merge fence; and
separate audit/merge outcomes. These are local regression checks, not evidence
that GitHub branch protections or any live merge path have been verified.
