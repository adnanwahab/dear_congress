# Community vote batches

Community Yes/No requests write only to SQLite. They make no GitHub requests and do not publish individual votes. Browser aliases identify a browser, not a verified person; clearing cookies can create another identity. These votes never enter the verified roster or automated merge electorate.

The PR page countdown targets the next five-minute boundary (e.g. 09:00, 09:05, 09:10 Central). Clicking it opens a paginated view of current community choices, including revision and anonymous alias. Changing a choice replaces that browser's current vote; revision history is retained for cutoff snapshots.

Five-minute publishing requires server environment configuration:

- `HBL_PUBLISH_VOTE_SUMMARIES=1`
- `HBL_COMMENT_TOKEN`: bot credential with PR/issue comment permission on HappyBearLandia
- `HBL_BOT_USER_ID`: the numeric bot identity used to reconcile comments

Without these values the widget explicitly says publishing is not configured. Votes still persist locally. No secrets are returned to the browser. Keep the existing single-writer SQLite deployment and durable volume.

After the PR API initializes, a 30-second server timer checks the five-minute window. The existing signed daily batch endpoint also wakes this publisher when explicitly invoked with `dryRun:false`; merge permissions and switches remain separate. Keep the app running. A restart snapshots the latest five-minute boundary and retries previously saved pending batches; it does not synthesize all missed intervals.

Each PR gets at most one immutable snapshot comment per five-minute interval, for its latest known revision before the cutoff, e.g. `100 votes yes, 3 votes no`. Comments are cumulative current-revision totals, not just newly cast votes. Votes at or after the cutoff wait until a future five-minute snapshot. The snapshot uses locally observed PR metadata; source freshness warnings remain visible on the page.

Durable claims serialize publication. Retries reconcile exact bot-authored comments before creating one; failed/uncertain requests retain the snapshot for reconciliation and retry after 30 seconds. Published receipts remain in `hbl_vote_summaries`. This does not enable publishing feedback, task intake, merges, or deployments.

Before enabling in production, configure and verify the bot credential and confirm a single running writer with persistent SQLite storage. No live GitHub comments were posted during implementation verification.
