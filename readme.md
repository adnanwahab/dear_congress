# Civic Synthesis (prototype)

A Bun + React prototype of the civic synthesis loop:

everyday is a list of journal entries from everyone
- plan is the input of function?

remember the future? 10 year plan

simulator visualziation - see why laws are the way they are - easier to change?


**Journal → need extraction → needs graph → open-ended voting → synthesis → plan**

## Run

```bash
bun install
bun dev          # http://localhost:3000 (hot reload)
bun test         # engine tests
bun run typecheck
bun run test:routes # isolated production-router smoke check
```

Launch review, required main checks and tagged releases are documented in
[docs/launch-merge-policy.md](docs/launch-merge-policy.md). Agents leave launch
PRs for human review and merge; analysis-only PRs must leave Linear issues open.

`bun start` builds the browser shell with production minification and code splitting.
MapLibre JS and `/maplibre.css` load only when a configured map mounts (Needs or
Synthesize), not on `/` or `/votes`. `bun test src/server/browser-build.test.ts`
checks the production shell's 250 KB gzip JS budget and deferred map assets.

State is saved to `data/db.json` (delete it or use "Reset demo" to start over).

## Measured outcomes (Harris County / Houston)

The repo includes a starter fixture at `data/outcomes.json`, so measured values appear locally without any setup.

To refresh from live public sources:

```bash
bun run outcomes:fetch
```

Runtime env vars:

- `OUTCOMES_PATH` (default: `data/outcomes.json`)
- `OUTCOMES_MODE`:
  - `off` — ignore measured outcomes
  - `shadow` (default) — keep current synthesis, but return a measured-conditions preview
  - `on` — feed measured severity into synthesis demand

Notes:

- Request-provided `outcomes` in `/api/synthesize` still override measured values for what-if runs.
- Census fetch works without an API key at low volume; set `CENSUS_API_KEY` to raise reliability.

## What's in it

| Step | What it does |
|---|---|
| **1 · Journal** | Free-text entry ("What's happening in your life?"). Extracts needs, importance, concerns and constraints. The original text stays attached, and you can correct the interpretation. |
| **2 · Needs** | Ranks shared needs by blending journal urgency with priority points. Shows the Value → Goal → Metric → Policies ladder per need, plus top priorities per jurisdiction (Houston, Harris County, Texas, US). |
| **3 · Vote** | 100 priority points, a yes/no vote on the *goal* before the policy, an open-ended "how should we get there?" box (clustered into existing ideas or turned into a new option), and 5-point stances with importance, compromise, concern and "what would change your mind". |
| **4 · Synthesize** | Scores every option (support, welfare, fairness, feasibility, reversibility, evidence) minus an institutional-change penalty, then picks a budget-constrained package. Produces three packages (Balanced, Minimal change, Most popular), each item explaining why, who asked, who disagrees, what changed because of objections, who implements it, what law changes, metrics, and a legislative-handoff JSON. Shows budget conflicts, rights-blocked options and emerging uncosted ideas. |

Hard rule: a proposal with a `rightsIssue` is never selected, however popular. The demo includes one (a durational residency requirement for vouchers) that polls at ~80% to show this.



# systemic improvement

1. Connection & community

Fund “third places” (libraries, rec centers, community kitchens) open late and on weekends.
Make it easy to close a street for block parties: one-page permits, no fees.
Expand national service for any age, with a stipend and an education credit.
Use social prescribing, so doctors can prescribe clubs, classes and volunteering for loneliness.
Allow shared meals in schools and senior centers, including intergenerational lunches.
Run neighborhood matching grants: residents propose small projects and the city funds them.
Fund adult team sports leagues the way we fund youth leagues.
Zone for front porches, benches and plazas, not just parking.
Create a national loneliness strategy with a lead official, as the UK and Japan have.
Protect and fund local news, which helps people know and trust their neighbors.



