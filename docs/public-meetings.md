# Public meeting calendar — SHE-464

Feed, Published and Sponsors include a separate meeting lane below the existing
jurisdiction picker. Meeting topic filtering is independent of fictional proposal
filters. The read-only `GET /api/meetings` returns `MeetingsResponse` from
`src/shared/meetings.ts`, with no-store caching. Missing storage means empty
coverage, not absence of scheduled meetings; corrupt records return 503. Refresh
clears previous records so failed reloads cannot appear freshly verified.

## Local operator ingestion

Review the original organizer notice, identify the responsible public body, and
confirm each date and agenda against that notice. Use a stable source-specific
`id`, not a proposal ID. Record the human reviewer in `verifiedBy` and the actual
review timestamp in `checkedAt`. This is an operator attestation, not automated
source authentication. Do not import demo/test fixtures into the public lane.

Create an array of `PublicMeeting` records with: `id`, `title`, `jurisdiction`,
`topics` (strings), `organizer`, HTTPS `sourceUrl`, `verifiedBy`, ISO `checkedAt`,
`startsAt` (ISO timestamp with explicit timezone or null), and `agenda`
(`{ text, sourceUrl }` with an HTTPS URL, or null). Exact jurisdiction names
match the existing picker: Houston, Harris County, Texas, United States.
An empty topic list means topic unavailable. Never guess a time, agenda or topic.
Use null when a time or agenda has not been published.

For an explicitly reviewed **disposable local** snapshot:

```sh
MEETINGS_PATH=/tmp/civic-meetings.json bun scripts/import-meetings.ts /tmp/reviewed-notices.json
MEETINGS_PATH=/tmp/civic-meetings.json bun dev
```

The importer validates the complete snapshot and atomically replaces only that
meeting file. Default path is `data/public-meetings.json`; no civic DB, votes,
receipts, repository identities or governance data are touched. Replacement is
intentional full-snapshot semantics: include all desired records; omissions remove
old/cancelled notices. Run one operator writer. No scheduler, upstream fetch,
production import, authenticated public write endpoint or source archive is added.
The snapshot file is trusted operator input, not cryptographic provenance.

## Consent and freshness

Times display explicitly in UTC. A source older than 24 hours is stale; future
checks are unavailable. Warnings update every minute, and Refresh reloads the
snapshot. Importing a calendar does not subscribe to changes. Source URLs remain
visible, including when agenda or time is missing. Missing times disable export.
Only clicking Download creates an ICS file. The unchecked reminder option adds a
30-minute VALARM only for that record/export. No email, push permission, server
subscription or automatic browser export occurs. Users remove imported reminders
in their calendar app. Re-import behavior depends on the calendar client.

## Verification and limits

`src/shared/meetings.test.ts` covers validation, duplicate IDs, unsafe URLs,
timezone conversion, missing dates, freshness, ICS escaping/folding, default-off
alarms, empty API and failure behavior. `src/client/public-meetings.test.ts` runs
an isolated DOM journey for loading, retry, source/agenda warnings, jurisdiction
and reminder isolation. Native selects, checkboxes, links and buttons retain
keyboard semantics; controls have 44px targets, wrapping text and no added motion.

Still required before full acceptance: human review of real organizer notices,
automated source adapters if broader ingestion is desired, native keyboard and
touch testing at 390px and 200% zoom, reduced-motion/forced-colors and screen-reader
checks, and import/reminder verification in supported calendar clients. DOM tests
are not native browser or assistive-technology acceptance evidence.

Governance remains disabled/dry-run with quorum 10, 24-hour exposure, one
current-head approval, strict majority, fail-closed allowlists and active default
kill switch. No merge policy was changed. Main requires bun test, bun run typecheck,
route smoke test and human approval; remote protection was not reconfigured or
verified. Human review and a human-published tagged release remain required.

### Workspace validation (2026-11-14)

- Existing PR searches for SHE-464 and meeting/calendar returned no matches.
- `bun run typecheck`: passed.
- Focused meeting, stage-state and outreach tests: 7 passed, 0 failed. The
  meeting DOM test also verifies downloaded alarms are absent by default and
  present only after opting in.
- `bun test`: 480 passed, 26 failed. Server-dependent tests cannot start Bun.serve
  in this restricted workspace (`EADDRINUSE`, port 0). No remaining DOM regression
  failed in this run. Full suite acceptance remains pending in a server-capable environment.
- `bun run test:routes`: blocked by the same Bun.serve startup error before route
  assertions; the new meeting endpoint smoke assertion has not run successfully.
- `git diff --check`: passed. The live reference could not be opened by the web
  tool; no live-browser parity, touch, screen-reader or reduced-motion acceptance
  is claimed. Production data and existing before screenshots were not modified.
