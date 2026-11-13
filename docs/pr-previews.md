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
