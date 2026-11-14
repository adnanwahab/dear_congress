# Production parity contract (SHE-353)

The SHE-280 human release owner must resolve the reviewed release tag to its full
40-character SHA, then check the served production origin against that SHA.
Do not substitute the current main SHA for the approved tag. The existing
human-published release workflow binds both gates to its validated tag commit.
`/healthz` is liveness only. `/version` already exposes image-generated commit,
UTC build date, repository and environment without runtime secrets.

Run HTTP parity with:

```sh
bun scripts/verify-release.ts https://civic-synthesis.fly.dev APPROVED_TAG_SHA
```

Install the isolated browser harness and run against the same origin and SHA:

```sh
npm install --prefix /tmp/release-browser --no-package-lock --no-save playwright@1.56.1
/tmp/release-browser/node_modules/.bin/playwright install --with-deps chromium
PLAYWRIGHT_MODULE=/tmp/release-browser/node_modules/playwright/index.mjs bun scripts/verify-release-browser.ts https://civic-synthesis.fly.dev APPROVED_TAG_SHA
```

The browser gate checks desktop 1440×900 and mobile 390×844 layouts, the two home
choices, navigation, the exact fictional transit argument map, separate unverified
and synthetic categories, unavailable verified participation, privacy and journal
routing, and a real unknown-route 404. It uses fresh contexts and blocks non-GET/
HEAD requests including telemetry. It never casts a vote or publishes a journal.
This checks the currently available advisory prototype, not verified eligibility.

Both commands exit nonzero on failure. Any failed or missing report is **NO-GO**;
the human owner investigates and considers restoring the previous immutable image.
Rollback is never automatic. Recheck the restored image against its original SHA.
The workflow uploads only release-parity HTTP/browser JSON reports, including on
failure: fixed check paths/stages, response status, and pass/fail. No response
bodies, headers, cookies, exception messages, screenshots or traces are retained.

For SHE-280 evidence, attach both reports and the workflow run link, approved tag
and SHA, UTC check time, confirmed production origin, operator, and human go/no-go
and rollback decision to its rollout record. This repository change does not post
to Linear or establish live acceptance. Browser failure after HTTP success still
blocks acceptance. Repeat across machines during rollout: one response cannot
prove fleet convergence. Identity is traceability, not signed attestation.

The existing release-only trigger, PRODUCTION_RELEASES_ENABLED hold, human review,
required checks and tagged-release policy remain intact. No deploy authorization
is supplied by this gate. See launch-merge-policy.md and source-recovery.md.
