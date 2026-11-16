# Citizen proposals and advisory voting

This feature connects a person's own policy idea to a published proposal, public discussion, and advisory voting.

## User flow

1. Open `/votes` or `/feed` and choose **＋ Propose a law**.
2. Enter a title, the problem, the proposed change, and a jurisdiction. **Not sure** is a valid jurisdiction. A place name and supporting information are optional.
3. **Save draft** stores the draft in the current browser. It is not published or sent to the server. Drafts can be reopened from the proposal form.
4. Confirm the content can be public and choose **Publish for advisory voting**.
5. The server saves a permanent proposal at `/proposals/:id`. It appears in the feed and voting list with zero initial responses.
6. Visitors can support, oppose, choose **Not sure**, change or remove their response, and post a public comment.

Journal entries also offer **Turn this into a proposal**. This opens `/proposals/new?fromJournal=:entryId`, prefills the problem from the public journal, and retains the source entry ID. The person reviews and supplies the proposed rule before publishing. Conversion never casts a vote or publishes automatically.

## Meaning of a response

Responses are advisory and tracked by a server-issued anonymous browser cookie. They are not authenticated resident identities, verified turnout, a representative poll, or a legislative decision. Creating a proposal does not cast a response for its author. Citizen proposal responses never include simulated residents or the existing synthesis engine's illustrative support scores.

## Routes and integration

The new UI is isolated in `src/client/CitizenProposals.tsx`, with scoped styles in `src/client/citizen-proposals.css`. `App.tsx` selects it for `/votes`, `/feed`, `/proposals/new`, and `/proposals/:id`. Existing journal, needs, simulation voting, and synthesis views remain accessible.

The API uses the shared contract in `src/shared/citizen-proposals.ts`:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/citizen-proposals` | List published proposals and response totals |
| POST | `/api/citizen-proposals` | Publish a reviewed proposal |
| GET | `/api/citizen-proposals/:id` | Read a proposal, discussion, and this browser's response |
| POST | `/api/citizen-proposals/:id/vote` | Set or remove this browser's response |
| POST | `/api/citizen-proposals/:id/comments` | Post a public discussion comment |
| GET | `/api/citizen-proposals/journal/:id` | Read a public journal entry for draft prefill |

HTTP requests use a server-issued signed anonymous cookie; client-supplied `x-voter-id` is ignored. Non-browser clients must retain a cookie jar. See the public-write security section in `readme.md` for limits, deployment configuration, and legacy-ID behavior. Read responses do not disclose voter identifiers, ownership hashes, or idempotency keys. Responses use `Cache-Control: no-store` because `ownVote` is browser-specific.

Publishing requires `title`, `problem`, `proposedChange`, `jurisdiction`, a stable UUID `idempotencyKey`, and `confirmedPublic: true`. Optional fields are `jurisdictionName`, `supportingInfo`, and `sourceEntryId`. Jurisdictions are `city`, `county`, `state`, `federal`, and `unsure`. Vote bodies are `{ "choice": "support" }`, `oppose`, `unsure`, or `null` to remove the response. Comment bodies contain `text`, an optional `displayName`, and their own stable UUID `idempotencyKey`.

Publication and comment retries reuse their key. The same key and normalized content return the existing result; the same key with different content returns HTTP 409. Invalid input returns a useful 400 response, missing records return 404, and oversized requests return 413. Each response includes only the fields intended for the public UI.

## Persistence

Published proposals, discussion, and browser responses are stored in the existing JSON database through the optional `citizenProposals` field. Existing databases require no destructive migration. Database saves are serialized and written through a temporary file plus atomic rename so concurrent responses cannot replace a newer snapshot with an older one. This remains the application's existing single-process storage model; a multi-writer deployment needs a shared transactional database.

Resetting the simulation demo preserves published proposals, their discussion, responses, and cited journal entries. Browser drafts remain on the device that saved them. Published proposal text is immutable in this first version, so votes refer to the same text that was reviewed.

## Verification

Run the repository's existing commands:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:proposals-ui
```

`src/server/citizen-proposals.test.ts` exercises validation, idempotent publishing, vote replacement/removal, public response filtering, and persistence failure handling. `server.citizen-proposals.integration.test.ts` uses a separate server process and temporary database to verify the HTTP journey and persistence across restart. Test proposals are never submitted to the deployed app.

