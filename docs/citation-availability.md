# Curated citation availability

Sample proposal source panels distinguish link availability from editorial review.
No proposal, legal status, policy effect, measurement or official claim is verified
by this checker. Existing fictional samples and background-only scopes remain so.

An operator can probe one repository-curated sample citation locally:

```sh
bun scripts/check-citations.ts demo-housing 'Operator label' --probe
```

This prints an observation without writing it. After explicitly deciding to record
an availability validation, use `--record` instead. That command performs a new
check and appends the result to `data/citation-checks.json`. The operator label and
observation become public build inputs; use a public role label, never credentials
or private contact details. Review the diff before integration. The bundled empty
ledger means no checks have been recorded; installation/build/render never probes.
No production endpoint, background scheduler or arbitrary user URL fetch is added.

GET requests use a ten-second timeout, omit credentials, do not follow redirects,
and discard response bodies. Redirects are flagged for manual review without
replacing source identity or validating the destination. 4xx/5xx are recorded as
unavailable HTTP responses, not proof of permanent deletion; network/timeout errors
mean availability unknown. Some sites block automated requests. Even HTTP 200 can
be a soft error, login or unrelated page; it only means a response was received.
No source text, redirect location or provider error details are saved.

The latest appended observation matching both exact sample ID and original URL
is shown, including failures. A changed citation cannot inherit the old check.
Every check shows its attempt time; checks older than 30 days are flagged stale.
This is an editorial reminder, not a truth or provider-SLA threshold. Invalid or
future dates fail closed. Existing `background.checkedAt` remains a separate
editorial review date and is never set by this command. Stale, future, invalid and
missing editorial dates have explicit explanations in source inspection.

The ledger is bundled at build time; a reviewed change needs the ordinary human
release process to appear in production. This is operator-triggered checking,
not continuous monitoring. The citation-only evidence JSON export retains its
existing schema and does not export this separate availability ledger. No legal
or editorial verification workflow is introduced. Review source, safety and
editorial requirements before any release; this feature grants no deploy authority.
