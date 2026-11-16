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

## Public guide

`/documentation` (alias `/docs`) explains participation and trust limits in
plain English. Copy lives in `src/client/public-guide.ts`; the November 12 design
report remains unchanged in a collapsed historical appendix. When behavior changes,
update the guide together with privacy/participation wording and the focused guide
contract test. Spanish translation approval and critical-copy synchronization follow
[the SHE-318 review workflow](docs/reviews/SHE-318.md); do not label unreviewed
translations approved. See [SHE-361 validation and remaining review](docs/reviews/SHE-361.md).

Game-loop neutrality and consent review, regression coverage, and pending human
privacy/minors/accessibility checks are tracked in [SHE-544](docs/reviews/SHE-544.md).
New rewards must extend that checklist and its stance-parity tests.

## Appearance

The shared Civic Synthesis title cycles through rainbow hues with a 12-second CSS
animation. Light and dark themes use separate brightness levels; reduced motion
keeps the ordinary title color, and forced colors uses system colors.

The shared civic header cycles **System → Light → Dark**. System is the default;
explicit choices override the OS and persist in this browser across routes and
reloads. Storage-blocked browsers retain a choice only for the current page.
A pre-paint script sets `html[data-theme]`; its exact CSP hash is verified against
both browser builds. Update that hash if editing the inline initializer.
Supported browsers reveal theme changes from the button in 400 ms. Reduced
motion and browsers without View Transitions swap immediately.

## Local discovery

Home includes My area’s civic challenges: choose a browsing jurisdiction and policy
category without an address or device location. Prompts and policy examples are
explicitly fictional; no verified local challenge feed is connected. Each example
retains its sample ID, background-source provenance and link into Feed. Browsing
preferences do not establish residency or voting eligibility. See
[the SHE-460 review](docs/reviews/SHE-460.md) for validation and remaining acceptance.

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

The `/outcomes` page separates simulated outreach activity from policy measurements.
Its expandable measurement prototype uses explicitly synthetic transit metrics,
including mixed results, pinned baseline/source history and missing or stale data.
The read-only time explorer offers day/month/year/decade scales with UTC range links, keyboard controls, Ctrl + wheel and touch pinch. Historical measurements, planned demo milestones and synthetic future scenarios occupy separate labeled lanes; no historical policy measurements are supplied. See [docs/outcome-timeline.md](docs/outcome-timeline.md).
No verified implemented policy is registered. These fixtures never feed synthesis.
See [SHE-315 scope and remaining acceptance](docs/reviews/SHE-315.md).
The evidence freshness calendar adds a monthly agenda and dated ledger with
review reminders, unknown-date labels and copyable/printable provenance.
Age never determines validity. Its sourced example establishes repository
fixture contents only; mixed results remain synthetic.
See [SHE-678 implementation and validation limits](docs/reviews/SHE-678.md).
The Outcomes contradiction compass compares explicit fields within matching scope,
period and claim kind. It keeps both revisions and human-review states, with no
automatic truth selection. Bundled examples include a primary text citation, a
synthetic conflict and a missing source. See [SHE-677 validation and remaining
acceptance](docs/reviews/SHE-677.md).

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

### Local sandbox Undo

Sample proposal filters, comparison selection/order, sponsor-card moves, household
presets and synthesis sliders offer one-step **Undo local change** for 20 seconds.
Each new action replaces the previous Undo; focus or hover pauses expiry and
leaving gives another 20 seconds. Restoration is announced in place. History stays
in page memory and clears on navigation/reload. Synthesis restoration requests
only an unsaved preview. Public posts, advisory votes and saved synthesis commits
retain their separate explicit workflows.

### Scenario presets

The `/synth` paired-world explorer offers demo housing and transit presets using
only the existing reviewed law parameter allowlist. Selecting a card shows exact
implementation-strength changes, seed, synthetic population and horizon before
an explicit run. Reset local scenario cancels pending work and restores the
page’s starting parameters without saving data. Flood remains unavailable until
its simulator mechanism is reviewed. These synthetic worlds are separate from
actual outcomes, real votes and resident records.

### Scoring rule sandbox

