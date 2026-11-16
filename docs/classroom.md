# Independent classroom lesson

Refs: https://linear.app/shel-bernstein/issue/SHE-845/cs-l100031-create-an-independent-classroomdemo-mode-with-no

`/classroom` is an anonymous, shareable teaching route, linked from the draft
catalog. Compare, evidence, simulation and discussion are visible in one page;
no vote, identity, saved ballot or completion gate is involved. All examples
are explicitly fictional and the operator is labeled independent and non-binding.

The route returns before App's live journal provider, tour and participation
navigation mount. It imports only its lesson CSS and the existing page-memory
NegotiationTabletop. It uses no account state, civic records, repository ballots,
policy snapshot API or official legislation. The source identity remains
`adnanwahab/dear_congress`, fixture `fictional-six-households.v1`; existing
records and receipts are untouched. Catalog IDs are not repurposed as lesson IDs.

The two alternatives each cost $4,000 using different grant/eligibility choices.
All incomes and arithmetic assumptions are disclosed. Fiscal inputs are not
measured outcomes. Missing empirical, funding, administrative and legal evidence
is explicit. The simulation has a separate disclosed baseline; Reset restores it.
Native sliders, section links and text work without animation. The existing
optional unsigned JSON export is a local download, never publication. Sharing
`/classroom` opens the starting lesson; changes remain in memory until reload.

Usefulness and comprehension are open human evaluation tasks. Educators can ask
learners to distinguish arithmetic from real evidence and identify missing groups,
then ask what helped or remained unclear. No telemetry, names, political stance
collection, reward or participation claim has been added. Classroom accessibility,
native mobile/keyboard use and learning effectiveness still require human review.

## Audit and validation

Repository README, bill catalog docs, launch merge policy, App routing,
PolicyComparison and NegotiationTabletop were inspected before implementation.
GitHub connector PR searches for classroom and for SHE-845/lesson/classroom in
adnanwahab/dear_congress returned no matches. The CLI search could not reach
api.github.com. No existing matching PR was identified; this is not a claim that
all unrelated PRs were reviewed.

Focused tests cover direct server metadata routing and mounting the actual App
route with forbidden fetch, EventSource and storage writes, plus comparison
contents, slider changes and reset. The production route smoke list includes
`/classroom`. Typecheck and both focused tests pass. Full `bun test`: 751 pass / 26 fail;
HTTP fixtures cannot bind a server in this restricted environment (EADDRINUSE,
port 0). `bun run test:routes` fails at the same server startup before assertions.
These checks must pass in CI before acceptance. Passing DOM tests alone does not
establish human acceptance.

## Preserved merge policy

No governance, quorum, authentication or check configuration changes. Source
defaults remain disabled/dry-run, quorum 10, 24-hour exposure, one current-head
approval, fail-closed base/check allowlists and active kill switch. Advisory
browser choices do not authorize repository merges. Required main checks remain
`bun test`, `bun run typecheck` and `route smoke test`, with actual GitHub
protection requiring at least one human approval; live protection settings were
not verified here. A human-published validated tagged release is required for
production. No merge, deployment, external message or issue status change is part
of this work. Keep SHE-845 open pending human acceptance.
