# Civic Renaissance landing page — design and implementation notes

**Civic Synthesis · November 18, 2026**

## What this changes

The root `/` becomes an editorial landing page for *100 Bills for Human Flourishing*. The existing functional dashboard remains accessible at `/dashboard`. The application still routes `/?house=1` to Civic House and `/?quest=1` to Civic Adventure. Existing `/bills`, `/votes`, `/proposals/new`, `/journal`, and repository-voting pages remain unmodified.

**North star:** *Imagine wildly. Govern wisely.* Help people fall in love with the possibility of better government while making the limits of every proposal unmistakable.

## Visual synthesis (inspiration, not replication)

- **Observable** (https://observablehq.com/) — editable, explorable explanations; a live-allocation notebook with transparent inputs and outputs.
- **Stripe** (https://stripe.com/) — precise layout, polished gradient fields, purposeful call-to-action hierarchy, concise interface copy.
- **Reflect** (https://reflect.app/) — generous whitespace, calm reading rhythm, quiet type, connected ideas.
- **Stripe Press / The Origins of Efficiency** (https://stripe.press/book/origins-of-efficiency) — large editorial type, archival/schematic motifs and a considered print feel.
- **HUMAN.md** (https://www.human-md.ai/) — personal manifesto voice rather than corporate slogans; a human being makes the final judgment.
- **Three.js Journey** (https://threejs-journey.com/#webgpu-tsl), **WebGPU.com** (https://webgpu.com/) — a playful, depth-rich interactive-futures visual language. The present orbit graphic is lightweight CSS; it is not falsely represented as a WebGPU renderer.
- **Y Combinator** (https://www.ycombinator.com/) — simple statements, one obvious next step, builder-first usefulness.
- **Cerebras Inference** (https://www.cerebras.ai/inference) — responsiveness, immediate feedback and clear numeric display; *no invented performance benchmark*.
- **Anduril** (https://www.anduril.com/) and **NVIDIA** (https://www.nvidia.com/en-us/) — restrained mission-control and computing-system visual language in a single dark panel, without militarized imagery.
- **Coursera Plus** (https://www.coursera.org/courseraplus/) — an approachable guided four-step journey.
- **Congress.gov** (https://www.congress.gov/) — bill IDs, search/filter, draft-vs-official status, and provenance.
- **United Nations** (https://www.un.org/en/) and **WHO** (https://www.who.int/) — public-interest context, dignity, readable definitions and clear uncertainty.
- **insitro** (https://www.insitro.com/) and **Regard** (https://regard.com/) — evidence-rich scientific interfaces, and the principle that human experts remain in control.

These are design references only. Do not use their trademarks, logos, artwork, endorsements, product metrics, or proprietary interface assets.

## Content integrity

- All 100 bill IDs, titles and proposals come from the existing `src/shared/bill-catalog.ts` backed by `generated/eudaimonia-100.json`; there is **no second catalog** or arbitrary replacement of original bills.
- HFL-059 (*Public Arts and Music Act*) and HFL-090 (*Public Futures Simulation Act*) are linked as existing curated drafts.
- The concept of a large public R&D funding moonshot is prominently shown as a **new concept not in the original 100**.
- The original catalog remains unreviewed and is **not** represented as enacted legislation, an official public ballot, fully legally reviewed or costed.
- The Civic Lab uses 100 **hypothetical priority points**, never dollars, allocations by lawmakers, performance data or outcome forecasts. Arts and research sliders use the first two categories; health and learning split the remainder 60/40. All four always sum to exactly 100. State is local; nothing is sent, recorded, voted or saved.
- Linked proposal actions reuse existing routes and permission flows. The landing page does not silently enable catalog ballots or circumvent editorial review gates.

## Hierarchy

1. Editorial hero with depth/gradient orbit and explicit mission.
2. Genuine catalog counts (100 originals, 10 thematic clusters).
3. Arts / science / future-simulation examples, with the research concept separately labeled.
4. Four-step learning and civic participation journey.
5. An interactive, non-predictive priority sandbox plus three data-integrity explanations.
6. Full searchable 100-bill explorer, with accessible category chips and detail links.
7. One clear invitation to propose a new idea.

## Motion and accessibility

- Semantic headings, main landmark, labels, visible status, button states and keyboard-operable sliders.
- Includes a reduced-motion preference and has no required WebGPU dependency.
- On smaller screens, content stacks; canvas/graphics are not required to access information.
- Keep the existing skip link, privacy/consent flow, and bottom navigation.
- Do not use color alone to distinguish policy status.

## Review checklist

- `bun run typecheck`
- `bun test src/server/pages.test.ts` and relevant client tests
- `bun run test:routes`
- Test 390px, 768px, and desktop layouts.
- Keyboard-only navigation and `prefers-reduced-motion` acceptance.
- Check root `/`, `/dashboard`, `/?house=1`, `/?quest=1`, `/bills`, `/bills/HFL-059`, and `/proposals/new`.
- Confirm all 100 catalog entries remain unchanged and all bill links resolve.
- Inspect preview/test evidence before merging to the deployment branch.

Standalone HTML has been separately smoke-tested in Chromium with 1440px and 390px viewports, no JavaScript exceptions, no horizontal overflow, responsive sliders and catalog filtering. The integrated React build and CI **remain to be verified** in the pull request.

