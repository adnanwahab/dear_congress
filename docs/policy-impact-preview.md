# See What Changes

Public citizen proposals now retain server-side immutable legal versions alongside
existing original text, journals, advisory responses, comments, objections and credits.
No repository governance, official legislation, private workspace or browser amendment
storage is migrated. The original detail and original advisory totals still represent
version 1. Each substantive revision has separate advisory responses; none are copied.

## Walkthrough

Open an existing public `/proposals/:id`, then **See What Changes**. The publishing
browser can edit title, proposed document type and clauses, explicitly confirm public
publication, and save a new version. The resulting stable
`/proposals/:id/versions/:version/impact?base=:base` page immediately shows the exact
clause diff. **See What Changes** requires a separate confirmation of the exact legal
text/title to transfer. No automatic transfer occurs on save. Private drafts are never
imported. Constitutional amendments remain proposed, unreviewed text, not adopted law.

Use `/proposals/new?demo=housing` to create a public **synthetic** housing proposal
with version 1 (no housing reform authorization) and version 2 (adds section-1).
The explicit mechanism reference is `h_lots`, already present in the source catalog.
Only this exact server-created synthetic example, including its fixed title, is eligible for the pilot mapping. No user-authored free text is transferred in this first supported example.
Changed citizen prose and unsupported constitutional text retain the diff and report
**No supported outcome model**. No NLP or numerical parameter inference is performed.

An accepted HBL response supplies the canonical simulator link; the page embeds that
link with a sandboxed responsive iframe and a visible **Open full simulator** action.
HBL owns synchronized worlds, recorded checkpoints, time controls and explanations.
The local page retains HBL model/mapping versions, parameter diffs and one bounded
recorded result sample (run 0); full results and explanation graphs stay in HBL.
Comments on assumptions use the existing public discussion, with version/clause IDs.
No simulation is a real-world observation, legal approval or real participant.

## Environment

| Variable | Configuration |
| --- | --- |
| `HBL_URL` | HTTPS origin; defaults to `https://happybearlandia.fly.dev`. Used server-side and as the exact permitted iframe origin. |
| `HBL_INTEGRATION_TOKEN` | Server-only bearer credential matching HBL's `HBL_POLICY_PREVIEW_TOKEN`. Never included in frontend code, URLs, snapshots or logs. Missing token produces an unavailable state. |
| `HBL_PREVIEW_FIXTURE=1` | Development only. Enables `/proposals/demo-housing-fixture/versions/2/impact?base=1` and its clearly labeled local iframe/timeline. All fixture endpoints return 404 in production even with the flag set. |

Source-version URLs use the existing canonical `SITE_URL` constant in
`src/shared/page-metadata.ts` (`https://civic-synthesis.fly.dev`); it is not a new environment variable.

On HBL, an operator must also allow the actual Civic Synthesis HTTPS origin through
`HBL_POLICY_EMBED_ORIGINS`. This repository does not change HBL configuration.
The viewer has no `postMessage` bridge here, so no untrusted message can change state.

## API

All proposal operations use the existing signed anonymous browser cookie. Supplied
`x-voter-id` is replaced by the shared security boundary. Ownership means the original
publishing browser, not a verified resident/account. Losing that cookie loses editing
rights. Same-origin checks, request body bounds, rate limits, no-store responses and
serialized single-process writes apply.

| Method | Route | Response or action |
| --- | --- | --- |
| GET | `/api/citizen-proposals/:id/versions` | Public version snapshots, previews, per-version aggregate responses and the current browser's own response/edit capability. Internal ownership and ballot event fields are omitted. |
| POST | `/api/citizen-proposals/:id/versions` | Owner creates an immutable revision; returns `{version, impactUrl}`. |
| GET | `/api/citizen-proposals/:id/versions/:version/impact` | Read linked local previews; refresh an existing remote job's status with bounded/throttled server-side reads. Does not transfer new legal content. |
| POST | `/api/citizen-proposals/:id/versions/:version/impact` | Owner explicitly transfers reviewed public text; returns `{preview}` immediately after local persistence, before the HBL request finishes. |
| POST | `/api/citizen-proposals/demo-housing` | Explicit public synthetic example creation, using the original publish idempotency rules. |
| POST | `/api/citizen-proposals/:id/vote` | Existing operation additionally accepts `proposalVersion`. Omitted version means 1. Responses to later versions and their history are isolated from original totals. |

Revision body:

```json
{"expectedVersion":1,"title":"Public proposal","type":"bill","clauses":[{"clauseId":"section-1","text":"Exact proposed text"}],"confirmedPublic":true,"idempotencyKey":"a stable UUID"}
```

Keep clause IDs when editing. New clauses get new IDs; missing clauses are removals.
Stale expected versions return 409. Identical UUID retries return the same version;
changed content with the same UUID returns 409. A maximum of 100 versions and 200
previews per proposal fails closed rather than evicting earlier shared records.

Preview body: `{"baseVersion":1,"confirmedPublicTransfer":true}`. The payload is
frozen before network I/O. Duplicate requests resolve to one local preview and one
remote idempotency identity. Up to three bounded network attempts (8-second timeout,
short exponential backoff) handle network/429/5xx failures. Authentication/validation
errors do not receive automatic retries. Redirects are rejected. Remote URLs must
match the configured origin, `/world/impact`, and returned preview ID. A failed HBL
job may be retried via its authenticated `/retry` endpoint, subject to HBL's own
three-attempt-per-pair bound. Local diff and metadata survive all remote failures.
Public reads poll only already-linked queued/running jobs, at most once per 10 seconds
per preview. Restarted queued requests without a returned remote ID need an explicit
retry; HBL idempotency reconciles a lost response.

