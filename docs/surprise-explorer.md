# Surprise explorer (SHE-529)

Refs: https://linear.app/shel-bernstein/issue/SHE-529/joydiscover-surprise-me-neutral-topic-explorer

The home Dashboard uses its existing typed `/api/demo` payload. SurpriseExplorer
has no request function, writes, storage, profile or vote inputs. Its two source
types are fictional sample proposals (existing exact-ID Feed links) and the
catalog's official institutional background references. Background publisher and
scope are preserved and displayed; contents have not been freshly verified.
References do not establish proposal authority, effects or enacted law. No new
sources, official bill claims, resident journals or model simulations are added.

Each click randomly chooses among unseen results maximizing the number of changed
fields: topic, source type, jurisdiction/publisher and associated proposal. These
are equal-weight diversity hints, not political balance or representativeness.
A result identity includes source type and proposal ID. Exhaustion starts a new
round, avoiding the immediately previous result when possible. Reload clears the
round; changes to the payload remove unavailable results from display. Current
selection does not alter dashboard votes, selected proposal, source data or URLs.

The native button supports keyboard and touch/pointer activation. Focus stays on
the button; the next Tab reaches the result link. A polite status announces the
result. Loading, failure and empty states disable unavailable exploration. Refresh
failure retains previously loaded results under the dashboard's existing warning.
Controls have 44px minimum height and long source text wraps. No explorer motion
is introduced, so reduced-motion mode uses the same immediate update.

## Audit and validation

Read repository README, launch policy, catalog, motion and accessibility docs.
GitHub search found no Surprise PR. Open PR metadata includes adjacent SHE-530
swipe deck (#190) and SHE-531 constellation (#189), plus other discovery drafts.
These remain separate review candidates; this change adds only the home explorer.
Their unmerged implementations were not imported or treated as accepted foundations.

Focused tests cover pool exhaustion, repeat boundaries, diversity, exact source
and proposal links, unsafe background URL exclusion, loading/failure/empty,
interactive focus and zero requests/storage. Four focused tests pass; typecheck
passes. Full suite attempt: 478 pass / 26 fail, with HTTP fixtures failing server
startup (`EADDRINUSE` on port 0). Route smoke fails at the same bind restriction.
The full run preceded the fourth focused DOM test; that test passes separately.
Playwright invocation cannot run because the separate accessibility package lacks
Playwright. Added surprise.pw.ts covers keyboard Enter/Space/Tab, pointer activation,
focus, overflow and no writes across the existing desktop/mobile/reduced-motion/
forced-colors/reflow projects. Run on a runner with browser tooling and local binds:

```
bun test
bun run typecheck
bun run test:routes
cd tests/accessibility
npm test -- --grep 'surprise explorer'
```

Native touch, screen-reader and visual acceptance remain pending; DOM checks do
not establish them. This is an implementation candidate, not acceptance evidence.

## Governance

No governance configuration changed. Existing source defaults remain disabled,
dry-run, quorum 10, 24-hour exposure, one current-head approval, fail-closed
base/check allowlists and active kill switch. Browser advisory activity remains
separate from verified repository ballots. Source identities, PR head/base binding,
existing votes, records and receipts are unchanged. Required main checks remain
`bun test`, `bun run typecheck` and `route smoke test`, with human approval through
actual branch protection (not verified here). No merge, auto-merge, deployment,
release, production-data mutation or external message was performed. Production
requires a human-published validated tagged release. Leave SHE-529 open for human
acceptance. See launch-merge-policy.md.
