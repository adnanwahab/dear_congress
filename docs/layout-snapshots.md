# Educational layout snapshots

Open `/account#exhibit-export` from the shared navigation's Exhibit export link
(on a phone, open More). Choose Phone (390 px) or Wide (960 px), then Prepare
sample export. Download all three files together: SVG image, responsive HTML
text description, and JSON manifest. These downloads stay in the browser; no
upload, publication or application-state write occurs.

This first view exports the complete built-in public need catalog, sorted by
stable catalog ID. It shows sample goals, metrics and jurisdiction scopes, not
measured outcomes, actual participation, priority rankings or official policy.
It does not capture the current DOM. The export module accepts only a layout
preset and explicitly projects `id`, `label`, `goal`, `metric`, and `level` from
`src/engine/catalog.ts`. It cannot consume journals, private drafts, cookies,
advisory choices, account information, repository PRs or ballots. Do not extend
it to application state or screenshots without a separate privacy review.

`dear-congress-layout-snapshot.v1` records source repository
`adnanwahab/dear_congress`, item kind `public-sample-need-catalog`, source path,
layout version `catalog-layout.v1`, width, sample notice and the full exported
rows. `datasetVersion` is `sha256:` plus the lowercase SHA-256 of the UTF-8
`JSON.stringify(rows)` bytes: sorted by ID, each object's keys in the order
id, label, goal, metric, level. There is no trailing newline in the hashed input.
The source link uses main for discovery; the manifest rows and digest identify
the exact data even if main changes. This is unsigned content identity, not
source authentication or a deployed build revision.

Seed 42 is fixed; this layout has no randomness. No timestamp, locale sorting,
personalization, theme preference or motion setting affects export bytes. The
manifest is embedded in SVG metadata and displayed in the standalone HTML as
well as downloaded separately. Same catalog, preset and layout version produce
identical bytes. Phone and wide share the same dataset digest. Regression tests
pin both SVG and HTML hashes; review layout/version changes before updating
those fixtures. Pixel rasterization can vary with platform font rendering; the
contract is deterministic SVG/HTML bytes and information, not cross-OS pixels.

SVG uses a scalable viewBox with bounded lines and no external assets, scripts,
canvas, animation or font downloads. Pair the image with the HTML description
for assistive technology: it has headings, a semantic list, all goals/metrics,
source and manifest. HTML reflows at narrow widths and works offline, without
JavaScript. All layouts give each catalog entry equal styling. The ordinary
page retains the shared theme and motion foundation; static exports need no
transition and do not modify motion preferences or start/stop the demo tour.

## Fallback and verification

If Web Crypto, Blob downloads or browser policies prevent downloads, the status
message directs users to the expandable Sample description and download fallback.
Copy that complete text or use browser Print. It is an unversioned text fallback;
it must not be presented as a versioned exhibit. Retry Prepare sample export in
a browser supporting Web Crypto and Blob URLs for the full bundle. Changing
size clears stale links; replacing/unmounting the export revokes Blob URLs.
Draft text and stored choices remain unchanged.

Run `bun test src/client/layout-snapshot.test.tsx` for byte snapshots, repeat seed,
manifest/dataset binding, bounded SVG lines, cross-size information parity,
explicit public-field projection, native controls, download failure and draft
preservation. Also run the repository's full tests, typecheck and route smoke.
For manual acceptance, use Tab/Shift-Tab/Enter and a screen reader to choose a
size, prepare, hear status, download each artifact, and inspect all fallback
text. Repeat at 390 px with touch, 200% zoom, forced colors, reduced motion and
low-power/offline conditions. Open downloaded HTML offline and confirm it matches
the SVG and JSON. Automated DOM checks alone do not establish these manual results.

Governance configuration is unchanged; see [launch-merge-policy.md](launch-merge-policy.md).
No export is vote authority, a merge receipt or acceptance evidence.
