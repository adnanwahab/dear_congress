# Human Flourishing draft catalog

The review candidate adds `/bills` and `/bills/HFL-001` through
`/bills/HFL-100`, including `/bills/HFL-051`. Published, Feed, Votes and the
navigation utilities link to it. Unknown IDs return HTTP 404. Search uses all
six fields, category, title and ID; whitespace-separated terms must all match.
`?q=HFL-051&category=Friendship%2C+community%2C+and+belonging` is shareable.
Filters intersect, and Clear / reset restores all 100 records. History entries
preserve each query/filter change. Native links preserve filters on detail entry
and return. All category buttons are keyboard controls with pressed state;
results announce their count and the empty state includes reset guidance.

## Editorial source and import

`content/bill-collections/eudaimonia-100.md` is reconstructed from the complete
SHE-386 source catalog in Linear, with its exact collection front matter.
No runtime generation or remote ingestion is used.

```sh
bun install --frozen-lockfile
bun scripts/import-eudaimonia.mjs content/bill-collections/eudaimonia-100.md --dry-run
bun scripts/import-eudaimonia.mjs content/bill-collections/eudaimonia-100.md --out src/generated/eudaimonia-100.json
bun test scripts/import-eudaimonia.test.mjs src/client/bill-catalog.test.tsx
bun run typecheck
bun test
bun run test:routes
```

The importer accepts a deliberately strict YAML scalar subset for the supplied
v1 schema. It rejects missing/unknown/duplicate metadata and fields, incorrect
IDs/category ranges, duplicate titles, invalid jurisdictions, HTML, Markdown
links/code, control characters, entity markup and length overflows. It checks
all 100 IDs and the ten named category ranges. Output is deterministic, with
no timestamps or network requests. Reimporting unchanged source produces the
same bytes and SHA-256 revisions. Changed text changes only that bill's digest.
The checked-in generated fixture test detects stale output.

Collection version 1 and stable HFL IDs are retained. A revision digest covers
ID, title, category, version and all six fields. Git retains earlier source and
artifact revisions. This is a read-only catalog, not a revision database or an
advisory publishing API. No votes or comments are stored in this artifact, so
reimport cannot delete them or move them to changed text. Any future publishing
implementation must retain immutable snapshots, obtain authorized review, and
bind ballots to both source kind and reviewed text revision. Catalog revision
digests do not include the separate legislative supplement.

## HFL-051 legislative supplement

`content/bill-details/HFL-051.md` is a separate, illustrative legislative
supplement authored for this implementation. It preserves the original catalog
entry and explicitly requires local authority, legal, fiscal and evidence review.
It supplies statutory-text sections, proposed funding scenarios, pro/con
arguments, safeguards and an evidence plan. No cost or impact is asserted.
It is bundled as text only when the lazy catalog screen loads.

`LegislativeMarkdown` intentionally supports headings, paragraphs and unordered
lists only. Text is escaped through React; HTML and link syntax are never
executed, and no source URL is fetched. Inline formatting is displayed literally.
Future expanded syntax should use an explicitly safe parser and new security
fixtures rather than HTML injection. Later supplements need an explicit source
mapping and review, not implicit runtime file discovery.

## Data separation and participation

Curated editorial drafts are independent of the illustrative engine seed,
`citizenProposals`, official legislation metadata and repository PR ballots.
They do not appear in their API responses or vote totals and do not enter
synthesis scoring. They have no sponsors, endorsements, votes, official status,
verified evidence or assessed cost. Detail pages say “Unknown until assessed”.
The catalog makes no API writes. “Prepare your own private civic proposal” opens
the existing guided workspace without copying catalog content or source identity.
No catalog voting link is enabled. Authorized, revision-aware advisory publication
is a prerequisite for any future participation transition.

## Validation and remaining human review

On this workspace, frozen installation and typecheck pass. Focused importer,
component/DOM, production-browser-build, server page, citizen proposal and
objection tests: 41 passed, including the category rejection fixture. These checks cover all catalog routes and sitemap
entries, unknown IDs, category ranges, deterministic hashes, security rejection,
search/filter/reset/URL restoration, expanded detail rendering and zero API writes.
DOM tests are not native keyboard or visual acceptance.

The full suite initially reported 454 passed / 25 failed; all failures were HTTP
fixtures whose server could not bind port 0 (`EADDRINUSE`) in this restricted
workspace. `bun run test:routes` stopped at the same startup failure, before
routing assertions. Those commands must pass on an unrestricted CI runner before
human acceptance. No server behavior or sandbox restrictions were weakened.