`/synth` includes a read-only fixture comparison at `POST /api/synthesis-rule-preview`
with `{ weights, lambda, budget }`. It displays normalized weights and score/selection
changes across all three packages using public sample journals and deterministic
simulated residents. It does not use live resident inputs or approve/activate rules.
See [SHE-310 scope and remaining acceptance](docs/reviews/SHE-310.md).

### `POST /api/synthesize` notes

- `preview: true` returns the same plan calculation without changing `lastPlan`, challenger streaks or the database file. Synthesis sliders request previews after a 180 ms pause; Synthesize commits the plan. Preview results use the existing re-rank motion and reduced-motion preference.

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

Fly deployments must retain `TRUST_FLY_PROXY=1`: the public browser uses HTTPS while Bun receives the proxy request over HTTP. Missing this setting rejects valid submissions with “Use a same-origin submission or a cookie-aware API client.” Keep it unset for direct local HTTP. Origin host/port checks remain exact; do not trust caller-provided forwarded-origin headers.


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

## Synthetic ingestion experiment

`bun run benchmark:ingestion 1000` exercises a disposable durable queue with
synthetic content and the existing local journal extractor. This local-only
microbenchmark establishes no daily capacity or production-readiness claim.
See [scope, tests, report units and limitations](docs/ingestion-spike.md).

## Reproducible audit sample

A fabricated tally and aggregate score can be replayed offline and downloaded
through `/api/audit-samples`. See [sample replay guide](docs/audit-reproducibility.md)
for the CLI, expected snapshot ID, verification limits and remaining SHE-321 work.

## First-visit learning

Choose **Five-minute civic adventure** on the home page, or open `/?quest=1`.
Five untimed, skippable chapters follow journal → need → comparison → proposal →
future. Optional fictional examples stay inside the guide, separate from live
records. No data fetch, vote, public post or identity disclosure is required.
Chapter, completion and sample preference resume via `civic_adventure_v1` in local
storage; blocked storage allows page-only use with a notice. Restart resets that
learning progress. `/?quest=1&walkthrough=1` presents equivalent content at once.
Ordinary stage links appear after completion or in the walkthrough and explicitly
leave the guide. No automatic advancement or animation is used.
See [SHE-410 review notes](docs/reviews/SHE-410.md) for validation limits.

## Guided demo

Choose **▶ Play the demo** on the home page, or open `/?demo=1`. The read-only
sample tour visits Published, Feed, Votes, Draft, Sponsors, Outcomes and Map in
about 60 seconds plus page loading time. Space pauses/resumes, ←/→ step, and Esc
exits. Clicking the page pauses; exit the tour to interact with voting or saved
work. Map runs only its local illustrative simulation. No votes or drafts are saved
by the tour. See [SHE-331 review notes](docs/reviews/SHE-331.md) for validation limits.

## Official legislative metadata (opt-in first slice)

A single-bill Congress.gov metadata importer and separate read-only lane are
available on `/published`, `/feed` and `/outcomes`. No official records are seeded.
See [operator usage, provenance and remaining acceptance](docs/legislative-metadata.md).
Metadata check times do not verify full bill text or current legal status.

## Public journal discovery

`/journal` defaults to public submissions, excluding entries flagged seeded or
synthetic. This is provenance labeling, not verified-human participation; legacy
unflagged records remain subject to SHE-271 review. Origin, need, inclusive UTC
calendar dates and cursor are shareable query parameters. Browsing uses GET
`/api/entries?discovery=1&origin=public&need=food&from=2026-11-01&to=2026-11-13`.
The opt-in discovery mode filters before cursor pagination; existing API clients
without it retain their original feed contract. Sort is most recent, with ID ties.
A removed/invalid cursor asks the reader to clear filters rather than restarting
silently. `/journal?entry=<id>` reads only that publicly available original,
independent of browse filters; need links retain its ID. Hidden/private records
remain excluded by the existing server projection. Live snapshots remove hidden
items but never inject entries into a filtered page. Refresh for new entries.

Dates include UTC and freshness is a rolling seven-day interval. Existing native
simulated-story grouping preserves expandable originals within each page; runs
can split across pages. Jurisdiction remains unavailable because no consented
public broad-jurisdiction field exists. Coordinates, source text and authors are
never used to infer locality. Draft and explicit publication flows are unchanged.

