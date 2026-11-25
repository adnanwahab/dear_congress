# Arrival estimates for curated drafts

Every curated draft (HFL-001 through HFL-110) now shows an **estimated arrival
date**: when it could finish human review and a one-week advisory ballot on that
exact revision, if work proceeds at the assumed pace. It appears in the `/votes`
list and detail, on every `/bills/HFL-…` detail page, and on the legacy `/bills`
cards and index summary.

An arrival estimate is a planning aid. It is **not** a schedule, a commitment, a
prediction of introduction or enactment, or a change in official status. The UI
says so next to every full estimate.

## How the date is computed

`src/shared/bill-eta.ts` is a pure function of the catalog, the review ledger
(`content/bill-collections/eudaimonia-100-reviews.json`) and an `asOf` date. The
browser uses today's date; tests pin `asOf`.

1. **Cycle start.** Work starts on the Monday on or after `asOf` (UTC).
2. **Queue.** In each category, drafts that still need assignment or review queue
   in ID order. Reviewers start the next draft in every category each week, so
   the n-th waiting draft starts `n − 1` weeks after the cycle start.
3. **Remaining stages**, read from the ledger with the same approval rule as the
   editorial gate (status `approved`, a named reviewer and a review record):

   | Stage | Expected | Range |
   | --- | --- | --- |
   | Author and human editor assigned | 7 days | 3–14 |
   | Legal, evidence and fiscal reviews (in parallel) | 21 days | 14–42 |
   | Publication review and publisher attestation | 7 days | 3–14 |
   | One-week advisory ballot closes | 7 days | 7 |
   | Queue cadence between starts in a category | 7 days | 3.5–14 |

4. **Range.** The earliest date uses every low value, the latest every high value.

Completed stages are skipped. A missing, duplicate or stale record (different
revision or jurisdiction) fails closed: every stage counts as outstanding, as in
`editorialGate`. The ballot stage always remains, because estimates do not read
ballot records; once a publisher opens a ballot, that ballot's own closing time is
the real date.

With today's ledger (all 110 drafts unassigned) and work starting Monday
2026-11-23, expected arrivals run from **Jan 4, 2027** (first draft in each
category) to **Mar 8, 2027** (tenth). The full range is Dec 20, 2026 to Jun 14, 2027.

To change the pace, edit `ARRIVAL_MODEL` in `src/shared/bill-eta.ts`. The UI renders
its assumptions from the same object, so the explanation cannot drift from the math.

## What did not change

No catalog text, revision, review record, vote, ballot, publication or receipt is
read differently or written. HFL identities stay separate from Helios goals,
citizen proposals and repository ballots. Governance defaults, quorum, checks,
auth and merge policy are unchanged; see [launch-merge-policy.md](launch-merge-policy.md).

## Validation

- `bun test src/shared/bill-eta.test.ts`: dates for pinned `asOf` values,
  per-category queues, Monday cycles, ledger progress, fail-closed records,
  purity and formatting.
- `scripts/verify-bill-catalog-ui.tsx` (run by `bun test`): every card and `/votes`
  entry shows an estimate; detail pages show the panel, stage dates and disclaimer.
- `bun test`, `bun run typecheck` and `bun run test:routes` pass in this workspace.

Human review of wording and assumptions is still required before merge.
