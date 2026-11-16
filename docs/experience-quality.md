# Optional experience quality

Refs: https://linear.app/shel-bernstein/issue/SHE-563/joyquality-privacy-safe-delight-metrics-for-interactive-civic-journeys

The shared shell's **Experience metrics & privacy** disclosure provides an unchecked
opt-in. Consent persists in localStorage under `civic-experience-metrics-v1`; blocked
storage fails closed. Unchecking stops future sends without a reload. Do Not Track
and Global Privacy Control override consent. No SDK, third-party script, cookie,
referrer, visitor identifier or cross-site request is added. The consent code is
part of the existing app bundle; it does not load a tracking library.

## Fixed signals

| Signal | Observed meaning |
| --- | --- |
| route_ready | Incoming route ready; navigation-start through rendering/transition completion |
| route_failed / route_abandoned | Incoming transition rejected / page left before readiness |
| demo_started / demo_completed / demo_exited | First tour stop opened / final stop timer completed / explicit exit before completion |
| compare_opened | Synthesis comparison screen mounted, including reloads |
| model_completed / model_failed | Law behavior model returned a validated completed receipt / failure, timeout or unavailable mechanism |
| model_recovered | Valid completed receipt after a model failure within the mounted explorer |
| accessibility_fallback | Immediate motion update or incoming route uses reduced/off/unsupported motion |

The only dimension is `enhanced`, `basic`, or `reduced-motion`, based on API support
and the reduced-motion preference. No browser versions, user agents, opinion,
stance, proposal/law/repository IDs, route IDs, location, journal text, error text,
request contents, or receipts enter this schema. The endpoint rejects extra keys.
Route latency is clamped to 120 seconds and immediately bucketed into 0–100,
101–500, 501–2000, or >2000 ms. Raw timings are never persisted.

## Storage and dashboard

`POST /api/experience-quality` requires the existing same-origin check, a bounded
256-byte JSON body, and an independent rate budget; it never mints an identity.
Client sends omit credentials and referrers. DNT/GPC headers also suppress storage.
Like other public aggregate counters, forged same-origin requests can inflate it;
client consent is not remotely attestable. Limiter IPs stay in existing transient
security memory, not the analytics store.

The existing LaunchStats SQLite database adds one aggregate table keyed only by
UTC date, signal, capability and latency bucket. There are no raw event rows.
Retention is the current and preceding 29 UTC dates. Expired dates are deleted on
startup, read/write and hourly while the process runs. A stopped process performs
cleanup when reopened. SQLite deletion is logical deletion, not secure erasure;
operators must age out database/WAL backups within 30 days as well. Existing civic
participation metrics and their retention remain unchanged. No historical records
are backfilled or deleted by this feature.

`/admin/stats` retains its existing ADMIN_TOKEN authentication, no-store headers
and script-free rendering. The experience section shows counts by capability,
latency buckets, failure points, explicit exits and completed tasks. These are
observations, not unique visitors or a linked conversion funnel. Demo completion
can follow manual step navigation and does not certify all stops or understanding.
Window closure, lost delivery and consent changes can undercount exits/completions.
A site bounce rate cannot be inferred without visitor linkage; explicit demo exit
and pre-readiness abandonment are the limited bounce proxies. No engagement-time
optimization or political segmentation is introduced.

## Verification and release

Synthetic in-memory fixtures exercise the full event/capability vocabulary,
bucketing, expiration, protected dashboard, privacy payload rejection and consent.
No live fixture submission is needed. Existing launch metrics from merged PR #12
were audited; no SHE-563 PR was found in the repository search during this work.
The old page-view sender is present but not wired into the shared main entrypoint;
this feature does not activate or duplicate it.

Governance configuration is unchanged: disabled/dry-run, quorum 10, 24-hour
exposure, current-head checks and approval, fail-closed allowlists, active default
kill switch and separate advisory browser votes. Branch protection and production
environment settings were not changed or independently verified. Follow
[launch merge policy](launch-merge-policy.md): required checks and human approval;
production requires a human-published tagged release. This change is a review
candidate and does not establish live acceptance, understanding gains or rollout.
