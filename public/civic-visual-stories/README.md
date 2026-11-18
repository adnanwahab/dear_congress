# Civic Synthesis visual-story assets

The six HTML files in this directory are the user's original standalone interactive demonstrations:
- `latency.html`: mail/network latency and a hypothetical learning loop
- `constitutions.html`: 1,000 ideas to a reviewable plan
- `world.html`: MAGI-inspired deck.gl particle globe
- `helios.html`: Three.js civic intelligence / human review illustration
- `clocks.html`: four nested government-process clocks
- `why.html`: decision provenance graph

The React landing page displays one at a time inside a sandboxed iframe.
The server also sets a CSP sandbox so opening a demo in a standalone tab does
**not** grant it the civic site's origin or cookies. All data is synthetic;
the demos must never be interpreted as recorded votes, approved policies,
verified real-world impact, or production database writes.

The demonstrations depend on external libraries served over HTTPS. Keep the
sandbox, file allowlist, CSP, and explicit illustrative-data labeling intact.
The editable copy reference is `docs/civic-visual-stories-copy.md`.
