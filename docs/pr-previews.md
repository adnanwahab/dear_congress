# PR screenshots and Fly previews

The game-patch list and detail pages display a real browser screenshot plus an Explore button for each prepared revision. `src/server/hbl/previews.json` is the operator-owned registry. Records bind PR number, full head SHA, screenshot, capture time, route, and verified Fly deployment. Contributor text cannot supply an executable preview URL.

Images are served by the read-only `/api/hbl/previews/:number/:headSha/image` endpoint. A changed PR head suppresses both its old screenshot and preview link until the new revision is rendered and deployed. Missing previews are explicitly pending; production is never presented as a PR-specific preview.

Current preview apps are isolated per PR and head (`hbl-pr-N-SHAprefix.fly.dev`). They deploy exported GitHub head source, never the dirty working checkout, with one auto-stopping machine, no production volume, and no production secrets. Newer revisions require their own 1 GB preview-only SQLite volume; these never mount or copy a production volume. They connect to Civic Synthesis's what-if synthesis endpoint for comparison calculations. Saved simulation state is temporary. Screenshots with synthetic browser fixtures or infrastructure-only changes are labeled in the card caption.

To refresh a preview:

1. Verify the PR head via the repository API. Export exactly that commit into a temporary directory without local `.env` files, private runtime data, or orchestration state. Do not execute PR workflows with host credentials.
2. Render its actual route in a browser and capture a PNG. Record fixture provenance and any rendering limitations. Do not generate an illustration as a substitute for an application screenshot.
3. Deploy to an isolated head-specific Fly app with auto-stop and no production credentials or volumes. If the revision requires durable SQLite on Fly, create a dedicated preview-only 1 GB volume and retain a single writer. Confirm the machine build ID equals the PR head and verify its public route before registering an Explore link.
4. Add the image under `src/client/assets/pr-previews/` and its matching entry in `src/server/hbl/previews.json`. Run type checks, preview tests, and a browser check of the list/detail pages.

Review and remove obsolete Fly preview apps and their dedicated volumes when their PRs close. Auto-stop reduces idle compute but these are real Fly resources; deleting a registry record does not itself delete the associated app. This preview feature neither merges PRs nor changes production deployments.

## PR attachment pairs

List and detail cards show the first two unique raster images embedded in the PR description, side by side at desktop and mobile widths. Markdown and HTML image attachments must use immutable full-SHA GitHub blob/raw URLs in that PR's configured repository. Captions identify the image source commit; attachments are not treated as verified deployments. Unsupported hosts, mutable refs, cross-repository paths and SVGs are excluded. Images load lazily without a referrer and can be opened at full size. Browsing never downloads or builds a version. The operator registry remains the authority for exact-head Explore links and the fallback when attachments are absent.

## Draft patch stories (SHE-622)

PR details include a read-only, native disclosure accordion ordered by GitHub file
and hunk order. Each step pairs removed/added lines with exact base/head source
links. The typed local status separates loading, error, blocked, checks-pending,
review-ready and pending. Review-ready describes available current-head check
receipts only; it is not merge eligibility or human acceptance. Permission wording
uses the existing viewer/roster state. Refresh errors retain the displayed revision.

Interpretations remain labeled draft and there is no publication action. Generic
add/replace/remove summaries are a starting point for human interpretation, not
verified semantic behavior explanations. Screenshots are revision-wide evidence,
not claims that a particular file caused a visual change. Only exact base/head
attachments are included, and contributor provenance remains explicit. The operator
registry supplies the exact-head fallback; missing before/after captures stay
pending. No screenshots are synthesized or captured by browsing this control.

Native details support keyboard disclosure without a custom key handler. Paired
code stacks on mobile; opening content uses the shared motion scale and respects
reduced motion and motion=off. LiveRound remains civic-only because its snapshot
contains no repository PR identity. Story browsing has no write callbacks, network
mutations, voting actions, or publication endpoint. Existing quorum 10, exposure,
checks, roster/auth/CSRF, advisory lock and disabled/dry-run policies are unchanged;
see launch-merge-policy.md for the full configured policy and human release rules.

## Civic patch playtest station (SHE-617)

PR detail pages include a page-local exploratory checklist for desktop, mobile,
keyboard and reduced motion. The station shows repository, repository ID (in the
report), head SHA, base, revision and advisory review status independently of
preview availability. Only the existing operator registry's exact-head,
deployment-verified HBL Fly origins launch; no contributor URL or other repository
can supply a preview. Missing deployments remain explicitly unavailable. Opening
is a separate tab with no opener/referrer; no iframe, build or deployment occurs.
No new preview origins or deployments were registered by this change.

A participant supplies environment, reproduction steps, expected and actual
behavior and explicitly consents before recording a public report. Nothing is
autosaved or automatically collected from the browser. Reports serialize this
structured context into existing feedback text so the durable revision-bound
feedback/outbox/receipt pipeline remains compatible. Authenticated approved-roster,
CSRF, source freshness, server revision checks, input/privacy limits and publication
configuration continue to apply. Retrying an unchanged uncertain submission reuses
its idempotency key. Editing starts a new report attempt. Changing revision resets
the station; checklist and unfinished reports are lost on navigation/reload.

Saved feedback is separate from GitHub delivery and task intake; their pending,
failed and deep-link states appear in Feedback and follow-up. These reports never
change ballots, approval evidence, eligibility, quorum or merge authority. The
station intentionally does not integrate LiveRound: its anonymous civic votes are
a different data source and cannot be treated as playtest feedback or approval.

Run `bun test src/client/playtest.test.tsx` and
`bun scripts/verify-playtest-ui.tsx` for the station's focused checks, in addition
to all required repository checks. Real desktop/mobile browser layout and keyboard
and reduced-motion review remain part of human acceptance.