2. Time & work
11. Guarantee paid sick days nationwide.
12. Provide paid family leave, at least 12 weeks.
13. Set a minimum paid vacation floor (most rich countries guarantee 20+ days).
14. Run 4-day-week pilots in public agencies and publish the results.
15. Pass right-to-disconnect rules for after-hours messages.
16. Require predictable scheduling for hourly workers (2 weeks’ notice).
17. Make tax filing automatic: the IRS pre-fills your return and you click “accept.”
18. Cut commute time through remote-work tax neutrality and more housing near jobs.
19. Reform occupational licensing so people can switch careers and move states easily.
20. Make benefits portable so health and retirement follow the worker, not the job.

3. Housing & places
21. Legalize duplexes, triplexes and backyard cottages on most residential lots.
22. Remove parking minimums.
23. Fast-track permits: approve “by right” if a project meets code.
24. Allow single-stair apartment buildings for more family-sized units.
25. Restore boarding houses and co-living as legal options.
26. Expand housing vouchers to all eligible families, not a lottery.
27. Support community land trusts for permanently affordable ownership.
28. Make every neighborhood walkable to a grocery store, park and school.
29. Plant street trees and shade in heat-prone cities.
30. Offer a federal “starter home” path with low-down-payment loans for first-time buyers.

4. Health
31. Make sure everyone has health coverage, via single-payer, a public option or market reforms.
32. Publish real prices for all medical services, with enforcement.
33. Cap out-of-pocket costs for insulin and other essential drugs.
34. Bring mental health care to parity in practice, not just on paper.
35. Fund 988 and mobile crisis teams in every county.
36. Put a school nurse and counselor in every school.
37. Run large anti-ultra-processed food pilots in school meals.
38. Reduce medical debt and stop it from appearing on credit reports.
39. Expand telehealth permanently, including across state lines.
40. Make hearing aids, eyeglasses and dental care easier to afford.

5. Kids, youth & tech
41. Phone-free school days, bell to bell.
42. Enforce age verification or safety-by-design rules for social media.
43. Ban addictive design features like infinite scroll and autoplay for minors.
44. Bring back recess, longer recess, and playgrounds with real risk.
45. Allow kids to walk, bike and play alone (“free-range” laws, as Utah and Texas have).
46. Offer free or cheap summer camps and after-school programs.
47. Make child care affordable: subsidies, a cap at a share of income, or more providers.
48. Expand the child tax credit.
49. Make youth jobs and apprenticeships easy to find and hire for.
50. Start school later for teens (8:30 or after) for better sleep.

6. Money & economic security
51. Create an emergency savings feature in every paycheck (auto-enroll, withdraw anytime).
52. Offer baby bonds: a small invested account at birth.
53. Expand the EITC, including for workers without children.
54. Run guaranteed income pilots and study the results.
55. Ban junk fees and require all-in pricing.
56. Make cancelling a subscription as easy as signing up.
57. Cap payday loan interest rates.
58. Simplify the tax code and lower filing burden.
59. Provide wage insurance for workers displaced by trade or automation.
60. Offer free, basic public banking accounts (e.g., through the Postal Service).

7. Education & learning
61. Make universal pre-K available.
62. Use high-dosage tutoring for kids who fall behind.
63. Teach phonics-based reading in all early grades.
64. Expand vocational and trade pathways in high school.
65. Make community college tuition-free.
66. Simplify student loan repayment so it’s tied to income.
67. Allow more school choice (charters, ESAs or open enrollment, depending on your view).
68. Teach financial literacy as a required course.
69. Offer lifelong learning accounts for adults to retrain.
70. Teach civics and media literacy that’s practical, not just memorized.

8. Government & trust
71. Make government services work online in minutes (a “Digital Service” in every agency).
72. Offer one login and one form for all benefits.
73. Ban stock trading by members of Congress.
74. Strengthen lobbying disclosure in real time.
75. Use independent redistricting commissions.
76. Try ranked-choice or approval voting in more places.
77. Hold citizens’ assemblies on hard issues, randomly selected like juries.
78. Make the DMV and passport process fast (appointments, mail, digital IDs).
79. Have agencies track and publish a well-being dashboard alongside GDP.
80. Sunset old regulations by default unless renewed.

