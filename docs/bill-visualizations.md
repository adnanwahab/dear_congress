# One visualization per draft law

Each of the 110 HFL editorial draft proposals has a **small, independent, versioned scene definition** in `content/bill-visualizations/HFL-NNN.json`. The UI reads a generated JSON manifest (`src/generated/bill-visualizations.json`) and uses the canonical bill catalog for actual policy text. This avoids copying legal claims across 100 scenes or loading 100 renderers at once.

## Repository organization

```
content/bill-visualizations/HFL-001.json ... HFL-110.json
src/generated/bill-visualizations.json    # deterministic manifest; commit this
src/client/LawVisualization.tsx           # shared renderer: source-grounded steps
src/client/LawCarousel.tsx                # focusable, scrollable, deep-linked viewer
src/client/law-carousel.css               # layout + scroll-snap, no WebGL
scripts/build-bill-visualizations.mjs     # seed, validate, rebuild
src/shared/bill-scenes.test.ts            # complete coverage and revision tests
```

A typical file:

```json
{
  "schema": "civic-synthesis/bill-visualization/v1",
  "billId": "HFL-051",
  "sourceRevision": "<the canonical catalog SHA-256 revision>",
  "layout": "systems",
  "motif": "community",
  "focusDimension": "Relationships",
  "accent": "#f6be96",
  "curation": "seeded-from-catalog"
}
```

The scene is deliberately **not** a second source of legal text. The renderer reads the source bill's `problem`, `proposedChange`, `metrics`, `safeguards`, and `dimensions` fields. Four layout templates are available: `journey`, `comparison`, `systems`, and `timeline`. The geometry communicates the editorial logic, never measured effect sizes or policy approval.

## Edit or add a scene

1. Change a single law's JSON file (`layout`, `motif`, `accent`, `focusDimension`) and set `curation` to `human-curated` if an editor actually reviewed the visualization. Never infer a claim, score, map, budget or voting outcome from a tag.
2. Keep `sourceRevision` pinned to the matching `bill.revision` in `src/generated/eudaimonia-100.json`. If the bill changes, review its illustration and update its version pin. CI rejects stale pins.
3. Run `bun run visualizations:build` and commit both the per-law JSON and the regenerated manifest.
4. Verify with `bun run visualizations:check`, `bun test src/shared/bill-scenes.test.ts`, `bun run typecheck`, and `bun run test:law-carousel`.

To seed **missing only** definitions for newly imported HFL laws, run `bun scripts/build-bill-visualizations.mjs --seed`. Existing custom designs are never overwritten.

## Browsing

The expanded collection has eleven illustration categories. HFL-101–HFL-110 use seeded, revision-pinned illustrative scenes; no simulated outcomes, evidence scores or public support are implied. The legacy generator path includes `eudaimonia-100` for stable source provenance, but the current collection title and count are 110.


Open `/bills?law=HFL-051` to focus a specific law. The gallery respects the main catalog search/category filters and preserves them when navigating. With focus in the gallery, Left/Right and Page Up/Down move by one; Home/End jump to the first/last; arrow navigation wraps. The thumbnail strip supports horizontal scroll, touchpad gestures and mouse wheel scrolling over the strip; touch devices may swipe on the large scene. Buttons and links are semantic and keyboard accessible.

Only **one** full visual is rendered. All 110 previews are lightweight text buttons; no canvas, iframe, third-party media, map tiles or network requests. If richer per-law animations are developed later, lazy-import the active law's renderer and prefetch only its neighbors, storing compressed thumbnails as **build outputs/CI artifacts** instead of committing bulky screenshots or videos.

## Critical editorial distinction

The 110 catalog entries are unreviewed editorial policy concepts, **not** introduced bills, enacted laws, endorsements or public ballots. The visualization uses a proposed-change flow and candidate success metrics; it is not a forecast, simulation validation, funding estimate or evidence of actual public support. This gallery is read-only.
