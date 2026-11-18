# Human Flourishing draft catalog

## November 18, 2026: expanded editorial collection (v2)

The current catalog contains **110 unreviewed proposals** across 11 categories, HFL-001 through HFL-110. The existing collection ID and filenames `eudaimonia-100` remain as stable provenance identifiers for the original series; the collection title, version and date are updated to **110 Bills for Human Flourishing**, version 2, dated 2026-11-18. Do not interpret the old filename as a current count.

- Seven original entries were rewritten in-place, retaining their IDs but receiving new per-record SHA-256 revisions: HFL-021, HFL-038, HFL-049, HFL-071, HFL-075, HFL-085 and HFL-090. All other original 93 per-record revisions remain unchanged.
- HFL-101 through HFL-110 belong to a new tenth-bill category, **Global cooperation and future institutions**: Global Water and Sanitation Compact; Democratic Rights and Due Process Charter; Global Civic Deliberation Protocol; Public Law Version Control Act; Pandemic Early-Warning Commons; Open Science and Public Discovery Act; AI Safety and Human Control Compact; Climate Adaptation and Clean Energy Accord; Anti-Corruption and Public Asset Traceability Act; Peaceful Conflict Prevention and Displacement Protection Act.
- The catalog importer now enforces exactly 110 sequential IDs, 11 named categories with 10 records each, safe plain text, stable deterministic hashes and a narrow **international** proposal scope for prospective multilateral cooperation. International proposals **do not** presume a world legislature, a concluded treaty, domestic enactment or the authority to compel any country.
- The review ledger covers all 110 current revisions. All new and revised entries remain unassigned, legal/evidence/fiscal reviews are pending, and publication is blocked. Public advisory participation requires independent human review and an explicitly authorized, immutable revision-aware publication process.
- Each draft has a revision-pinned illustration. The law carousel, category filters, sitemap, route checks, screen labels and editorial provenance must include the ten new IDs without altering earlier votes, publications or receipts.

Before considering merge, run:
```sh
bun scripts/import-eudaimonia.mjs content/bill-collections/eudaimonia-100.md --dry-run
bun scripts/import-eudaimonia.mjs content/bill-collections/eudaimonia-100.md --out src/generated/eudaimonia-100.json
bun run visualizations:check
bun test
bun run typecheck
bun run test:routes
```

The implementation below documents the *original* 100-record introduction and its earlier acceptance history. Those historical results are not claimed as verification of the 110-record expansion.

The current public catalog index is `/votes`; the retired `/bills` index redirects
there. Individual `/bills/HFL-001` through `/bills/HFL-110` detail URLs remain
available for bookmarks and deep links. Unknown IDs return HTTP 404. Search uses all
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
artifact revisions. The source catalog remains immutable in Git while the product
direction supports revisioned discussion drafts as separate records tied to an
exact parent digest. Proposed changes must never overwrite source text. Any
approved revision should become a new immutable snapshot with a new digest. The
separate legislative supplement has its own source and revision identity.

The expert-review center described below is implemented in a separate SQLite
database. Database-backed amendment drafts are not yet implemented. A separate
revision-bound catalog ballot API and UI exist, but publication still consults
the source-controlled review ledger, not the new review database. The new
review-ready record does not publish a ballot.

## HFL-051 legislative supplement

`content/bill-details/HFL-051.md` is a separate, illustrative legislative
supplement authored for this implementation. It preserves the original catalog
entry and explicitly requires local authority, legal, fiscal and evidence review.
It supplies statutory-text sections, proposed funding scenarios, pro/con
arguments, safeguards and an evidence plan. No cost or impact is asserted.
It is bundled as text only when the lazy catalog screen loads.