9. Nature, transport & environment
81. Put a park within a 10-minute walk of every home.
82. Build protected bike lanes and safe sidewalks.
83. Run more frequent buses: shorter waits matter more than new lines.
84. Restore intercity rail on corridors where it makes sense.
85. Reduce traffic deaths with Vision Zero street design.
86. Curb noise pollution (loud mufflers, leaf blowers, highway walls).
87. Clean up lead pipes everywhere.
88. Expand public lands access and trails near cities.
89. Improve air quality with cleaner school buses and filtration in schools.
90. Prepare for extreme heat with cooling centers and tree canopy.

10. Meaning, culture & civic life
91. Make Election Day a holiday, or move it to a weekend.
92. Fund public arts, murals and free concerts.
93. Provide free museum and park days each month.
94. Support faith and civic groups that run community services.
95. Expand public broadcasting and local creators.
96. Encourage mentorship programs pairing retirees with young people.
97. Hold “kindness” and civic pride events: community clean-ups, local festivals.
98. Reduce political polarization through cross-partisan dialogue programs.
99. Celebrate local history with markers, walking tours and oral histories.
100. Ask people regularly how they’re doing with a national well-being survey that guides policy.

Where people disagree: Many of these involve real trade-offs. Health coverage, paid leave, guaranteed income and free college raise questions about cost, taxes and the government’s role. Conservatives and libertarians often favor market fixes and fewer rules (licensing reform, zoning deregulation, school choice, regulatory sunsets). Progressives often favor stronger public programs and worker protections. Some evidence is also unsettled: researchers still argue about how much social media causes teen unhappiness versus correlates with it, and guaranteed-income studies show mixed results on work and well-being.



## Layout

```
server.ts                 Bun.serve: HTML import + JSON API
index.html                entry, bundled by Bun
src/engine/catalog.ts     needs, proposals, seed journals
src/engine/engine.ts      extraction, clustering, simulated population, scoring, synthesis
src/engine/types.ts       shared types
src/client/App.tsx        React UI (4 steps)
src/client/styles.css
```

## API

