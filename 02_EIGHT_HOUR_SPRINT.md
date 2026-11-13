# Eight-hour implementation sprint (today's pilot)

**Working assumption:** small, experienced engineering team and previously accessible infrastructure. An individual engineer or missing auth/DB resources may require more than eight hours. Never skip security gates to hit the clock. Realistic alternative is a reviewable PR + staging demo, not an unsafe launch.

| Window | Task | Reviewable output | Critical gate |
|---|---|---|---|
| 0:00–1:00 | Reconcile deployed app/repo, routes and legal status; declare one pilot jurisdiction; scope P0 | `AUDIT.md` with branch/app mapping and risky endpoints | Unknown app mapping blocks production deploy |
| 1:00–3:00 | Transactional Postgres migrations; auth integration; demo/pilot data separation | Authenticated health path, schema migration, isolated demo | No public private-data endpoints |
| 3:00–4:00 | Private journal UX + server ownership + consent | Save/list/edit/delete one's private journal; share only after explicit consent | Other accounts cannot read/write it |
| 4:00–5:00 | Proposal versions and advisory ballots, history + private receipt | One current vote per account per proposal, concurrent-safe | No duplicate/unauthorized votes |
| 5:00–6:00 | Real results and outcome event ledger | Separate genuine/sample tallies and sourced outcomes | No claim of official endorsement |
| 6:00–7:00 | Authz, privacy, race, compatibility and accessibility tests | Automated results; known limitations listed | All P0 security tests pass |
| 7:00–8:00 | Staging walkthrough, rollback rehearsal, release decision | Staging URL, release checklist, deploy report | Deploy only if complete gates pass |

## Work streams, if multiple agents are available

- **Agent A (storage/auth):** schema, migrations, session integration, account ownership.
- **Agent B (journal/security):** private journal, consent flow, lock down legacy APIs.
- **Agent C (ballots/UX):** proposal versions, advisory voting, receipts, disclaimers.
- **Agent D (QA/integration):** route inventory, regression tests, safe staging, smoke tests.

File ownership must be agreed before parallel work, especially around `server.ts` and `src/client/App.tsx`; use additive modules and small commits to reduce conflicts. A single coordinator integrates and executes release checks.

## Order and fallback

1. Source mapping and privacy vulnerabilities come first.
2. If managed Postgres/auth is unavailable, **keep real submission disabled**; continue the UI prototype and PR.
3. If all legacy write endpoints cannot be secured, run isolated demo-only backend while finishing fixes.
4. If pilot vote integrity passes but journal privacy does not, ship a *read-only informational* site; do not collect sensitive journals.
5. If staging tests or deploy mapping fail, produce patch + exact blockers and stop short of production.

## Definition of done (P0)

- All private reads/writes are authorized and no legacy endpoint bypasses the policy.
- No real data in sample counts or vice versa; outcome claims are sourced or clearly marked simulated.
- User explicitly chooses to vote; journal text is never silently converted to a ballot.
- Proposal wording is versioned, with freeze-or-revote semantics documented.
- Passwordless/auth flows, logout/session-expiry, duplicate votes, deletion and concurrency tested.
- Accessibility basics (keyboard, labels, focus, error messages), mobile usability and meaningful empty states verified.
- Repo mapping proven, staging tested, backup/rollback documented, release approved.

## After eight hours

Write a short `SHIP_REPORT.md` containing exactly: implemented features, test evidence, migrations run, release hashes, target app/domain, rollback actions, observed limits, unresolved risks, and honest production state. Do not claim tasks passed without evidence.
