# Launch distribution ledger

Repository: `adnanwahab/dear_congress`. Starting origin:
`https://civic-synthesis.fly.dev/` (confirm deployed revision before publication).

[ledger.csv](ledger.csv) is the public, manually reviewed source-channel ledger.
It currently has **no recorded approved publications**. This means evidence was
not supplied, not that no outreach occurred or that traffic was zero. There are
no real session or follow-through measurements in this ledger yet.

## Recording a publication

Use one stable `publication_id` per approved placement, not one per visitor.
Use channel `community_referral`, `educational_demo`, `social_preview`, or `media`.
Keep different communities, events, posts and articles in separate publications
with a public `source_label`. Do not infer channel from someone's political views.

Before publication, add a row with a unique `record_id`, `status=approved`, an
accepted owner, dated approval evidence, consent status/evidence, intended landing
URL and spend. Approval is a human decision; adding a CSV row grants no authority
to send outreach. Consent must cover the venue's distribution rules and permission
to name the owner/source publicly. Use `granted`, `not_required`, `pending`, or
`withdrawn`; `not_required` needs a documented rationale and reviewer. Pending or
withdrawn permission blocks publication. Keep private consent records in approved
restricted storage; public evidence is a redacted reference, never a contact list.

After authorized publication, append a `status=published` row with actual publish
time and public placement URL. Subsequent measurement/correction rows retain that
status and reference the previous row in `supersedes`. Use `paused` or `withdrawn`
when appropriate. Preserve earlier rows and stable IDs; never silently overwrite
results, approvals, spend or consent. A new placement gets a new publication ID.
Git history records who proposed and reviewed each update. Publication approval
does not substitute for PR review or acceptance.

## Column contract

| Columns | Required meaning |
| --- | --- |
| `record_id`, `supersedes`, `publication_id` | Unique row ID; prior row ID or blank on first row; stable placement ID. Corrections stay within the same publication. |
| `channel`, `source_label`, `status` | Channel enum above, public source name, lifecycle state above. No invented partner or endorsement. |
| `owner`, `approval_evidence` | Consenting accountable owner and dated human approval reference. No guessed assignments. |
| `consent_status`, `consent_evidence` | Permission state and dated, redacted evidence/rationale; record withdrawal promptly. |
| `published_at`, `publication_url`, `landing_url` | Actual ISO 8601 time with timezone, public placement evidence, exact approved HTTPS destination. Leave actual time/placement blank before publication. Never put secrets, personal identifiers or invite tokens in URLs. |
| `spend_amount`, `spend_currency`, `spend_evidence` | Nonnegative amount and ISO currency (e.g. USD), with dated cost source. Explicit `0` means confirmed no spend; blank means unknown. Distinguish committed from actual cost in limitations; never sum currencies directly. |
| `window_start`, `window_end` | ISO 8601 timestamps with timezone; measurement window is start-inclusive/end-exclusive. Blank when not measured. |
| `aggregate_sessions`, `session_definition` | Nonnegative integer only from a documented aggregate source. Specify timeout, attribution and bot/internal-traffic rules. Blank means unavailable, never zero by default. |
| `follow_through_count`, `follow_through_definition`, `denominator` | Count, exact observable action and unit/eligible denominator. State whether actions or sessions, deduplication and exclusions. Blank when unavailable. No stance-based success measure. |
| `measurement_source`, `measured_at` | Redacted aggregate report/reference, source revision/provider and extraction timestamp. Explain whether provider-reported or independently checked. No raw visitor records. |
| `limitations` | Required on every row: unknowns, coverage, consent gaps, attribution uncertainty, bot/preview/internal traffic, repeated visits, suppression and review needs. |

Use UTF-8 CSV with quoted fields for commas/newlines. Blank numerical fields mean
unknown or unavailable; explain which in limitations. Do not enter placeholder
rows into the real ledger. Do not publish spreadsheet formulas in text cells
(including leading `=`, `+`, `-`, or `@`); treat all imported text as untrusted.

## Honest measurement and readout

A visit is a page load; a session groups activity using a stated measurement
rule; a person is a human. None is interchangeable. Sessions can include bots,
repeat visits and multiple devices. Accounts and browser voting identities also
do not establish unique people. Preview fetches, fixtures, QA, simulations and
staff demos must be excluded where identifiable, with residual uncertainty stated.

Current `/api/page-view` and `/admin/stats` record normalized daily route views,
not sessions, referral channels or attributed follow-through. Query strings and
referrers are deliberately absent. Existing vote/journal counts cannot be joined
to source channels. Do not backfill attribution from timing, divide sitewide votes
by channel clicks, or relabel view counts as sessions. A tagged landing URL alone
does not create measurement. No new tracking or identity collection is enabled.

If an already authorized source supplies only clicks or impressions, describe
those units and evidence in limitations and leave sessions blank. New analytics
needs separate privacy/consent review; no fingerprinting, raw IPs, cross-site IDs,
journal text, ballots or political profiles belong in this ledger. Suppress small
cells that could reveal participation; leave the count blank and state suppression.

For each reporting window, select the latest non-superseded row per publication
and matching window. Do not add historical snapshots or overlapping windows.
Report channels separately, retain unattributed activity, and state when channels
overlap or methods differ. Never sum channel sessions into unique people. A rate
needs a compatible action/eligible-session denominator from the same source and
window; if that relationship is unavailable, report counts separately. Zero and
unknown must remain visibly different. Costs per follow-through need known actual
costs, compatible units and a nonzero denominator.

Prioritize the next experiment using evidenced useful follow-through, cost,
consent and limitations; low volume alone does not establish failure. No measured
results means no channel ranking yet. The aspirational user count is not evidence.

All copy must identify an **independent advisory beta, not election infrastructure**.
No official endorsement, invented participation, unsolicited outreach or targeting
by political stance. Withdrawal pauses future use; document corrections without
republishing private evidence. This ledger sends no messages and modifies no
production data. Human review and tagged-release policy remain in
[launch merge policy](../launch-merge-policy.md).