- `GET  /api/state`
- `POST /api/journal` `{ text, author? }`
- `PATCH /api/journal/:id` `{ needs: string[] }` (correction)
- `POST /api/votes` `{ votes?, allocation?, goalVotes? }`
- `POST /api/answers` `{ needId, text }`
- `POST /api/publish_draft` (external clients; supports `kind` modes below)
- `POST /api/publish_labels` `{ entryId, labels[] | needs[] }`
- `POST /api/emergent/:id/estimate` `{ costB, changeLevel, authority? }` (a voter's cost estimate for a citizen idea)
- `POST /api/emergent/:id/design` `{}` ("Make this possible": read the idea and cost it; cached on the idea)
- `POST /api/emergent/:id/variant` `{ variant: "full" | "targeted" | "phased" | "grant" | "pilot" }`
- `POST /api/synthesize` `{ weights?, lambda?, budget?, includeSynthetic?, extraEntries?, previous? }`
- `POST /api/reset`

### Scoring rule sandbox

`/synth` includes a read-only fixture comparison at `POST /api/synthesis-rule-preview`
with `{ weights, lambda, budget }`. It displays normalized weights and score/selection
changes across all three packages using public sample journals and deterministic
simulated residents. It does not use live resident inputs or approve/activate rules.
See [SHE-310 scope and remaining acceptance](docs/reviews/SHE-310.md).

### `POST /api/synthesize` notes

- `previous?: { [packageId: string]: string[] }` lets clients pass incumbents (proposal ids) per package, e.g. `{ "A": ["h_vouchers", "t_bus"] }`.
- If `previous` is omitted, the server uses persisted `db.lastPlan` (from the prior synthesis run). If none exists yet, it behaves like a fresh run.
- Response now includes, per package:
  - `changesFromPrevious: { added: string[]; removed: string[]; moneyMovedB: number }`
  - `items[].keptForStability: boolean`
  - `items[].margin: number`
  - `deferred[].margin: number`

### External journal client: `publish_draft` modes

For browser clients on another origin, send:

- `Content-Type: application/json`
- Preserve the server-issued anonymous cookie in a cookie jar; `x-voter-id` is ignored at the HTTP boundary. See the public-write security configuration below.

#### 1) Journal mode (default)
Creates a journal entry only (feeds Needs tab), and does **not** force-create a ballot option.

```json
{
  "text": "Rent went up again and the bus to work takes over an hour.",
  "author": "Jordan · East End",
  "kind": "journal"
}
```

You can omit `kind` and it defaults to `"journal"` (or `PUBLISH_DRAFT_DEFAULT_KIND` if set). If `needId` is present and `kind` is omitted, the server treats it as `"answer"` for backward compatibility.

To publish without AI or keyword inference, send `kind: "journal", inference: "none"`.
Optional `labels` (or `needs`) select catalog categories manually; omitted labels
or `[]` publish with no tags. Unknown IDs are returned in `ignoredNeedIds`.
This mode never creates needs, proposals or votes. `/journal` uses this mode.
Legacy requests omitting `inference`, and the other journal POST aliases, still
use automatic extraction; they are not the consent-first pilot. Draft text in
`/journal` stays in page memory until public submission and is lost on reload.

#### 2) Answer mode with explicit need
Treats text as an open-ended policy answer and routes through the same path as `/api/answers`.

```json
{
  "text": "Expand housing vouchers in high-cost areas.",
  "kind": "answer",
  "needId": "housing"
}
```

#### 3) Answer mode without need
Server auto-detects/creates need first, then records the answer.

```json
{
  "text": "Create evening express buses for shift workers.",
  "kind": "answer"
}
```

## Citizen ideas: "Make this possible"

A citizen idea runs through a pipeline instead of a yes/no:
**idea → clarified → costed → jurisdiction → evidence → designed → simulated → public review → in the plan.**

- **Clarify + cost.** `POST /api/emergent/:id/design` reads what the idea most likely means (LLM if a key is set, else a keyword match that says it's guessing) and picks the closest catalog program as its costing template. The idea then competes at that program's cost (`costEstimate: "designed"`, evidence capped like other unreviewed ideas). Cost precedence: reviewer assessment > voter estimates > design > provisional.
- **Versions.** Every costed idea gets nearby versions: as proposed, highest-need areas first, phased over 3 years, opt-in grants, and a pilot (`src/engine/variants.ts`). Voters pick one with `POST /api/emergent/:id/variant`; the plan weighs the most-picked version (ties → cheaper).
- **Why isn't this in the plan?** `/api/synthesize` returns `ideas[]` on each package (`src/engine/idea-report.ts`): status, the main constraint, what it scores well on, and "make it feasible" options. Each version is tested by re-running synthesis with it swapped in, so "fits" means the plan really would take it; "raise the budget" names a budget that a re-run confirms.
- **In which futures does it work?** Each version is run through the same 1,000 illustrative futures (staffing, uptake, overruns, delays, support), giving works/mixed/poor counts, robustness, budget stress and the conditions that decide it. Illustrative, not a forecast.

## Prototype shortcuts → next steps

- **Extraction now supports LLM providers** with automatic fallback order `Gemini → OpenAI → Claude → local keyword extractor`. Set any of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (and optional model env vars `GEMINI_MODEL`, `OPENAI_MODEL`, `CLAUDE_MODEL`). If no keys are set, it stays fully offline.
- **Opinions come from 600 simulated residents** (5 archetypes, deterministic) plus your own inputs. Replace `POPULATION` with real aggregated votes.
- **Costs, support and legal details are illustrative**, not real estimates.
- **Storage is a JSON file.** The Postgres schema in the design doc (journals, needs, proposals, votes, plans, experiments, outcomes) is the natural next step.
- Not yet built: user accounts, outcome measurement / policy experiments feeding back into journals, district-level views.

Repository voting: see [setup, contracts and verification](docs/repository-voting.md).

Launch monitoring: see [health checks, alert setup and on-call evidence](docs/launch-alerts.md).

## Public-write security

Before starting production, set `ANON_COOKIE_SECRET` to a persistent random secret
of at least 32 characters (for example, generated with `openssl rand -hex 32`).
Production fails closed without it. The server issues an anonymous signed
`HttpOnly; Secure; SameSite=Lax; Path=/` cookie on API responses; browser requests
use this cookie automatically. This is not verified identity. Clearing cookies
creates a new ID, so both IP and ID limits are necessary. Existing data is retained;
legacy client-selected IDs are not automatically adopted because that would allow
impersonation. Existing clients may initially see no previous choice. Plan any
legacy tally reconciliation with SHE-271 without deleting ballots or changing
proposal/revision bindings.

Non-browser clients must retain `Set-Cookie` and send `Cookie` on subsequent HTTPS
requests, e.g. `curl -c cookies.txt -b cookies.txt ...`. A stable cookie jar replaces
`x-voter-id`. Requests without cookies receive a new ID but still share their IP
limit. Cross-origin browser writes are rejected; external journal UIs should link
to the same-origin journal page for publication. Secure cookies require HTTPS;
local development browsers should use localhost. Development secrets are ephemeral.

Public write limits are per process, in memory, with a ten-minute fixed window:

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_RATE_WINDOW_SECONDS` | `600` | Window duration |
| `PUBLIC_IP_LIMIT` | `60` | Combined protected write attempts per IP |
| `PUBLIC_ID_LIMIT` | `30` | Combined protected write attempts per signed ID |
| `PUBLIC_JOURNAL_LIMIT` | `3` | Journal attempts per signed ID across all aliases |
| `PUBLIC_SUBMISSIONS_ENABLED` | `1` | Set `0` and restart to pause journal publication |
| `TRUST_FLY_PROXY` | unset | Set `1` only behind Fly HTTP proxy; configured in fly.toml |

All limits must be positive integers. Invalid attempts consume the same budget.
429 responses include seconds in `Retry-After` and a readable retry message.
Journal aliases are `/api/journal`, `/api/entries`, and `/api/publish_draft` (including
answer mode). `/api/votes`, `/api/answers`, citizen proposal publication/votes/comments, and label
edits share the combined limits. Journal input is capped at 10,000 characters,
request JSON at 64 KiB, and author at 120 characters. A three-attempt journal window
provides the minimal cooldown; the optional `website` honeypot must remain empty.
`/api/publish_labels` and `PATCH /api/journal/:id` are disabled with 403 until
ownership authorization is available. UI label correction is consequently unavailable.

The Fly HTTP proxy supplies `Fly-Client-IP`; no `X-Forwarded-For`, `X-Real-IP`, or
other client-selected header is used. Outside trusted Fly mode, the socket peer
is used and every forwarding header is ignored. Bind only IPv4 (`0.0.0.0`) to avoid
bypassing the proxy over Fly's private IPv6 network. Do not expose this listener
through another untrusted direct path with trusted Fly mode enabled. See
[Fly's public service documentation](https://fly.io/docs/networking/services/) and
[Fly support's proxy trust guidance](https://community.fly.io/t/security-guidance-verifying-fly-proxy-socket-peers-and-forwarded-headers/28891).
IP keys are HMACs retained only during the window; journal content and author are
not written to publication logs. Debug request logging defaults off.

This JSON-file application requires **one writer process on one Fly machine**.
The limiter resets on restart. Before running multiple machines/processes, replace
it with shared storage-backed atomic counters (for example Redis increment + expiry
in one transaction/script, keyed by HMAC(IP) and signed ID) and a shared transactional
application database. Independent machine-local counters or files are insufficient.
Verify machine count before rollout; this change does not inspect or alter production.

API responses include HSTS, nosniff, no-referrer and CSP. Fly's response header
configuration applies the same policy to HTML and bundled assets. Direct local Bun
HTML responses do not get the Fly headers. CSP permits same-origin scripts,
MapLibre blob workers, CARTO tile/style/font requests and Bugsnag reporting. It
blocks plugins, other framing origins, script evaluation and external scripts.
Arbitrary `MAP_STYLE_URL` hosts need explicit policy review. Inline styles remain
allowed for React/MapLibre. Frame embedding is limited to the same origin; the old
wildcard `FRAME_ANCESTORS` setting no longer grants embedding permission. CSP
configuration tests pass; actual browser tile/worker/reporting verification remains
required in an environment that permits a local server.

Journal publishing requires a visible public-content confirmation. The submit
area warns against addresses/contact details and links to removal requests; use
only the entry ID, not private text, in a public removal request. Journal text is
rendered through React text interpolation. Private browser drafts are never read
or uploaded by the journal submission path. No identity verification, CAPTCHA,
paid incentives, merge policy changes, or deployment is included.

## Privacy and removal

`/privacy` is a static notice linked from the civic and proposal footers. Public
journal responses (including aliases, state, creation responses and SSE) omit
coordinates and tile IDs. Aggregate `/api/needs/geo` cells retain the existing
0.01° grid and minimum-three-real-entry rule. Stored source identities and
coordinates are preserved; simulation snapshot responses omit location too.

New journals published through all three aliases get a private ownership hash in
`journalOwners`. `GET /api/state` includes only the current browser's
`ownEntryIds`; `DELETE /api/journal/:id` checks the signed anonymous cookie,
same-origin rule and rate limit. Legacy records are not claimed automatically.
The Journal feed offers **Delete my entry** after publication and reload.
Deletion does not rewrite independently published proposals or their source IDs.
Lost-cookie and legacy removal requests use the public GitHub link in the notice;
no private contact mailbox or guaranteed backup expiry is currently configured.

`POST /api/votes` accepts `withdrawVotes: [proposalId]` and
`goalVotes: { [needId]: null }`. Other browsers' choices remain unchanged.
Click a selected civic choice again to withdraw; option changes require
**Save votes**. Citizen-proposal response removal continues to use its existing
`choice: null` contract. Repository PR/issue ballots and revision audit history
are separate and unchanged. See [SHE-284 review](docs/reviews/SHE-284.md) for
source alignment and verification limitations.

## Launch-day metrics (SHE-286)

Open `/admin/stats` using username `admin` and the existing `ADMIN_TOKEN` as the
password, or request it with `Authorization: Bearer <ADMIN_TOKEN>`. It returns 401
when the token is absent or wrong. The page is server-rendered, uncacheable and
script-free. It shows today's counts in **America/Chicago**; refresh to update.

Metrics persist separately at `STATS_DB_PATH` (default `${DB_PATH}.stats.sqlite`)
on the same durable single-writer volume. Back up this SQLite database with its
WAL using SQLite's backup facilities. It is independent of demo reset and never
rewrites journals, ballots, identities, source metadata or PR revisions.

Collection starts when this version first runs. Historical activity is not
backfilled: legacy civic votes have no reliable daily timestamps/provenance, and
SHE-271 remains an analysis-only source-alignment finding. New accepted civic,
citizen-advisory, repository-community and verified votes are shown separately by
scope. A vote counts once per identity + target + revision + Chicago date; repeat
saves and changed choices on the same target do not increase that day's count.
Withdrawals retain earlier participation. Priority allocation counts as one budget
ballot, goal votes and proposal stances each count per target. Unique/returning
counts describe identities, not verified people; returning means voting yesterday
and today. Different voting systems and cleared cookies can count the same person
again. Automated public API submissions cannot be identified as humans.

Only newly accepted journal publications are recorded, with real, sample and
simulated counts kept apart using the server's persisted flags. Fixture seeds,
simulated population opinions, what-if runs, previews, rejected requests, comments
and draft saves do not enter real participation counts. Existing precollection
records, including ambiguous QA activity, are preserved and excluded.

First-party `/api/page-view` POSTs count browser loads, reloads and pathname changes
(including SPA navigation and back/forward). They omit credentials and record only
an allowlisted normalized route and daily count. Detail IDs collapse to route
templates. No query strings, referrers, IPs, page-view visitor IDs, new cookies or
third-party scripts are stored/added. Requests require same origin, have a 1 KiB
body limit and a separate 120-per-IP/ten-minute default budget; they do not consume
voting limits. Forwarding headers are trusted only in existing `TRUST_FLY_PROXY`
mode. JavaScript blocking, failed delivery and rate limiting can undercount views;
forged same-origin/API traffic can inflate them. These are launch signals, not an
audited census.

Vote/journal metric writes run after successful application saves. Failures leave
the saved action's response intact and flag the stats page as incomplete. A crash
between the application save and metric write can undercount; the stores are not
one transaction. Retain the existing one-writer deployment. Live source alignment,
listener-based acceptance checks and deployment are still operator work; see
[the SHE-286 review](docs/reviews/SHE-286.md).

## Journal moderation

Each journal entry has a **Report** button. Reports are saved privately and share
public write limits; reporting does not automatically hide an entry.

Set a strong random server-only `ADMIN_TOKEN` and visit `/admin/moderation` over
HTTPS. Use any username and the token as the password in the browser's sign-in
prompt. Without the token, the view and decision API fail closed. Never put the
token in a URL, client bundle, or repository. Browsers cache this authentication;
use a private window and close it after moderation on shared computers.

The admin view shows reports and held entries. **Hide entry** requires a reason,
retains the original record and source ID, and removes it from public journal
reads, live feed updates, map aggregation and future needs/synthesis calculations.
Decisions and reasons persist privately. Admin JSON decisions use
`POST /api/admin/moderation` with Bearer authentication, same-origin `Origin`, and
`{ entryId, action: "hide" | "approve", reason }`.

All journal publication aliases check text and author for common email, phone and
street-address formats before external extraction or answer creation. Matches
return HTTP 202 `{ status: "pending", entryId, message }` and are held privately;
clients must not treat this as live publication. Admin approval publishes a held
submission as a journal only, including submissions originally using answer mode.
No automatic ballot option is created from a held submission. Detection is a
conservative heuristic with false positives and misses, not complete PII detection.
Existing entries are retained without a retroactive scan; the admin can hide any
of them. Independently published proposals and existing external copies require
separate review. This uses the existing durable single-writer JSON store.

## Recovered application shell

Dashboard, map, workflow and documentation source recovered from the local application in SHE-281. See docs/source-recovery.md.

## Public build diagnostics

`GET /version` returns only the image's full commit SHA, UTC build date,
repository URL, demo mode, allowlisted runtime environment and optional Fly
release version. `/healthz` remains process liveness. Every server-rendered page
includes a small Build link using that same identity outside the React root.
Source checkouts without a manifest explicitly show unknown build identity.

Docker builds require `--build-arg BUILD_COMMIT=<full lowercase git SHA>`.
The image generates `build-identity.json`; runtime environment variables cannot
override its SHA/date. Do not use a newly generated date as an old image's date.
The existing human-published tagged-release workflow supplies its validated SHA
and runs `bun scripts/verify-release.ts https://civic-synthesis.fly.dev <SHA>`
after deployment. Mismatches fail the workflow; they do not trigger a rollback.
Keep the existing production release gate disabled until the recovery/go-no-go
owners authorize it. No release is authorized by these diagnostics.

For an operator-authorized rollback, restore the previous immutable image and run
the same verifier with that image's original SHA. Refresh the page and follow its
Build link. Verify all machines during a rolling release; a single request cannot
prove fleet convergence. A missing Fly release version is represented as null.
These fields provide deployment traceability, not artifact signatures or official
civic authority. See [build diagnostics review](docs/reviews/SHE-300.md).

## Standalone sample stages

`/draft`, `/sponsors` and `/outcomes` open the first available fictional sample
on a fresh visit. A selected sample is retained for the tab session and included
in stage links; an explicit `?proposal=...` takes precedence. An unavailable ID
shows a proposal chooser instead of silently opening a different proposal.
Loading, retry and empty states explain how to continue. Browser storage is
optional; query links still work when storage is blocked. Sponsor progress stays
browser-local and simulated. No outreach or official action occurs.

Private offline needs clustering: [pilot command and safeguards](docs/need-cluster-pilot.md).

## Guided demo

Choose **▶ Play the demo** on the home page, or open `/?demo=1`. The read-only
sample tour visits Published, Feed, Votes, Draft, Sponsors, Outcomes and Map in
about 60 seconds plus page loading time. Space pauses/resumes, ←/→ step, and Esc
exits. Clicking the page pauses; exit the tour to interact with voting or saved
work. Map runs only its local illustrative simulation. No votes or drafts are saved
by the tour. See [SHE-331 review notes](docs/reviews/SHE-331.md) for validation limits.
