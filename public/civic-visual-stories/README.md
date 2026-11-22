# Civic Synthesis visual-story assets

The HTML files in this directory are the user's original standalone interactive demonstrations:
- `latency.html`: mail/network latency and a hypothetical learning loop
- `constitutions.html`: 1,000 ideas to a reviewable plan
- `world.html`: MAGI-inspired deck.gl particle globe
- `helios.html`: Three.js civic intelligence / human review illustration
- `clocks.html`: four nested government-process clocks
- `why.html`: decision provenance graph
- `consensus-grid.html`: MAGI-styled deck.gl world hexagon map at `/visual-lab/consensus`
  (three illustrative nodes vote on H3 sectors; see note below)

The React landing page displays one at a time inside a sandboxed iframe.
The server also sets a CSP sandbox so opening a demo in a standalone tab does
**not** grant it the civic site's origin or cookies. All data is synthetic;
the demos must never be interpreted as recorded votes, approved policies,
verified real-world impact, or production database writes.

The demonstrations depend on external libraries served over HTTPS. Keep the
sandbox, file allowlist, CSP, and explicit illustrative-data labeling intact.
The editable copy reference is `docs/civic-visual-stories-copy.md`.

`consensus-grid.html` is the one exception to fully synthetic data: hexagon
heights are real GeoNames populations for cities of 100,000+ (via the
`all-the-cities` package, aggregated to H3 resolutions 1 and 2, land outlines
from Natural Earth via `world-atlas`), inlined in the file. The three node
votes are adjustable illustrative rules, not recorded votes or policy.