`LegislativeMarkdown` intentionally supports headings, paragraphs and unordered
lists only. Text is escaped through React; HTML and link syntax are never
executed, and no source URL is fetched. Inline formatting is displayed literally. Recognized civic terms in paragraphs
and list items render as glossary buttons with labeled editorial examples; the
original supplement text and source identity remain unchanged.
Future expanded syntax should use an explicitly safe parser and new security
fixtures rather than HTML injection. Later supplements need an explicit source
mapping and review, not implicit runtime file discovery.

## Data separation and participation

Curated editorial drafts are independent of the illustrative engine seed,
`citizenProposals`, official legislation metadata and repository PR ballots.
Catalog amendment and ballot records must use separate storage and totals; they
must never be mixed with citizen-proposal or repository votes or synthesis scores.
The intended workflow is: save a private, owner-bound amendment draft; submit it
for moderation with explicit consent; obtain expert review; then publish an
approved, immutable revision for a separately identified advisory ballot.
Ballots must bind to the exact bill revision, accept an explicit support, oppose
or unsure choice, and require a fresh choice after every published revision.
Unreviewed drafts remain readable and labeled as discussion drafts. Reviewed
does not mean endorsed, enacted, independently validated, or officially sponsored.

The expert-review workflow and a separate exact-publication ballot API are
implemented. Amendment storage is still planned. The ballot publication gate
still uses the source-controlled editorial ledger; the database review-center
decisions are not yet connected to it, and no original catalog revision is
eligible for an advisory ballot. Detail pages must label evidence, costs,
jurisdiction, and review status accurately until authorized publication occurs.

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

## Legal-authority checklist (SHE-893)

Every detail includes read-only authority hypotheses, unresolved preemption and
rights questions, missing-source findings and an unassigned human reviewer/date.
Cards also label legal authority unverified. HFL-051 has facilities/grants-specific
prompts and explicitly separates its supplement from the catalog digest. These
are editorial questions, not source-backed legal conclusions. The original
catalog, IDs, revisions and supplement remain unchanged. No review workflow or
validity transition is implemented; nothing automatically becomes legally valid.
Future review records must bind exact text and supplement revisions and identify
a qualified human reviewer, sources, date, findings and remaining uncertainty.

## Human editorial gate (SHE-878)

`content/bill-collections/eudaimonia-100-reviews.json` is the review ledger: exactly
one record per stable HFL ID, pinned to the existing catalog SHA-256 and proposed
jurisdiction. All 100 records begin with author/editor unassigned, legal/evidence/
fiscal reviews pending and publication blocked. Source authorship is not verified;
unassigned is an explicit gap, not an invented person or an approval.

`src/shared/bill-editorial.ts` derives readiness and fails closed for missing or
ambiguous records, stale digests, jurisdiction changes, missing assignments,
incomplete reviews and decisions without a reviewer or review record. Detail pages
expose assignments, review statuses, current digest and blockers; cards always
expose the blocked publish gate. Review completion does not make a concept
introduced legislation, verified evidence or a modeled outcome.

## Expert review center and ballot integration status (November 18, 2026)

The `/review` workspace displays the original HFL concepts and accepts public evidence suggestions. Reviewer decisions are stored in a separate SQLite database with version-bound snapshots and role-limited bearer credentials; public suggestions never approve a proposal. See [review-center setup](catalog-review-center.md). All present concepts remain unreviewed unless an authorized human records a complete set of decisions. The 110-draft catalog remains a policy concept library, **not statutory law**.

The standalone catalog publication/ballot API now receives the exact SQLite review-center attestation, with independently authorized publication required to open the ballot. A review-center `review_ready` receipt does not itself open recorded voting. Only a separately authorized, immutable published revision can accept nonbinding advisory responses. Never set `advisoryPublicationAllowed` globally or transfer earlier votes to revised text.

## Governance prism (SHE-724)

Catalog detail and the Dashboard offer Cost, Law, Time and Lived impact lenses.
Topic sample links open the Dashboard with the same stable sample/topic IDs.
Catalog HFL identities never map implicitly to engine or official bill identities.
All four lenses currently lack reviewed evidence: each says Missing data. Law and
lived-impact panels optionally quote existing text as hypothetical draft context.
Catalog provenance retains collection/version and SHA-256 revision; sample panels
reuse ProposalProvenance, including its stale/unknown source check warning.
Background sources do not establish policy authority or effects.

