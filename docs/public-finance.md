# Public finance explorer

Refs: https://linear.app/shel-bernstein/issue/SHE-730/civicplaydiscovery-interactive-public-finance-waterfall-explorer-by

Open `/bills?finance=1`. Dashboard, draft catalog and topic hubs link to this
read-only teaching fixture. Existing catalog filters retain finance query state;
topic hub entry retains the existing topic ID. Government uses the shared topic
chip; HFL-051 is a navigation link only, with no asserted funding relationship.
The existing source-status chip classes identify hypothetical and unchecked data.
No API requests, persistence, votes, official records or catalog cost fields are
created by the explorer.

The four hypothetical agencies/programs share one example period, cash basis and
USD-million unit. Each internal transfer is matched to its recipient receipt.
Consolidation counts only final spending: external 100 = spending 75 + unresolved
25. Transfers of 100, 80 and 60 are not added to spending. Unresolved amounts are
coverage gaps, not presumed balances or additional expenditures. The waterfall
uses cumulative final spending with equivalent start/end text for every row.
Filtering never changes consolidated totals. Graph validation rejects duplicate
IDs, unknown targets, duplicate recipient edges, cycles, mismatched receipts,
invalid amounts and uses exceeding receipts before displaying totals.

Search, level, selection, expanded agency IDs and low-power view use the
`financeQ`, `financeLevel`, `financeAgency`, `financeOpen`, `financeStatic` query
parameters. Controls use pushState and restore on popstate. Text view removes only
decorative bars; all controls and accounting text remain. No animation, map,
canvas, request polling or timer is used. Reduced-motion rules disable effects.
`financeData=verified` deliberately renders an empty state with no zero-total claim.
Evidence without a date is unchecked; invalid, future and over-90-day dates require
review. A check date alone never certifies invented figures.

## Remaining data and acceptance work

This is an implementation candidate for a hypothetical learning experience, not
a completed live public-finance data integration. The repository has no compatible
cited federal/state/county/city program accounting chain. Before publishing actual
figures, ingest accessible record-level citations and immutable source/agency/
program identifiers; review fiscal period, basis, units, scope, recipient matches,
pass-through timing and transfer-versus-expenditure classifications. Do not join
by name, topic or draft-bill ID. Obligations, appropriations and outlays must not be
combined as equivalent spending. Reconciliation arithmetic is not evidence review.
No current real-world finance claims are made and no remote source was ingested.

DOM tests cover empty/filter states, stale evidence, focus retention, URL restoration,
selection/expansion parity and zero network writes. Browser tests cover native
back/forward, keyboard activation, reduced motion and text parity but require the
separate Playwright installation and a runner allowing server binds. Human
screen-reader, mobile, contrast and browser verification remain required.
See [SHE-730 review](reviews/SHE-730.md) for command results and policy audit.