`tests/accessibility/bill-catalog.pw.ts` adds desktop/mobile/reduced-motion/high-
contrast/reflow browser coverage via the existing Playwright projects: keyboard
search access, cards, filter intersection, reset/history, deep link, no horizontal
overflow and axe checks. Run on a runner permitting local server binds:

```sh
cd tests/accessibility
npm install
npx playwright install chromium
npm test -- --grep 'catalog keyboard'
```

The attempted browser command here could not run because Playwright is not
installed in that separate package. Native browser, screen-reader, visual and
narrow-mobile verification remain pending. No screenshot attachment was available
on the Linear issue; the implementation follows the written dark UI requirements,
without claiming pixel matching against an unseen mockup.

## Launch and rollback

This is a local implementation candidate, not deployed or accepted work. Roll back
by reverting the catalog change as one unit (source/generated assets, lazy screen,
route metadata, navigation links and tests). No database migration or production
content mutation needs reversal. Never restore or reset resident data as part of
catalog rollback. Rebuild through the normal reviewed release process.

The existing governance defaults remain disabled/dry-run, quorum 10, 24-hour
exposure, one current-head approval, fail-closed base/check allowlists and active
kill switch. Browser responses remain separate from verified repository ballots.
No governance/auth/check/consent setting was changed. Required main checks are
`bun test`, `bun run typecheck` and `route smoke test`, with at least one human
approval enforced through actual GitHub protection. Agents do not merge, approve,
enable auto-merge, release or deploy. A human-published validated tagged release
is required for production; see `launch-merge-policy.md`. Leave SHE-386 open until
a human verifies acceptance.

## Optional fictional budget exercise

The catalog includes an opt-in budget shock sandbox, also available in workflow
screens and the active guided tour. Its invented tokens and protected minimums
have no relationship to catalog cost assessments or participation. Choices stay
in component memory and show tradeoff receipts; see
[the SHE-663 review](reviews/SHE-663.md) for validation limits.

## Human editorial gate (SHE-878)

`content/bill-collections/eudaimonia-100-reviews.json` is the review ledger: exactly
one record per stable HFL ID, pinned to the existing catalog SHA-256 and proposed
jurisdiction. All 100 records begin with author/editor unassigned, legal/evidence/
fiscal reviews pending and publication blocked. Source authorship is not verified;
unassigned is an explicit gap, not an invented person or an approval.

For each draft, a human maintainer follows this repeatable review path:

1. Identify the actual author and accountable human editor. Record their names or
   durable repository identities in `author` and `editor`; do not infer sponsorship.
2. Verify the proposed jurisdiction and exact source text. Reimport via the commands
   above after edits. Retain previous review evidence in Git; reset decisions to
   pending for changed text and pin the new digest only as part of renewed review.
3. Obtain independent legal/authority, evidence/uncertainty and fiscal reviews.
   Each decision uses `pending`, `changes_requested` or `approved`, with a named
   human `reviewer` and a durable `record` path or review URL documenting findings,
   sources, limitations and the exact digest. Unknown fiscal effects stay unknown.
4. The human editor records an explicit publication decision in `publication`
   using the same decision fields. Submit the ledger and review records for human
   PR review, then run the required checks. A self-entered name or passing check
   is not authenticated human approval; GitHub human review remains mandatory.

`src/shared/bill-editorial.ts` derives readiness and fails closed for missing or
ambiguous records, stale digests, jurisdiction changes, missing assignments,
incomplete reviews and decisions without a reviewer or review record. Tests
require complete ledger coverage. Detail pages expose assignments, review statuses,
current digest and blockers; cards always expose the blocked publish gate.
Review evidence is repository-managed, not a public write API.

Even a complete editorial record does **not** open advisory publication:
`advisoryPublicationAllowed` remains false. There is no catalog-to-ballot API.
Citizen submissions remain independently authored records; their API does not
import catalog provenance. Future catalog participation must introduce separately
authorized immutable snapshots and server-enforced source-kind/revision binding,
consume this gate and preserve prior votes/receipts. Never wire catalog records
straight into existing citizen, sample-engine, official-bill or repository ballots.
The HFL-051 supplement is excluded from the catalog digest and requires a separate
reviewed snapshot before any participation transition. Review completion does not
make a concept introduced legislation, verified evidence or a modeled outcome.