`test:proposals-ui` runs the React components in Happy DOM against another isolated real HTTP server. It checks saved drafts, explicit publishing, voting, discussion, escaped user text, the feed, journal prefill, missing-source recovery, not-found handling, and recovery after a lost successful publication response. This verifies form interactions and API integration; it does not verify native browser rendering or visual layout.

For a UI check, use a temporary database and open `/votes`. Save and reload a draft, publish it, open the link in a second browser context, change a vote, add a comment, and confirm the feed and detail agree. Also test a journal conversion and a narrow mobile viewport.

## Deployment source alignment

This branch was prepared against GitHub `main` at `f53852e9d6537ae98e3e09fe792d0f4d9fdc5711`. At implementation time, that source used `/vote` and `fly.toml` targeted `dear-congress`, while the inspected `civic-synthesis.fly.dev` deployment already had newer `/votes`, `/feed`, and sample-draft screens absent from this repository.

Before production rollout, bring the current deployed source into the repository and integrate these modules with its existing screens. On the newer UI, reuse the form/detail components and API, add the proposal CTA to the existing voting screen, include published citizen proposals alongside clearly labelled sample content, and add the journal conversion link. Preserve the deployed app's other routes and features. Verify the intended Fly app and persistent volume before deploying. This branch does not change `fly.toml`, trigger a production deployment, or claim the live app has already changed.

## Private guided workspace (SHE-302 first slice)

Journal, Needs and the sample workflow link to **Propose a change** at
`/proposals/new?guided=1`. This bounded pilot is private drafting only. It never
calls a network endpoint or transfers its content to the existing immediate
publication form. That older form/API is unchanged; it does not provide the
moderation lifecycle required for the flagship acceptance criteria.

The four steps collect jurisdiction, experience/affected people/benefit,
mechanism/possible authority/costs/objections, sources/proposed text, then review.
Each city/county/state/federal template is a process checklist requiring human
verification, not a legal assertion. Review assembles a summary from supplied
words and a structured copy with explicit missing sections. It flags empty costs,
jurisdiction and sources and unsafe/malformed URLs. An explicit unknown cost is
retained and needs human review; source URLs are never fetched or verified.
No baseline is supplied, so output is proposed new text rather than an invented
legal redline. Use Back or the gap buttons to edit the corresponding fields.

**Save privately** permits incomplete drafts and resumes the single workspace on
return to the guided URL. Storage key `civic_synthesis_private_proposal_workspace_v1`
has a validated versioned envelope and stable draft ID. It is separate from and
does not migrate or overwrite existing `civic_synthesis_proposal_drafts_v1`
drafts. This is unencrypted browser storage, visible to other people using the
same profile, with no account recovery or cross-device backup. Saving again
replaces the workspace. Storage errors retain text on screen; corrupt/unknown
versions are not overwritten. Unsaved edits trigger the browser leave warning.

Walkthrough: open Journal → Propose a change; enter a night-shift transit problem,
select city, save; reload and check the experience remains; fill the remaining
steps, retain costs as unknown if needed; inspect gaps and structured review,
then Back to correct the text and save again. Repeat from Needs and `/draft`.
No content becomes public and no votes are cast.

`bun test src/client/proposal-workspace.test.ts` covers process fixtures,
uncertainty, corrupt storage and source validation, plus a Happy DOM route-level
walkthrough for actual editing, save/reload, gap reporting, escaped markup,
storage denial and zero network requests. Associated labels, heading focus on
step changes and live status/error roles are implemented. Native keyboard,
screen-reader, narrow viewport and 200% zoom checks remain required; DOM tests
are not native accessibility acceptance.

## Private amendment preparation (SHE-305 first slice)

Citizen proposal details now offer **Suggest amendment**. The recovered sample
`/draft` and `/votes` screens offer the same editor, explicitly labelled fictional.
The source's entire proposed text is one editable section; this does not infer
legal clause boundaries. Replace text, supply rationale, impact/cost (unknown is
valid), and a citation note with title, URL, locator, date and excerpt/version.
The comparison labels Removed/Added alongside strike/underline and stacks on
narrow screens. It highlights one changed span between the shared prefix/suffix;
it is not a semantic legal diff or a minimal word diff.

**Save new private version** appends an exact text/source snapshot and metadata
in browser-local storage, isolated by source kind and proposal ID. Saved versions
can be reopened after reload; saving edits creates another version. Origin,
jurisdiction, title, text, timestamp and an unverified browser author label stay
attached to each saved version. The editor blocks a stale-source save and offers
an explicit fresh start, preserving earlier saved versions. An unsaved working
copy is lost on navigation; save before switching proposals. A fresh start clears
the working fields, so save any needed work before accepting it.

