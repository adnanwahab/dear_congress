# Launch-day alert checklist — SHE-287

Status: repository preparation only. External monitoring, BugSnag notification
settings, delivery and on-call acceptance have **not** been verified. Do not mark
SHE-287 done until the evidence below is recorded.

## Target and health check

Confirm the public launch origin and deployed revision with the operator first.
The canonical origin in `src/shared/page-metadata.ts` is
`https://civic-synthesis.fly.dev`, but `fly.toml` targets `dear-congress`.
Do not deploy this checkout to resolve that mismatch. The deployed dashboard and
BugSnag instrumentation described by the issue are absent from this checkout.

`GET /healthz` returns HTTP 200, JSON
`{"ok":true,"service":"civic-synthesis","mode":"demo"}`, and `Cache-Control: no-store`.
HEAD returns 200 without a body. This is process liveness: it proves the HTTP
process responds, not that persistence, GitHub, voting, or upstream LLMs work.
It does not initialize governance, issue a voter cookie, or write data. The `demo`
label describes this prototype; do not infer a storage-isolation guarantee.

The checked-in Fly HTTP service check uses GET `/healthz`, every 30 seconds,
with a 5-second timeout and a 30-second startup grace period. This configuration
has not been deployed. Fly routing checks do not prove delivery to a person.
Keep the existing one-writer volume and machine configuration.
See [Fly configuration](https://docs.fly.io/reference/configuration#http_servicechecks).

## External uptime monitor — operator action

In an external uptime provider account (for example UptimeRobot), create an HTTPS
monitor for `<confirmed launch origin>/healthz` with these launch settings:

| Setting | Required value |
| --- | --- |
| Interval | 60 seconds, or the provider's available interval up to 300 seconds |
| Request | GET; valid TLS required |
| Success | HTTP 200; if supported, also validate JSON `ok: true` and service identity |
| Timeout | 10 seconds |
| Failure | Network/DNS/TLS error, timeout, non-200, or wrong body |
| Notification | Email or SMS to Adnan's explicitly confirmed destination |
| Timing | First confirmed failure, no additional notification delay; recovery enabled |

Verify the contact and attach it to this specific monitor. Confirm it is enabled
and outside maintenance windows. Do not substitute GitHub Actions scheduling or
Fly's internal check for external monitoring and recipient delivery.

Before launch, use the provider's test notification. Verify detection with a
separate disposable monitor targeting a controlled failing endpoint, then
restore that test target and verify recovery. Do not stop production or alter
the real site's data for a drill. Record monitor URL/ID, interval, exact target,
redacted recipient, failure/recovery timestamps, and Adnan's receipt. A test
notification alone does not prove failure detection. Validate the real monitor's
successful recent checks separately. External probes may wake the current
autostopped Fly machine; confirm latency and account cost with the operator.

## BugSnag notifications — operator action

Confirm which BugSnag project and release stage receive errors from the actual
launch deployment. Receiving sessions does not prove error capture or delivery.
Do not add a second SDK or invent an API key in this older checkout.

In Adnan's project **My email notifications**, configure project-specific
notifications for new errors and project error spikes. Limit to the confirmed
production stage; include handled and unhandled errors and all severities during
launch. Avoid filters that hide new errors. Email preferences are per
collaborator, so configuring another user's preferences does not prove Adnan
will receive mail. See [BugSnag email settings](https://docs.bugsnag.com/product/email/).

Enable spike notifications at least two hours before launch. BugSnag establishes
a baseline during those first two hours and detects sustained increases of at
least five minutes; brief bursts and a single frequently occurring error may
not trigger it. See [spike detection](https://docs.bugsnag.com/product/integrations/spike-detection/).

Record the project URL, stage, enabled notification types, filters and redacted
recipient. Use a provider test facility where available, or a dedicated test
project/release stage and a synthetic error with no journal, vote, identity or
contact payload. Obtain separate authorization before sending test events or
messages; none were sent for this task. Capture both a new-error notification
and spike-rule evidence, including delivery where safely testable. If spike
delivery cannot be tested, mark it unverified rather than flood production with
errors. Inspect live error capture on the deployed revision before acceptance.

## Ownership and response

Proposed primary: **Adnan**. This is a proposal, not an accepted shift.
Before launch, record the launch date/time, Adnan's explicit acceptance from
launch until **00:00 America/Chicago on the following calendar date**, the
confirmed contact channel, and a named backup who has accepted escalation.
Do not guess the launch date or claim that assignment has been acknowledged.

Proposed response expectation: acknowledge within five minutes. If there is no
acknowledgment, escalate to the accepted backup using the agreed channel. The
responder checks public health and a read-only page, Fly status/logs and the
BugSnag error/release, then records impact and timestamps. Changes, rollback or
deployment require the existing operator authorization. At midnight, record
handoff or explicit extension; keep monitoring enabled.

## Acceptance evidence

- [ ] Confirmed origin, Fly app and deployed revision agree.
- [ ] External monitor checks every 1–5 minutes; failure/recovery and delivery proven.
- [ ] Adnan's new-error and spike notifications enabled; evidence and limitations recorded.
- [ ] Deployed Fly check reports `/healthz` healthy (`fly checks list -a <confirmed-app>`).
- [ ] Named primary and backup accepted the dated shift and escalation channel.

No production test writes, messages, deployment, merge, or governance changes
are authorized by this checklist.
