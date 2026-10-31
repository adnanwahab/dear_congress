# Civic Synthesis (prototype)

A Bun + React prototype of the civic synthesis loop:

everyday is a list of journal entries from everyone
- plan is the input of function?




**Journal → need extraction → needs graph → open-ended voting → synthesis → plan**

## Run

```bash
bun install
bun dev          # http://localhost:3000 (hot reload)
bun test         # engine tests
bun run typecheck
```

State is saved to `data/db.json` (delete it or use "Reset demo" to start over).

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
- `POST /api/synthesize` `{ weights?, lambda?, budget? }`
- `POST /api/reset`

### External journal client: `publish_draft` modes

For browser clients on another origin, send:

- `Content-Type: application/json`
- `x-voter-id: <stable-client-id>` (recommended; enables per-voter aggregation)

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

## Prototype shortcuts → next steps

- **Extraction now supports LLM providers** with automatic fallback order `Gemini → OpenAI → Claude → local keyword extractor`. Set any of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (and optional model env vars `GEMINI_MODEL`, `OPENAI_MODEL`, `CLAUDE_MODEL`). If no keys are set, it stays fully offline.
- **Opinions come from 600 simulated residents** (5 archetypes, deterministic) plus your own inputs. Replace `POPULATION` with real aggregated votes.
- **Costs, support and legal details are illustrative**, not real estimates.
- **Storage is a JSON file.** The Postgres schema in the design doc (journals, needs, proposals, votes, plans, experiments, outcomes) is the natural next step.
- Not yet built: user accounts, outcome measurement / policy experiments feeding back into journals, district-level views.