## Handoff compatibility

The payload has exactly `schemaVersion`, `source`, `legal`, `baseline`, `simulation`
with schema `policy-impact-preview.v1` and system `civic-synthesis`. Source types are
`bill` and `constitutional-amendment`. Only explicitly public legal text/title and
opaque proposal/version identities are sent. No problem narrative, supporting notes,
source journal IDs/text, browser IDs, ballots, credentials or locations are exported.
Contact-detail/precise-coordinate checks and explicit content review guard transfer;
heuristics cannot guarantee detection of every identifying statement. Unsupported
local diffs can contain null mapping IDs but are **never sent to HBL**.

The companion's executable contract in `world/policy-preview-contract.js` requires:

- Operations `add`, `remove`, `modify`; wording-only modifications have no inferred numerical change.
- `source.contentHash` is SHA-256 of recursively key-sorted canonical JSON of the complete `legal` object. This is the **handoff diff hash**. A separate immutable saved-version `contentHash` binds its type, title and complete clauses.
- 100 runs, explicit seed 42; the requested default horizon is 120 months but the current companion limit is **24 months**, which this client requests and discloses.
- Status is `job.status`, not a top-level field. `partial`, `failed`, and model-version `unavailable` remain explicitly incomplete locally, with retained canonical links.

Only prior saved proposal baselines are available in this slice. No verified enacted
baseline exists in the current proposal model, so `current-law` is never asserted.
Any two saved versions can be compared locally. The exact synthetic v1→v2 addition
is the supported remote comparison; other comparisons await reviewed mappings.
HBL's current version identity binds its canonical legal diff, so a remote version
must not be resubmitted with a different baseline/hash. This pilot does not do so.

## Validation and evidence

Run `bun test`, `bun run typecheck`, `bun run test:routes`, and
`bun run test:proposals-ui`. Native Chromium workflow:

```sh
# Install the repository's tests/accessibility dependencies and Chromium first.
bun scripts/verify-policy-impact-ui.mjs
```

For a persistent local fixture viewer, run
`PORT=3487 DB_PATH=/private/tmp/civic-preview-demo.json HBL_PREVIEW_FIXTURE=1 bun run dev`.

Optional `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` select an already installed
Playwright/Chromium. The script launches a temporary server/database, never production,
and writes `artifacts/policy-impact/*.png`. It checks saving/revising, immutable preview
history, isolated ballot versions, unavailable/unsupported states, fixture iframe time
scrubbing and 390px reflow. Server tests exercise ownership, hash identity, exact diff,
retry conflicts, stale saves, credential handling, canonical URL rejection, remote
progress/results, rollback, restart and demo-reset retention.

Review captures (explicit fixture, not live outcomes):

- [Version 2 legal diff and simulator unavailable](screenshots/policy-impact/01-version-diff-unavailable.png)
- [Version 3, new diff and separate advisory response](screenshots/policy-impact/02-revision-and-separate-response.png)
- [Fixture iframe, desktop](screenshots/policy-impact/03-fixture-desktop.png)
- [Fixture iframe, mobile](screenshots/policy-impact/04-fixture-mobile.png)

## Live limitations and example URLs

No deployment or production proposal was created. On 2026-11-18 the configured
`https://happybearlandia.fly.dev/api/policy-previews` returned HTTP 404 to the read-only
availability check; no integration token was available. Consequently there is **no
verified live generated HBL preview URL** to publish. Unit tests exercise the
companion response envelope and browser screenshots use the explicit local fixture.
Live authenticated creation, actual HBL iframe framing, model execution, checkpoints
and explanation navigation still require the companion deployment and operator config.

After a human release, the public demo entry is
`https://civic-synthesis.fly.dev/proposals/new?demo=housing`; its explicit creation
returns a real proposal ID and stable local version URL. This is an intended entry,
not a claim it is deployed. The local fixture example is
`http://localhost:3487/proposals/demo-housing-fixture/versions/2/impact?base=1` when
the documented development flag is enabled. No placeholder remote ID is presented
as a successful HBL preview.

Storage remains the repository's single-process JSON database, with rollback on failed
saves. Multi-writer transactional deployment, verified account ownership, comprehensive
PII moderation, reviewed non-demo mappings and native assistive-technology acceptance
remain outside this slice. Existing objection responses and credits still bind original
published text; revision pages link back without carrying these claims to new text.

### Recorded checks (2026-11-18)

- `bun test`: 968 passed, 0 failed across 292 files; focused preview and proposal/credit/objection tests also passed after final hardening.
- `bun run typecheck`: passed.
- `bun run test:routes`: passed.
- `bun run test:proposals-ui`: all 16 existing journey checks passed. Its test setup now supplies reset authentication, explicitly moderates its missing-source fixture (reset intentionally preserves cited sources), and handles the existing selected-vote marker and heading levels.
- `bun run test:policy-impact-ui`: Chromium desktop and 390px mobile journey passed; screenshot files above refreshed. Used an already installed Playwright module and Chromium binary via the documented overrides.
- The supported synthetic payload passed the local companion executable `validatePolicyPreview`; its canonical legal hash is pinned by a regression test. This is contract validation, not live service acceptance.

Native screen-reader verification and the deployed authenticated HBL journey remain unverified.