## Topic hubs

Open `/topics` to search the existing taxonomy, or share `/topics/transit`,
`/topics/housing` and `/topics/childcare` directly. Topic chips on sample cards
open hubs; filter controls also offer hub links. Hubs display stored sample
extraction lineage and catalog policy alternatives separately from fictional
workflow proposals and their background references. Topic association alone is
never presented as source derivation. Workflow links retain `topic` and
`proposal`; the return link and browser history preserve the topic context.

`GET /api/topics/:id` is a read-only, uncached projection. It only includes public,
non-synthetic repository-seeded stories with existing taxonomy labels, and omits
location, ownership and moderation metadata. Human journals are excluded because
legacy records lack explicit topic-curation consent. Held/hidden/deleted stories
are excluded on the next read. No new classification or data migration occurs.
Official legislative observations have no reviewed topic binding, so hubs show
that stage as not yet available rather than matching bill titles by keyword.
See [SHE-357 review and verification limits](docs/reviews/SHE-357.md).

Topic hubs also include a zoomable, scrollable curiosity constellation with an
equivalent list and source/next-step previews. It projects the same typed hub
data without new inference or writes. Solid sample-lineage edges and dashed
illustrative catalog edges remain separate; metric nodes are targets only.
Official bills and verified measurements remain unavailable until reviewed source
bindings exist. See [SHE-531 review](docs/reviews/SHE-531.md).

### Plan budget ledger

Synthesize includes an annual allocation table and cumulative waterfall. Arithmetic
uses integer USD millions; the ledger reports any difference from the engine's
hundredth-billion headline rounding separately. Unknown/negative/nonfinite costs,
unsupported precision, duplicate items, mismatched totals and infeasible plans
close the ledger with an error rather than publishing a valid summary.

Current costs are illustrative assumptions. Estimate dates, independently sourced
fiscal evidence, net incremental spending and calibrated uncertainty ranges are
unavailable and labeled accordingly. No contingency reserve is modeled. Filtering
changes visible rows, never totals. Budget-excluded options preview the existing
engine's deterministic replacement IDs with item and dollar diffs; other exclusion
gates cannot be overridden. Committing creates only a local ledger revision;
original synthesis selections and stored plans remain unchanged. Downloadable
`plan-budget-v1` JSON freezes that fiscal summary, not private scoring inputs or a
replayable civic decision. See [SHE-360 validation and limits](docs/reviews/SHE-360.md).

Embedded needs and jurisdiction maps are optional. Rankings and jurisdiction
priorities remain available as text while map assets load or fail. Missing styles
show a map-free notice; resource failures and a 10-second initial loading timeout
remove the failed map and offer a manual retry. Retry affects only that map.
Developer console diagnostics report initialization, resource or timeout failures
without copying provider URLs or raw errors (which may contain credentials).
Check provider configuration, connectivity and CSP when investigating those logs.

Production acceptance also requires the [release parity contract](docs/release-parity.md):
HTTP trust/identity checks and rendered desktop/mobile smoke checks against the
served origin. Failed or missing evidence is NO-GO; SHE-280 retains the human
rollout and rollback decision.

Accessibility browser checks and the required manual screen-reader journey:
[acceptance evidence guide](docs/accessibility-acceptance.md).
Run `bun run test:a11y` after installing its separate browser tooling as documented.
Automated results do not establish full WCAG conformance or human acceptance.

## Human Flourishing draft catalog

`/bills` browses 100 curated, unreviewed draft concepts across ten categories;
`/bills/HFL-051` includes a separate legislative discussion supplement. These are
independent of citizen submissions, official bill records, sample scoring and
ballots. Search/filter URLs are shareable. See [catalog import, validation and
rollback](docs/bill-catalog.md) for deterministic import commands and review gaps.

## Sample evidence packets

Sample proposal source panels offer a citation-only evidence JSON export, with
copy/print fallback after loading. Unknown source dates and human review remain
explicit; links receive safe HTTPS syntax checks, not reachability verification.
No journals, ballots or source full text are included. Citizen/official proposal
exports, claim-level evidence and reviewed conflicting cases remain pending.
See [SHE-687 scope and remaining acceptance](docs/reviews/SHE-687.md).