No amendment API, moderation submission, publication or voting option exists in
this slice. Publication permission is recorded as **not requested**. There is no
public author-name field. Citation notes render as escaped plain text, including
URLs; nothing is fetched or treated as verified evidence. Parent text, votes,
comments, source journal identity and repository ballots are untouched.

Local storage is accessible to users of the same browser profile and scripts on
this origin; it is not an authenticated private account or durable audit history.
Clearing it loses drafts. The app appends snapshots but storage can be edited and
has no tamper protection, backup or cross-tab transaction guarantee. Each proposal
is limited to 30 saved versions. Corrupt/unreadable storage and failed saves
produce an error without intentionally overwriting earlier records. Do not use
this preparation feature for sensitive personal information.

`bun test` includes model fixtures and an isolated Happy DOM walkthrough through
`src/client/amendment-ui.test.ts` / `scripts/verify-amendments-ui.tsx`. The existing
`bun run test:proposals-ui` additionally checks that amendment preparation on a
real citizen detail does not change its public API text, options or ballots.
Native browser, zoom/contrast, keyboard-only and screen-reader verification remain
manual acceptance tasks. See `docs/reviews/SHE-305.md` for remaining delivery.

## Structured objections — SHE-307 first slice

On `/proposals/:id`, participants can publish an objection with concern/major/blocking
severity and a self-described impacted constituency, after explicit public consent.
The objection binds the existing immutable proposal ID/text. It starts unresolved;
only the original publishing browser can append a declined response with a reason,
or reopen it as unresolved with a reason. Losing that anonymous cookie loses this
response capability; this is not verified identity or a delegate authorization system.

`POST /api/citizen-proposals/:id/objections` accepts either:

- `{ action: "create", text, severity, constituency, confirmedPublic: true, idempotencyKey }`
- `{ action: "respond", objectionId, expectedVersion, status: "declined" | "unresolved", reason }`

Creation UUID retries return the same objection; different content with the same
key conflicts. `expectedVersion` is the number of prior responses. Stale responses
return 409; reload the page to inspect the ledger before deliberately submitting
again. The timeline retains all proposer decisions with timestamps. Save failures
restore the previous ledger. Existing cookies, same-origin restrictions, body bounds,
rate limits and serialized single-writer persistence apply to the new endpoint.
Public projections omit ownership and retry hashes. These records survive demo reset
with the rest of the proposal. No location is inferred from constituency text.

Acceptance is deliberately unavailable until a published revision/redline can be
linked. No revisions, voting rounds, rule configuration, quorum, consent thresholds,
community agreement or automatic action are introduced by this slice. Existing
proposal votes remain legacy/unwindowed advisory browser responses.

Local walkthrough: publish a proposal at `/proposals/new`, open its detail link,
submit a major accessibility objection with constituency “Wheelchair users”, and
confirm it starts unresolved. From the publishing browser decline with a reason,
then reopen it; both events remain visible. Another browser may object but must not
get proposer controls. Existing support/oppose/unsure totals must remain unchanged.
Do not run this walkthrough against production.

`src/server/proposal-objections.test.ts` covers retry conflicts, legacy compatibility,
private field filtering, scope/authority, invalid decisions, stale concurrent writes,
serialization and disk failure rollback. `src/client/proposal-objections.test.tsx`
runs a Happy DOM form walkthrough with failed-save recovery and safe markup rendering.
Controls have native labels, fieldsets, public consent, status/error announcements
and error focus recovery. Native keyboard, screen-reader, mobile/zoom and visual QA
remain manual acceptance work. The existing HTTP/restart journey also includes
objection creation and proposer response; it requires a working local server bind.

### Reading assistance

Loaded proposal detail pages include **Help with civic terms**, an English
explanation of citizen proposal, advisory response and browser identity. Each
entry links to its original visible notice; opening help never submits a choice
or changes proposal text. Use the native summary control to open/close it, or
Escape within help to close and return focus. No preference is stored. This
first slice does not provide Spanish localization or reviewed legal summaries;
see `docs/reviews/SHE-318.md` for remaining acceptance and verification limits.

## Optional discussion reading guide (SHE-308 first slice)

