# Protected public feedback intake

`/feedback`, linked from `/documentation`, submits to `POST /api/feedback`.
There is no automatic public posting, AI processing, GitHub delivery or journal
publication. Reports never enter voting, synthesis, resident state or demo reset.
The five exact tags and assigned duty roles are defined in
`src/server/feedback-intake.ts`. Initial review targets run from receipt time:
bug 72 hours, misleading-claim 48, privacy 24, accessibility 48, idea 168.
These are review targets, not guaranteed resolution or individual replies.

## Operator handoff

Before enabling intake, appoint actual people to Engineering, Content and safety,
Privacy and safety, Accessibility, and Product maintainer duties. The role labels
are routing assignments, not evidence of staffed coverage. Set a dedicated strong
`FEEDBACK_ADMIN_TOKEN` through the operator's secret store; do not reuse a browser,
voting or public API credential. Without this token, submission returns 503.
Do not enable intake until the duty roster and queue monitoring are staffed.

Authorized maintainers read `GET /api/admin/feedback` with
`Authorization: Bearer <FEEDBACK_ADMIN_TOKEN>`. The response is no-store JSON,
newest 200 first. For older reports pass `?before=<smallest cursor>` from the previous page.
Queue access is not exposed in public navigation. Treat JSON text as untrusted;
never paste raw reports into public issues, terminals or HTML renderers.
Do not put credentials in URLs or browser local storage.

During launch, check at least daily and prioritize privacy/exposed credentials,
credible threats and access blockers before ordinary defects and ideas. Keep
abuse private, review claims against source evidence without judging political
stance, and assign the report ID to a human. Use a restricted operator tracker
for acknowledgement, disposition, escalation and completion. Only a human may
prepare a redacted public task after reviewing disclosure risks and consent.
No automatic outreach or promised emergency response is provided.

Storage is a separate SQLite file beside DB_PATH (`<DB_PATH>.feedback.sqlite`),
created mode 0600 and excluded by the existing SQLite ignore rules. Restrict the
containing directory and backups to operators. No cookies, IPs or contact details
are stored with a report. Existing public-write origin, bounded-body and IP/identity
rate limits apply. The form explicitly requests private-review consent and warns
against sensitive details. There is no public receipt lookup.

Retention is manual, with no automatic expiry or backup deletion guarantee.
Authorized operators should remove resolved raw text as soon as operationally
unnecessary using a controlled private SQLite maintenance session, recording only
non-sensitive disposition metadata in their restricted tracker. Do not copy the
queue into Git or public operational logs. This change configures no production
secret, staffing, external tracker, retention job or deployment.
