# Public sample replay (SHE-321 first slice)

This working prototype reproduces a fabricated proposal tally and aggregate
component score through the public API and offline CLI. It is independent,
non-binding sample arithmetic, with no governmental authority. It neither
exports real participation nor reproduces a full synthesized package.

## Download and replay

In a checkout with dependencies installed (`bun install --frozen-lockfile`):

```sh
bun run audit:replay data/audit-samples/transit-v1.json 1f7e69e237537e7ccd80cc4e5431b3aadad7778a521c7ef22cac0edafe39a480
```

Expected report: `total: 100`, `changeCost: 0.083`, `score: 0.599`,
`verification: reproduced-sample-arithmetic`, `signature: unsigned`.
The fabricated processing time is `2026-11-13T00:00:00.000Z`; it is not a live
build, publication time or data cutoff. No credentials or network are used by
the replay command. Replay exits nonzero for invalid or inconsistent input.

For the local running application (`bun dev`), discover the bundle using
`GET /api/audit-samples`. Download the `url` in its `samples` array:
`GET /api/audit-samples/1f7e69e237537e7ccd80cc4e5431b3aadad7778a521c7ef22cac0edafe39a480`.
Save the response as JSON and pass that file to the same command. Each API
sample report binds its result to this ID and processing timestamp. Unknown IDs
return 404. The routes retain the existing public API security boundary,
including anonymous cookies and no-store headers; cookie data is not in bundles.
These endpoints have not been deployed by this work.

Retain the ID independently, for example from a reviewed checkout. The CLI
requires that expected ID rather than trusting an ID supplied only inside an
untrusted bundle. A digest establishes content identity, not publisher identity,
honest collection, participant eligibility or official source authenticity.
The sample is unsigned and has no official-source fingerprints. The report
states these limits. Recomputed attacker hashes are not a trust anchor.

## Format and arithmetic

`dear-congress-audit-sample.v1` allows exactly the documented fixture fields.
The source identity is `adnanwahab/dear_congress`; kind is
`fabricated-civic-proposal`, isolated from repository PR/issue ballots and real
citizen advisory responses. The proposal ID, version and wording are fixed for
this prototype. Counts and other components are wholly fabricated literals.
There is no function that accepts operational DBs, journals or user proposals
for export. Unknown/nested extra fields, missing inputs, suppressed inputs,
unknown rules/source/version, invalid dates, non-finite/out-of-range numbers,
fractional counts, wrong expected results and digest mismatches fail closed.
Errors do not print input data.

The snapshot ID is SHA-256 of canonical UTF-8 **payload** bytes, excluding the
outer ID wrapper and trailing newline. This local canonical JSON subset sorts
object keys, preserves array order, uses ECMAScript JSON string/finite-number
serialization and omits whitespace. It does not claim RFC 8785 compliance.
Hashing the downloaded file directly gives a different digest. The canonical
server response is the entire `{payload,snapshotId}` object plus one newline.

`aggregate-score.v1` shares `src/engine/aggregate-score.ts` with synthesis.
Support is support / (support + oppose + unsure), rounded to three decimals;
empty tally support is zero. Other score components are frozen sample inputs,
not reconstructed from personal data. Component weights are summed (zero sum
uses divisor 1). Weighted component values are summed in order support, welfare,
fairness, feasibility, reversibility, evidence and divided by weight sum.
The change penalty is `lambda * changeLevel / 6`, rounded to three decimals.
Subtract it and round the result to three decimals using JavaScript Math.round.
The sample uses the existing six engine weights. Derivation of demand, fairness,
other components, rights exclusions, budget selection, synthetic priors and
stability state are outside this replay's scope. A matching score does not
establish a matching selection or an empirical forecast.

For an integrity check, rerun the command against retained public bytes and
compare with the independently retained ID. Automated tests also replay the
checked-in sample, exercise the CLI, verify rejection paths and compare the
shared helper against the engine's previous scoring formula across catalog
proposals and weight configurations. This is an on-demand check, not a daily
completeness monitor or an independently operated audit service.

## Remaining acceptance and operational gates

SHE-321 remains open. Full acceptance still requires reviewed privacy thresholds
and protection from complementary/cross-release differencing; proposal text
review; consistent real/synthetic provenance (SHE-271); trusted build identity
(SHE-300); complete scoring/explanation inputs (SHE-309); daily sanitized capture
and append-only durable storage; correction events and retained earlier claims;
signed manifests with independent trusted keys and rotation; archived official
source bytes; full-package offline replay; per-result bindings across `/votes`,
`/synth`, `/outcomes`, exports and API; periodic completeness/integrity jobs and
incident ownership. This sample API does not label those live results with an
unrelated sample ID. Preserve old sample bytes/IDs when adding future fixtures;
this prototype is not a durable append-only archive or a correction publisher.

Human reviewers must still run the real route checks in an environment permitting
listeners, independently reproduce the sample, review source provenance and test
mobile, keyboard and screen-reader provenance flows once UI bindings exist.
No new browser UI is introduced in this slice. No production data, votes, receipts,
authentication, merge eligibility or governance settings are modified. Existing
configured policy remains as documented in `launch-merge-policy.md`: disabled,
dry-run, quorum 10, 24-hour exposure, current-head approval and fail-closed
base/check allowlists. Required checks and human review remain mandatory;
production requires a human-published tagged release. No deploy or merge is
part of this implementation.