Open a published proposal from `/votes` and enable **Show optional reading guide**
in Public discussion. This local template repeats all loaded public comments
with source links and offers clarifying questions. It defaults off and uses no
AI provider, storage, journal content or votes. It does not summarize positions
or infer consensus. Ordinary commenting works with the guide off. Formal
summary corrections, appeals and comment reporting are pending; see
[the SHE-308 follow-up and acceptance gaps](reviews/SHE-308.md).

## Browser-local following (SHE-358)

Sample feed/vote/draft/outcome views and citizen detail offer **Follow this proposal**.
Navigation → Watchlist opens `/outcomes#watchlist`, with unfollow, JSON export and
local deletion. Following is independent of votes. Public text snapshots are stored
in `civic_proposal_follows_v1`, isolated by sample/citizen kind and ID. This is
browser-profile storage, without account recovery or cross-device synchronization.
Revisiting a followed proposal can show its last two observed text versions;
observation time is not a source update date. No background monitoring or notification
delivery exists, and missing/withdrawn source status is not inferred. See
[scope and remaining acceptance](reviews/SHE-358.md) before treating this as a
subscription service. No notification permission or identity is collected.

## Design workshop preparation (SHE-501)

Loaded citizen proposal details offer a six-part agenda: problem, evidence,
goals, constraints, options and open questions. Initial notes copy public source
text; edits stay in page memory. Reloading or navigating away loses the notes.
The six-stage navigation provides context only and never transfers workshop text
into sample drafts, sponsor flows or votes. Source loading and retry use the
existing detail loader; no workshop request or storage is introduced.

Facilitators explicitly consent before preparing a read-only snapshot for manual
copy/sharing or downloading an attributed plain-text proposal draft. Exports
identify the citizen proposal, original publication date, journal source when
present and self-described facilitator. Notes are attributed only to their author,
not inferred participants. Empty sections remain open; citations remain unverified.
No shared URL, public hosting, authenticated facilitator role or multi-user session
is provided. Opt out clears notes/attribution/summary and revokes local consent;
previously distributed files cannot be recalled. Exports require a separate human
review of permission before distribution.

Public collaboration is disabled pending working participant consent, attribution
choices, opt-out/withdrawal, abuse reporting and moderation. The safety disclosure
explains that boundary before the controls. This preparation slice does not satisfy
full public-workshop acceptance. Existing public discussion is unchanged. Native
labels, keyboard controls, wrapping actions and fluid fields support narrow screens;
there is no workshop animation or reduced-motion dependency. Native mobile,
keyboard and screen-reader acceptance still requires review.

## Sample audio explainer (SHE-490)

The six-stage sample workflow offers a click-to-play English synthetic explainer
for the selected fictional proposal. Five passages describe its goal, clause,
scenario jurisdiction, unavailable tradeoff evidence and uncertainty. Transcript
passages link to the exact displayed sample fields; agency background links are
never narrated as evidence. Speech is provided by the browser/OS and may use its
speech service, as disclosed before playback. No microphone, autoplay, external
AI summarization, vote mutation or stored audio preference is used.

Stop cancels owned speech, as does changing proposal text or leaving the view.
Loading and voice failure leave the transcript usable; Play retries failures.
Subtitles show the passage currently being spoken. Native buttons and disclosures
support keyboard use; text wraps on narrow screens and no animation is added.
The roughly one-minute duration varies with text and platform voice. Citizen,
official-bill and repository PR records are outside this sample-only feature.

## Legislative redline detective sandbox (SHE-415)

The existing amendment editor on sample Draft/Votes and citizen detail includes
an optional, collapsed **Play legislative redline detective · Sandbox**. Three
bundled fictional cases ask about duty, eligibility and ambiguous timing. Select
a native radio choice and submit Reveal explanation; only then are feedback,
Removed/Added comparison, links to the exact fictional source clauses and edge
cases shown. Next case resets the guess and moves focus to the case heading;
Play again restarts the set. No score or guess is persisted or sent anywhere.

These are unreviewed invented words, not legal advice or interpretations of the
selected proposal. The existing source-kind-keyed editor and civic navigation are
unchanged. The existing comparison and source-chip presentation are reused, with
local clause anchors rather than misleading official background citations.
The existing law-behavior API accepts bounded model parameters, not arbitrary
clauses; this exercise does not call it or claim to project these edits.

Fixtures load synchronously with the editor, so there is no separate network,
loading, timeout or retry state. The exercise works without storage or model
availability. Native details, form, radios, buttons and anchors support keyboard
and touch. Controls have visible focus and at least 44px target height; narrow
comparisons stack. No animation, timers or automatic progression are used, so
reduced motion sees the same complete content. Human native-browser, zoom,
touch and screen-reader review is still required before acceptance.

