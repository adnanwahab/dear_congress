# Daily question editorial queue

The seven November 16–22, 2026 candidates in
`data/editorial/daily-questions.json` are fictional demo proposals. Each source
status was audited against the repository: institutional links provide background
only; no claim-level verification or source check date is available. Human
source/editorial review remains pending. These are not official eligibility
rules, endorsed proposals or representative results.

The date is America/Chicago, including daylight saving transitions. A scheduled
date without approval has no featured question. Outside the bounded schedule,
the previous explicitly fictional sample rotation remains available. Existing
midnight, deadline and tab-resume refresh handling remains in force.

## Review, revise and roll back

A human reviews the exact title, summary, source URL and source-status disclosure.
Record their real reviewer identity and ISO timestamp in the assignment's
`approval` object (`reviewer`, `reviewedAt`) through a reviewed code PR. Never
invent approval. Unknown revisions, duplicate date assignments, invalid/future
review timestamps, unavailable/expired payloads and changed proposal copy fail
closed. Review metadata in a repository file is an editorial record, not verified
GitHub authorization or a cryptographic human attestation.

Revision IDs are SHA-256 over UTF-8 `JSON.stringify(content)` with the existing
property order. Do not edit or remove archived revisions. Append revised content
with a new hash; human review must explicitly bind the date to that revision.
Tests verify hashes. The JSON file is the full versioned archive, also retained
in Git history. The card exposes scheduled revisions in a native disclosure.

To roll back, change only the affected date's revision reference to a retained
revision and record fresh human review for that assignment in a new reviewed PR.
Do not reset votes or change proposal IDs to implement rollback. If the retained
revision differs from current proposal copy, the card stays unavailable; reconcile
proposal copy through its own reviewed workflow. The question links reuse existing
proposal-bound advisory choices; editorial revisions do not create new ballots or
transfer saved choices. No editorial write API or production data migration exists.

This change does not enable deployment or automated merges. Governance remains
locked, disabled/dry-run by default, quorum 10, 24-hour exposure, current-head
review and fail-closed checks/base allowlists. Human maintainer approval and the
required checks remain necessary; production requires a human-published tagged
release. See `docs/launch-merge-policy.md`.