## Sample advisory share cards

Share preview beside the shared sample advisory controls exports a standalone SVG
and copyable alt text after explicit review. Stance is off by default and resets
when the preview closes or the proposal changes. Cards use only repository-curated
fictional scenario fields and existing background-source caveats, with a SHA-256
content version; no identity, journals, receipts, counts or live-round data enter
the export. They label the action non-binding and not an official election.
No share endpoint, tracking, automatic posting or vote write is added.
See [SHE-535 validation and limits](docs/reviews/SHE-535.md).

## Sample proposal audio

The six-stage workflow includes a click-to-play synthetic voice explainer with
transcript, passage sources and subtitles for the selected fictional sample.
Voice availability and duration depend on the browser/OS. Tradeoff evidence gaps
are stated explicitly; background agency references are not treated as proof.
See [SHE-490 scope and validation limits](docs/reviews/SHE-490.md).

## Fictional council practice

`/votes` includes a skippable five-minute council sandbox, pending human review.
Chair, budget officer, parent and transit user dialogue and costs are explicitly
fictional. Five one-minute rounds can be paused, advanced, revisited or restarted;
selecting a practice response pauses for reflection. Full script and all options
remain available after skipping. Native buttons, radio groups and disclosures
support keyboard and touch; the exercise adds no motion, audio, account, storage
or network dependency. It does not submit votes or run policy projections.
See [SHE-413 review notes](docs/reviews/SHE-413.md) for validation limits.

## Steelman challenge sandbox

The exact-revision fictional transit argument map on Published, Votes and proposal
comparison offers optional source-backed counterargument practice. Feedback uses
an explicit self-review rubric for fidelity, evidence and completeness. AI scoring
is off; no automated truth or fairness assessment is claimed. Skip/clear is always
available. Responses stay in page memory and never alter stored votes or model
projections. See [SHE-414 review](docs/reviews/SHE-414.md) for limits and checks.

## Daily curiosity mission

The home dashboard offers a demo reading mission from the existing `/api/demo`
fictional proposal lane. Chicago calendar days rotate equally across sorted topics,
then rotate proposal IDs within each topic. Visitors may exclude one familiar topic,
Shuffle, Skip, or open Learn more and confirm they read the sample text. No political
profile, popularity signal, vote, actual bill, or model projection enters selection.
Completion is self-reported reading and stays in page memory; reloading starts fresh.
The separate daily advisory question retains its existing behavior. See
[implementation and validation notes](docs/reviews/SHE-411.md).

### Budget-balancing puzzle (SHE-412)

`/synth` includes a clearly labeled demo puzzle independent of the synthesis
packages and fiscal ledger in `PlanBudget.tsx`. Five bundled fictional programs
share a fixed $40B annual play budget. Native checkboxes support keyboard and
whole-card touch selection; totals, shortfalls and funded/deferred explanations
are text, with no motion. Two editable feasible examples illustrate different
priorities without scoring or recommending a stance. Unallocated money is allowed.

The fixture loads synchronously: there is no puzzle network/loading state or
remote failure. Invalid selections fail closed with a reset action. Over-budget
choices remain editable, but cannot pass review. State is component-local and
never enters votes, synthesis, persistence or the civic snapshot simulator API;
that API binds real plan packages rather than fictional game programs. Existing
stage navigation, source identities, ledger exports and simulation links remain
unchanged. See `docs/reviews/SHE-412.md` for audit and verification limits.

## Civic discovery sampler

Feed includes a clearly labeled, unreviewed demo sampler of five fictional policy
concepts across housing, childcare, transit, flood resilience and health. Both swipe
directions skip; native buttons provide the same action without gestures. Cards
change immediately with no motion dependency or countdown. Reading-list saves reuse
the browser watchlist with `sample` identities; Open context uses the existing draft
stage. The sampler uses `/api/demo` and never requests vote or simulation writes.
Its editorial benefit/trade-off summaries are not verified impact projections.
See [SHE-416 review notes](docs/reviews/SHE-416.md) for validation limits.

