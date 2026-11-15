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

## Readiness diagnostics (SHE-610)

Each PR list card and detail offers a native, keyboard-operable **Preview readiness**
expander. Opening it fetches the selected repository's existing read-only detail
endpoint; Refresh diagnostics repeats that GET. While expanded and visible it polls
at 30-second intervals, with no synthetic progress or build-start action. Closing,
changing revisions or leaving the page cancels the request and interval. This is
polling of actual GitHub receipts, not a GitHub event subscription. `LiveRound`
continues to stream civic round votes independently.

The typed client interpretation is `Readiness` / `Diagnostic` in
`src/client/preview-readiness.ts`. The additive optional `Evidence.receipt` includes
observation time, protection-read permission, completeness, exact required check
contexts, required approval count and strict/up-to-date rule from GitHub's branch
protection response. Older cached evidence explicitly has no receipt timestamp.
A denied/unavailable protection lookup retains fetched checks while protection
eligibility stays unknown and fails closed. The panel distinguishes configured
`allowedBases` / `requiredChecks` policy from GitHub branch protection rules; it
cannot claim to enumerate organization rulesets that this source does not fetch.

Check results bind to the displayed head, and the panel identifies repository ID,
PR number, head and base SHA. A newly observed revision is shown only in diagnostics;
existing ballot controls retain their source revision until the page source is
refreshed. Stale responses and failed refreshes display unknown readiness. Source
permissions are distinct from the existing signed-in/approved voter status.
Review-ready describes code receipts only, independently of ballot quorum,
exposure and preview availability. It never authorizes a merge. Exact-head operator
registry entries remain the only authority for Explore links; images do not prove
deployment. The panel uses no animation, has wrapped long identifiers and native
summary/button focus behavior, and does not depend on motion preferences.

Governance remains disabled/dry-run by default, quorum 10, 24-hour exposure, at least
one current-head review, empty base/check allowlists failing closed, active kill
switch and fixed advisory pilot auto-merge lock. No configuration or records change.
See [launch merge policy](launch-merge-policy.md) for human review and release rules.