## Phrase reading layers (SHE-393)

Opening **Suggest amendment** on `/draft` or `/votes` exposes an exact-text reader.
Explicitly authored phrases in known fictional drafts are native buttons that move
an exact phrase snapshot into an adjacent unreviewed plain-English pane using the
shared typed `clause-explain` transition. These are terminology aids, not official
clause boundaries or a legal interpretation. The full original text stays visible.
The pane records uncertainty, the exact draft locator and private revision; all
unmapped text and legal effects remain explicitly uninterpreted. Background links
are never represented as citations proving the sample wording is law.

Mappings require the sample kind, ID and exact original text. Citizen text, edited
revisions and unsupported samples receive an explicit unavailable explanation;
there is no generated paraphrase or remote interpretation request. Saved private
versions retain their existing immutable records. Reading never saves, publishes,
changes votes or submits anything. Text-only reading disables the morph; reduced
motion uses the shared immediate-update path. Native button semantics, retained
source focus and return anchors support keyboard/touch use and long text. There
is no separate asynchronous explanation loading state; the existing stage loader
continues to own sample retrieval.

## Private revision impact comparison (SHE-455)

Every amendment redline now includes Before/After panels for scope, eligibility,
cost, implementation and uncertainties. Explicit `Scope:`, `Eligibility:`,
`Cost:`, `Implementation:` and `Uncertainties:` lines are quoted verbatim with
local revision/line links. Unlabeled prose is never classified by keywords;
missing evidence says Needs review. Even anchored author statements need review:
a citation note is not verified evidence or a fiscal/legal assessment. This is a
bounded evidence checklist, not automated legal interpretation or an official
bill-revision service.

After saving two private versions, choose their IDs in Compare saved revision
IDs. Selection leaves editing fields and storage unchanged. Versions must share
the exact original source snapshot (kind, ID, origin, title, jurisdiction and
text). Live text is labeled unsaved; saved replacement text uses its private UUID.
Base text remains a saved snapshot, without inventing an official revision ID.
The existing local-storage and audit limitations above still apply. No API,
publication, voting, navigation or source-record changes are involved.

## Private amendment family tree (SHE-454)

The editor records explicit parent revision, fork, compromise and merge events.
Select a saved version before editing to make it the parent. Compromise and merge
require another version from the exact same source snapshot; reconciliation is
manual. Each branch exposes both parent links, exact-text comparisons, citation
notes, save time and its unreviewed private state. Legacy versions retain unknown
ancestry. Links preserve the current civic route and proposal selection and add
source-kind/ID and revision parameters. They reopen only in a browser containing
the records; a missing revision produces an explicit error, not a fabricated tree.
Links do not publish, sync or transfer drafts. Proposal drafts are never enacted
law, verified participation or approval evidence. There is no new API or loading
request: reads are synchronous browser storage. See the SHE-454 review for checks
and remaining native browser acceptance.

## Personal learning notes (SHE-533)

`/account` offers an explicitly saved browser-local learning log, with separate
Topics, Drafts, Sandbox runs and Explicit votes note categories. Source screens offer explicit copies of saved drafts, proposal topics,
current citizen advisory choices and completed synthetic model run metadata.
It does not reconstruct past events or copy model actor frames. Each entry
has a self-declared activity source and local saved date; neither proves civic
eligibility or verified activity. JSON export, selective delete and confirmed
reset affect only this log. Drafts, follows, public records and actual votes
stay in their original stores. See [scope and validation](reviews/SHE-533.md).


## Opt-in contributor credits (SHE-506)

Published citizen detail pages include Contributors & credits, within the existing
proposal flow. Each browser can self-report coauthor, research, editing or
accessibility work for that exact immutable citizen text. An unchecked consent
checkbox and unnamed attribution are the defaults. Select an invented pseudonym
if desired. This is self-reported participation, not verified authorship, a vote,
a simulated participant or permission to credit somebody else.

`POST /api/citizen-proposals/:id/credits` uses the shared `ProposalCreditInput`:
`revision` (server text binding), `expectedVersion` (ledger event count), and
`action: "opt-in"` with `confirmedPublic: true`, `role`, `preference` and optional
`alias`; or `action: "remove"`. Stale/retried successful writes return 409: reload
and inspect before intentionally resubmitting. Serialized persistence rolls back
failed writes. The existing signed cookie, same-origin and rate/body protections
apply. Existing records require no migration. Credits never alter text, sources,
ballots, comments, objections or repository governance.