## Synthetic household story sandbox

The optional **Open household demo** control in `/synth` package household panels
compares three months of local budget events for one deterministic synthetic ID.
Both columns expose the population, seed, versioned assumptions, starting balance
and event source IDs. Only a hypothetical monthly credit differs. This is an
unreviewed teaching fixture, independent of selected packages and real votes.
The snapshot handoff API has no household event-log response; external runner
integration and calibrated policy effects remain unavailable. No resident data,
storage or snapshot writes are used. See [SHE-428 review](docs/reviews/SHE-428.md).

### Who decides? sandbox

Expand **Who decides?** below the browse-jurisdiction picker to match four sourced
Houston/Harris County/Texas/U.S. tasks to governmental levels. The selected broad
jurisdiction comes first; changing it resets the round. Answers are page-local,
with no scoring API, vote, location request or model projection. Explanations cover
overlapping authority. This educational demo awaits civic-content and accessibility
review; see [SHE-419 review notes](docs/reviews/SHE-419.md).

## Civic marble-run sandbox

Draft includes an unreviewed educational federal-process marble run after sample
proposal loading succeeds. Play/pause, previous/next and reset use native keyboard
and touch controls. Reduced motion and motion-off use manual steps; the static
all-branches decision diagram stays visible. Committee revision, failed chamber
support and delivery capacity are invented constraints, independent of sample
counts, advisory votes, official bill records and model projections. Changing the
proposal resets the run. Loading/failure/empty states use the existing proposal
loader and retry controls rather than substituting a different source.

The existing snapshot simulator models policy effects, not institutional passage;
this sandbox makes no simulator requests and links to Synthesize separately.
Process references are Congress.gov and USA.gov. This simplified path assumes
identical chamber text and presidential signature, and omits veto/override paths.
Governance remains as documented in docs/launch-merge-policy.md: disabled/dry-run
automation, quorum 10 and active kill switch by default; human review and tagged
release requirements are unchanged. No live configuration was inspected or changed.

## County event heatmap sandbox

`/map` includes a demo event heatmap sourced only from the existing local
`county-fips-v1` model. Improve the plan, then play or scrub completed revisions.
An event means one county model changed status during that revision; intensity
is 0 or 1 events per county per revision, not people, votes or measured impacts.
Separate controls show Census 2023 boundary evidence and synthetic transitions.
Every event has an inspectable model/revision/FIPS ID and selects its county.
The full selected-bucket table remains available without SVG or WebGL; reduced
motion advances manually. Restart clears the local replay. There is no network
loading or provider failure state because this view uses bundled shapes and the
local model. External simulator receipts have no reviewed county/event binding
and are not geocoded. See [SHE-435 review notes](docs/reviews/SHE-435.md).

## Goal overlap preview (SHE-453)

The exact-text-bound fictional transit ArgumentMap includes a read-only overlap
preview on the existing source, voting and comparison surfaces. Counts are wholly
synthetic, separate from browser votes, and expose subgroup denominators and two
aggregation methods. No consented real sample is connected. Small groups and rare
cells are suppressed; see [scope and acceptance](docs/reviews/SHE-453.md).

## Personal priority points

The active `/votes` and `/vote` workflow includes a personal 100-point allocation.
Drag one point between trays with mouse, pen or touch, or use labeled numeric
inputs and plus/minus buttons. Totals update immediately and cap at 100; Undo
reverses draft changes. Only **Save priorities** writes an allocation to the
existing cookie-bound `/api/votes` storage, without proposal votes or publication.
Refresh restores saved values; unsaved edits stay in page memory. Loading/error
and empty-need states do not submit. Personal priorities remain separate from
synthetic proposal responses. The token display uses no animation.

### Build-a-plan workbench

Each synthesis lane has a separate, initially empty $40B advisory construction kit.
Drag policies between Available and Workbench or use native Add/Remove buttons
with touch or keyboard. Costs use integer millions; over-budget selections remain
visible with a deterministic shortfall explanation. Rights-blocked and unknown or
invalid-cost policies cannot be added. Other policy interactions are not modeled.
Source IDs, jurisdictions and estimate caveats stay visible, with an ordered local
change log. Changes live only in component memory, reset with the package/lane,
and never call a voting, publication or synthesis write endpoint. Existing ledger
exports still describe the ledger, independently of this experiment. Motion uses
the existing typed plan transition helper and respects reduced motion.