Native buttons select or rotate lenses without moving focus. The `lens=0..3`
query and `prism=static` mode preserve existing search/category/proposal/topic
parameters; popstate restores the lens and Dashboard selection. Static mode hides
the decorative rotation only, retaining all navigation and selection controls.
Reduced motion disables rotation. There is no continuous rendering, polling or
GPU/canvas dependency in the prism itself. Existing search remains available.

Focused DOM tests exercise empty selection, all missing lenses, stale evidence,
static mode, focus and history notifications. The Playwright catalog suite adds
native back/forward, keyboard and reduced-motion checks; execution still requires
a runner allowing a local server. This is a review candidate, not acceptance.

## National policy atlas — SHE-725

`/bills?view=atlas` adds an optional static schematic of Census regions. It
uses no WebGL, external tile service, animation, geolocation, polling or new API.
The always-available text region and scope selectors share the search, category
filters, result cards, source IDs and revisions. Query parameters survive detail
entry and return and restore on popstate.

The Census geography source and check date are exposed next to the controls.
The checked-in membership covers 50 states plus DC; territories are not assigned
to a Census region. Geography checks expire after 30 days and future dates are
unavailable/stale. These dates never imply independent proposal evidence review.
The schematic is explicitly not to scale; Alaska/Hawaii are included in West.

No reviewed regional bindings exist for these editorial concepts. Region browsing
shows federal concepts as hypothetical national scope only. Generic state, city
and county labels never assign a concept to an actual locality: browse these in
All regions. Unknown regions fail closed. No map color, count or source reference
is regional voter support, legal applicability, enacted policy or evidence of an
outcome.

## Practical question exploration (SHE-728)

Each catalog detail offers five branching questions: who, cost, implementation,
legal basis and risk. Answers cite the existing HFL record, collection version and
revision and expose the exact relevant field through native details and field
anchors. They describe hypothetical intentions only. Fiscal cost and legal basis
remain unassessed; the dated editorial record is never labeled current verified
evidence. No external evidence or official-legislation identity is inferred.

The interface is static for every motion preference, using native search, buttons,
focusable answer headings, details and links. `question` is a shareable URL
parameter; selection preserves catalog filters and popstate restores selection.
Missing questions and text, empty search and unverified evidence have explicit
states. No network requests, storage writes, votes or participation transitions
are added.

## Topic neighborhood discovery (SHE-731)

The catalog and Dashboard link to `/topics`. Each topic hub includes a zoomable
neighborhood and equivalent static record list with search and selected-record
relationships. The graph is built exclusively from the existing topic hub payload:
need blocks, catalog-policy buildings and recorded sample-source streets. HFL IDs
and immutable revisions stay in the separate bill catalog; no HFL-to-need or
HFL-to-topic mapping is inferred.

`nq`, `node`, `view` and `zoom` query parameters preserve neighborhood state
without replacing the topic filter. Back/forward restores them. Reduced motion
forces the static list. The bounded deterministic layout has no animation, network
polling, geographic basemap or additional dependency.

The graph displays no journal prose, locations or participation counts. Source
nodes represent only eligible fictional repository samples. Their freshness is
explicitly unassessed; catalog goals and alternatives are illustrative/hypothetical.
Streets describe stored associations, not causation, public support or outcomes.


## Review-to-ballot integration (current implementation candidate)

Draft feedback may be saved to SQLite immediately for the current source revision, but is not a vote on a published ballot. Four role-authorized expert approvals plus a publisher's durable review-ready attestation are required before a publisher opens a separate, time-limited advisory ballot. The two types of participation remain isolated and previous choices do not transfer. HFL-051 retains an additional legislative-supplement review hold.
