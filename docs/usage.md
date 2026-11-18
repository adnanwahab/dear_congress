# Using Dear Congress · Civic Synthesis

**A practical guide for community participants, policy teams, and contributors.**

[Back to the project vision](../readme.md) · [Live prototype](https://civic-synthesis.fly.dev/) · [Source repository](https://github.com/adnanwahab/dear_congress)

> **Status and scope:** This is an experimental civic prototype, not a government service, legislative voting system, or official legal source. Screens can include fictional participants, synthetic outcomes, speculative research drafts, and features not yet fully implemented. Check every page's status labels and authoritative sources before using material for a policy decision.

## Explore the prototype

The live experience is hosted at [civic-synthesis.fly.dev](https://civic-synthesis.fly.dev/). These are **places to explore**, not a guarantee that every listed action is enabled for every visitor or in production.

| Start here | What to look for |
| --- | --- |
| [Home](https://civic-synthesis.fly.dev/) | Project introduction and links to civic journeys |
| [Bills and ideas](https://civic-synthesis.fly.dev/bills) | Exploratory policy ideas, drafts, and their labels and sources |
| [Voting](https://civic-synthesis.fly.dev/vote) | Explicit **advisory** proposal participation, where available |
| [Needs](https://civic-synthesis.fly.dev/needs) | Shared needs, grouping or prioritization experiments, and data caveats |
| [Outcomes](https://civic-synthesis.fly.dev/outcomes) | A mix of experimental visualizations and clearly labeled measured or synthetic data |
| [Public documentation](https://civic-synthesis.fly.dev/documentation) | Participation rules, privacy limits, and terminology |

Before relying on a result, check **whether the participants are real or fictional**, whether the sample is representative, what legal jurisdiction it covers, when its sources were updated, and whether it is a draft, official measure, or an enacted change.

## For community participants

1. **Find a topic you care about.** Browse a proposal or need and read the existing description, evidence, affected groups, alternatives, and uncertainty.
2. **Check the proposal's status.** Drafts, examples, public comments, and official legislation are different things. The site does not automatically introduce or pass laws.
3. **Participate explicitly if an advisory ballot is available.** Review the specific proposal version and voting window; choose Support, Oppose, or Unsure. A journal entry or comment is never automatically a vote. Some demos and votes are not verified unique people.
4. **Offer constructive feedback.** If the interface allows a comment or amendment, describe the goal, objection, desired change, and possible trade-offs. Never share someone else's private information.
5. **Revisit the updated text.** Substantive changes should be shown as new proposal versions, with new participation rather than silently carrying forward old votes.

**Privacy:** Keep journals private unless you choose otherwise using the available consent controls. Opting in to one use (e.g., needs aggregation) does not authorize another (e.g., publication or model processing). See [Privacy and security](../05_PRIVACY_SECURITY.md).

### Consensus Workbench (planned)

The [Consensus Workbench](../readme.md#next-feature-consensus-workbench-proposed) is a **proposed** workflow, not a promise that it is live. It aims to let participants explain *“What would need to change for you to support this?”*, compare HELIOSAI-assisted amendment suggestions with the original text, retain unresolved objections, and cast a fresh advisory vote on each substantial revision.

HELIOSAI suggestions would remain drafts for **human review**; the model would not infer a vote, claim a mandate, or change law.

## For legislative and policy staff

**This is a research-preview workflow. Do not treat these steps as an available government integration or an official constituent-contact channel.**

1. **Start with the jurisdiction and the actual decision.** Identify federal/state/local authority, legal constraints, applicable deadlines, and the office or committee responsible.
2. **Inspect the original source.** Check primary law or bill text, cited research, proposal version, effective dates, and whether examples are synthetic.
3. **Review the alternatives, not just the headline vote.** Examine the no-change baseline, costs, implementation capacity, beneficiary/burden distribution, major objections, and unanswered questions.
4. **Distinguish sentiment from an electorate.** Advisory participation can reveal concerns but is not automatically a representative poll or an official vote. Look for the denominator, eligibility rules, and provenance.
5. **Discuss a bounded pilot only when legally appropriate.** Ask what authority allows it, how outcomes would be evaluated, which safeguards are required, and how the pilot would stop or be revised.
6. **Share a staff-reviewed brief.** Use verified citations, fiscal assumptions, side-by-side amendment text, unresolved dissent, and a clear status label. A downloadable, office-ready policy brief is a **product opportunity**, not a confirmed existing export.

**Suggested policy brief structure:** problem and jurisdiction; current law; proposed change and clause diff; evidence with source dates; fiscal and implementation impacts; affected communities; objections and alternatives; simulation assumptions; legal/ethics review; next responsible action; verification status.

For additional exploratory ideas, read [Reform concepts](../08_REFORM_CONCEPTS.md). For source/method limits, see [Data model and proposed API](../04_DATA_MODEL_AND_API.md).

## For developers and contributors

### Run locally

Requires [Bun](https://bun.sh/) and Git.

```bash
git clone https://github.com/adnanwahab/dear_congress.git
cd dear_congress
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### Verify changes

```bash
bun test
bun run typecheck
bun run test:routes
```

The last command runs the isolated production-router smoke test. Check feature-specific docs and tests for additional acceptance requirements. A successful local test does not itself certify production readiness.

### Contribute responsibly

We welcome civic designers, community organizers, policy researchers, accessibility specialists, statisticians, engineers, legal experts, and people who can identify harmful edge cases.

When proposing a policy idea, include:

- **Jurisdiction and legal authority:** the actual statute/rule, a primary source, and what change the responsible body can make.
- **Problem and alternatives:** whom it affects, goals, a no-change baseline, other options, and known objections.
- **Evidence and costs:** citations, source dates, assumptions, fiscal or staffing considerations, and distributional impacts.
- **Measurement and safeguards:** outcomes, privacy, accessibility, civil rights, appeal, sunset/rollback, and independent review where appropriate.
- **Status labeling:** research-only vs. advisory draft vs. officially introduced lawmaking vs. verified outcome.

For code, keep changes focused and follow [AGENTS.md](../AGENTS.md), [launch review/merge policy](launch-merge-policy.md), and applicable tests. **Do not bypass human approvals, merge protection, deployment controls, or proposal-vote safeguards.**

Do not use real private journals, authentic ballots, credentials, or official-looking tallies as demo fixtures. Never describe simulated results as measured outcomes.

### Technical references

- [Data model and proposed API](../04_DATA_MODEL_AND_API.md)
- [Privacy and security](../05_PRIVACY_SECURITY.md)
- [Private need clustering pilot](need-cluster-pilot.md)
- [Repository-development voting](repository-voting.md)
- [Launch merge and release controls](launch-merge-policy.md)

## What the project cannot do

Dear Congress does not independently establish voting eligibility, confer legislative authority, enact a law, replace official rulemaking or notice-and-comment procedures, or validate a simulation against real-world outcomes by default. The site does not turn GitHub browser preferences into authorized PR approvals. HELIOSAI and the complete Consensus Workbench remain proposed features; human review and source verification are required for consequential uses.

When you find an error in a summary, missing source, inaccessible workflow, or misleading status label, open a [GitHub issue](https://github.com/adnanwahab/dear_congress/issues) with a reproducible example that omits private information.