## Optional civic sound

The shared header exposes **Sound Off** by default, with a browser-local on/off
preference and explicit tests for three original quiet PCM cues. Navigation and
read-only rule-sandbox actions use cues only during user activation. Enabling,
loading, automated demos, voting and publication are silent. Reduced motion and
motion-off suppress audio. Embedded waveforms need no network after page load;
this is not whole-app offline support. Device media volume/mute behavior remains
browser-dependent; Sound Off is the guaranteed application silence control.
See [SHE-406 review and remaining checks](docs/reviews/SHE-406.md).

## Optional haptics

Page actions (More on mobile) offers disabled-by-default browser-local haptics.
Supported Vibration API devices receive one 8 ms pulse, at most once per 120 ms,
for intentional demo card moves, recorded-model playback ticks and successful
private amendment saves. Reduced motion and hidden pages suppress requests.
No voting, policy-setting sliders, automated playback, loading or progress
notifications trigger feedback. Unsupported/denied APIs are safe no-ops; there
is no polling or permission prompt. Blocked storage keeps a page-only preference.

## Fictional facilitation practice

The draft catalog and sample workflow offer **Read the room**, an opt-in,
three-scene town-hall game. The guided demo links out to its catalog entry.
All speakers, questions and slots are hypothetical. Feedback rewards fair turns,
listening and accurate follow-up, never a political preference. Skip, Restart,
Exit and a complete text explanation are available. State stays in page memory;
no participation credit, advisory writes or stored scores are created.
See [SHE-661 verification and limitations](docs/reviews/SHE-661.md).

### Fictional clause reveal

Draft and Votes include a read-only drag comparison of illustrative current and
proposed text. A native range slider supports touch and keyboard; side-by-side
mode and complete selectable text remain available alongside background citations.
Shared prefix/change/suffix anchors align without inferring legal clause boundaries.
This demo does not display imported official legal text or publish any choice.
See [SHE-405 verification and limits](docs/reviews/SHE-405.md).

Compact sample background-source chips open on hover, focus or tap. Escape, the
Close source inspection button, or an outside tap dismisses them. Original links
open a separate tab, retaining the civic journey. These references do not verify
scenario claims: original quotations and publication dates are unavailable and
explicitly labeled; source check dates remain distinct from publication dates.

The `/outcomes` measurement area also includes a local claim-to-source anchor
candidate with versioned passages, missing/conflicting evidence and review labels.
It demonstrates application-code and synthetic fixture provenance, not verified
real policy effects. See [SHE-679 scope and remaining acceptance](docs/reviews/SHE-679.md).

## Optional Civic Chronicle crossword

The draft catalog and sample workflow offer a three-word educational crossword;
the guided demo links to it after exiting the tour. Pack 1 is bundled editorial
content awaiting human clue/source review. Play uses page memory only, requires
no signup, and never writes participation data. The grid, hints and complete-text
answers work offline after loading; institutional links need connectivity.
See [SHE-665 validation and remaining review](docs/reviews/SHE-665.md).

## Weekly civic discovery (SHE-538)

The Dashboard reuses its typed `/api/demo` payload for a read-only sample
walkthrough alongside weekly self-guided trivia and an evidence tour.
All sessions are optional and available anytime; they record no participation
and add no incentives or writes. Native disclosures support keyboard/touch;
no new animation is used. Official external calendars and hypothetical gatherings
are separately labeled. No hosted events or moderated public event discussion
are operational. See [scope and validation](docs/reviews/SHE-538.md).

## Daily question editorial queue

The daily card exposes seven dated fictional candidates and their revision IDs.
Human source/editorial approval is pending. Scheduled dates fail closed until
review is recorded; other dates retain the labeled sample rotation. The versioned
archive, Chicago timezone rules and reviewed rollback procedure are documented in
[docs/daily-editorial-queue.md](docs/daily-editorial-queue.md). Editorial scheduling
never changes an existing advisory choice or establishes official eligibility.
