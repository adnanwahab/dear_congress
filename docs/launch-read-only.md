# Owner-operated public write pause

`LAUNCH_READ_ONLY=1` enables the server-side launch fallback. Unset, empty, `0`
or `false` means normal operation; other nonempty values pause writes. This is
startup configuration, never a URL, cookie or browser preference. Only the
release owner with host configuration access may enable or disable it. No public
or admin HTTP toggle is added. Do not give host credentials to public clients.

The gate rejects every non-GET/HEAD/OPTIONS API request with 503, `writes_paused`,
no-store and Retry-After 60 before dispatch, including function routes,
journal aliases, contact-detail moderation, proposal and repository ballots.
There is no admin bypass for API mutations. This intentionally also pauses
corrections, withdrawals, reporting and compute POSTs. Read-only admin health
remains available; urgent privacy/moderation work requires the owner to isolate
public ingress and follow the existing authenticated operator workflow.

HTML includes a visible status notice outside the React root. Existing sample
labels, source identities and outbound links remain unchanged. A rejected request
creates no entry, ballot or receipt and is never queued for replay. Unsent text
remains subject to existing page-memory behavior; users must keep it before
leaving. Existing data is neither reset nor migrated. GETs, background repository
sync, feedback outboxes and existing governance scheduling are unchanged: this
is a public HTTP write fence, not a whole-system storage or outbound kill switch.
Preserve the separately configured merge kill switch and advisory lock.

## Enable, verify and recover

1. Owner records incident, current image SHA and current configuration. Confirm
   the intended Fly app; do not infer a target from a different repository.
2. Temporarily fence public mutation traffic at ingress; allow admitted requests
   to finish and verify the JSON save queue has drained using `/admin/health`.
   Reconcile timeouts against existing records; a lost acknowledgement is unknown,
   not evidence that nothing was saved. Never force-kill an admitted save.
3. Set `LAUNCH_READ_ONLY=1` in the host's server environment and gracefully restart
   the existing reviewed image, keeping the durable volumes and single writer.
   Confirm every serving instance uses that value before removing the ingress
   fence. This switch requires a restart; mixed old/new instances are unsafe.
4. Verify the notice on Journal and Votes, sample reads and outbound links.
   Verify write rejections using disposable staging state, not production votes.
   Run `bun scripts/smoke-read-only.ts` locally with no service credentials.
5. To reopen, the owner first resolves the incident, verifies durable state and
   reconciles unknown saves. Fence traffic again, set `LAUNCH_READ_ONLY=0`,
   gracefully restart all instances and verify health before reopening ingress.
   Users explicitly resubmit rejected work; there is no automatic replay.

If this implementation fails, retain the ingress write fence and roll back only
the reviewed image/configuration to a compatible human-approved release. Never
restore an older database, delete votes/receipts, reset state or weaken auth,
checks or quorum. A new production image still requires human review and a
human-published tagged release under `launch-merge-policy.md`. This document
executes no host changes and grants no deployment authorization.

Governance defaults remain disabled/dry-run, quorum 10, 24-hour exposure, one
current-head approval, fail-closed allowlists and active kill switch. Preserve
stricter runtime settings. Required checks and human approval remain unchanged;
production configuration and branch protections were not verified here.