Removal is fulfilled immediately for the current browser's own credit. The stored
pseudonym is deleted; append-only history retains action, role, preference and time,
never past names or identity links. Updating also discards the previous pseudonym.
Public projections allowlist current aliases and name-free history, excluding
ownership hashes. No journal or account identity is read or copied. Existing share
and watchlist exports continue to use public proposal text only, without credits.
Publicly typed aliases can still identify someone; use invented names. Earlier
screenshots, downloads and backups cannot be recalled. Cookie loss has no recovery
workflow yet. JSON storage is not a cryptographically tamper-proof audit log.

The form reuses responsive proposal controls, native labels/fieldset/details,
error focus and live loading/status announcements. It adds no motion. Automated
DOM coverage verifies consent, failure recovery, escaped markup and immediate
removal; native keyboard, screen reader, mobile/zoom and reduced-motion visual
acceptance remain manual review tasks.

## Private civic duet (SHE-503)

**Duet · propose an alternative** opens a page-memory copy on citizen details and
sample Draft/Votes screens. Review the original attribution, unverified supporting
information and Added/Removed comparison; explain how the alternate builds on the
idea. **Keep private copy on this page** retains a snapshot and allows another
copy with root and immediate-parent attribution. Copies never edit the original
or carry its votes. They are lost on leaving/reloading; no storage or API is used.
Do not include personal content without permission. Publishing is unavailable
pending server permission and moderation safeguards. See
[remaining acceptance and verification](reviews/SHE-503.md).


## Cooperative policy-design missions (SHE-504)

**Design together** appears on the six-stage workflow's sample Draft and loaded
citizen proposal details. This is a same-device workshop for up to six people,
not a remote collaboration service. Participants pass the device and select their
self-declared name. Optional research/cost/fairness/implementation roles may be
shared or left unassigned. The facilitator adds/updates participant roles and
editor/observer permissions. Editors revise the separate shared draft, record
cited findings with reasoning and limitations, and raise/resolve questions with
reasons. Observers read/export. These permissions enforce UI/model operations,
not identity: anyone with browser access can select an editor or edit storage.

Progress awards at most one milestone per role after a different editor records
a reasoned quality review. Reviewers consider source relevance/credibility,
reasoning and limitations. A later “needs work” review revokes that contribution's
readiness. Multiple ready contributions in a role still earn only one milestone.
Saving a draft revision resets readiness until the evidence is reviewed again for
that revision. Earlier reviews stay in the log. No political votes, popularity
counts or posting-volume points are inputs. Names
are unverified and no citation is fetched or independently verified; progress is
not consensus, legal authority or acceptance.

Browser storage uses `civic_cooperative_mission_v1:<kind>:<encoded-id>` and an
exact source snapshot including text/title. Sample/citizen kind, ID and revision
remain isolated. Changed sources and malformed/unknown-version logs block saves
without overwriting old storage. The typed contract replays append-only events;
derived draft/member/question state is reconstructed. Every saved change retains
actor, timestamp and action. JSON export includes the source, draft, participants,
contributions, reviews, resolved/unresolved questions and log. Copyable saved JSON
is available if downloading fails. Get group consent before sharing this data.
The ledger is capped at 300 changes and is not tamper-proof or authenticated.

Each change persists before it appears successful; quota/blocked-storage failures
retain form text for retry. Detected changes from another tab block writes and
offer reload after copying unsaved text. This is not an atomic cross-tab database;
use a single tab/device for the workshop. Form edits are lost on leaving or
switching sources until explicitly saved. Storage clearing loses the workshop;
there is no account backup, remote invite/sync, import/merge or publication path.
Original proposal text, source journals, votes, repository identities and PRs are
untouched. Existing governance is unchanged (see launch-merge-policy.md).

Focused model and isolated Happy DOM tests cover quality-review milestones and
revocation, permission/attribution validation, unsafe citation rejection, source
isolation, replay/export, actual form editing, observer controls, save failure,
stale-tab recovery and zero network requests. Fields have native labels and
controls with visible focus and no drag requirement. Styles wrap long content,
stack at mobile widths and disable motion under reduced-motion preferences.
Native mobile, keyboard/screen-reader and visual verification remains required;
DOM tests do not establish native accessibility acceptance.
