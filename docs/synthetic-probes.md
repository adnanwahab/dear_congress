# Civic journey synthetic probes

The `Civic synthetic probes` workflow proposes runs every five minutes on main,
plus manual dispatch. GitHub schedules are best effort: delayed or skipped runs
are possible. Use an external scheduler if a strict interval SLA is required.
Nothing runs continuously until a maintainer reviews and merges the workflow.

Public target: `https://civic-synthesis.fly.dev`. Chromium checks Published, Feed,
Votes, Draft, Sponsors and Outcomes with `demo-transit`, plus Journal discovery.
Every stage must render its expected title and h1, show the fictional /
illustrative / browser-local provenance notice, load demo data, and follow its
Next link retaining the sample ID. Votes must show separate unverified-advisory
and synthetic-demo headings. The journal editor must render. This establishes
sample journey availability, not verified participation or official endorsement.

Public browsing permits only same-origin GET/HEAD. Writes, off-origin redirects
and telemetry are blocked. No vote, publish, model-run or outreach action is
clicked. Reports contain fixed contract labels and pass/fail only, never response
bodies, screenshots, resident text, cookies or raw browser errors. Third-party
models and maps are outside scope.

The independent staging job boots the production router in a disposable local
instance with temporary storage, no inherited service credentials, merge
disabled, dry-run enabled and kill switch active. It writes a consent-first
fixture journal, creates a sample advisory round, casts an isolated vote, ends
the round and checks that later votes are rejected. Finally it stops the server
and removes storage. No remote staging-write URL is accepted. This does not
prove a separately deployed staging service works or establish merge authority.

After installing dependencies, run:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs bun scripts/synthetic-probes.ts https://civic-synthesis.fly.dev
bun --no-env-file scripts/synthetic-staging.ts
```

The browser dependency is pinned in tests/accessibility/package.json, outside
the app image. Jobs fail on setup or contract errors. JSON artifacts are retained
seven days, including failures. Configure GitHub failure subscriptions separately;
no recipient or notification delivery is asserted. Responders inspect the failed
path, expected title/provenance and deployed revision. There is no automatic
repair, rollback or deployment.

Acceptance requires successful deployed public checks, isolated staging checks,
observed recurring timestamps and an accepted response owner. A green run alone
is not acceptance. Preserve [launch merge policy](launch-merge-policy.md).
