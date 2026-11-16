# Motion foundation

`?motion=slow` sets `html[data-motion=slow]` and `--motion-scale: 5`.
It scales CSS durations/delays, View Transition snapshots, counters and FLIP
animations. The choice persists in sessionStorage across same-tab navigation.
`?motion=off` disables motion for screenshots; `?motion=normal` resets the session.
Explicit query modes still work when storage is blocked. Reduced motion always
wins over slow mode. Initialization runs before the shell's incoming snapshot.

Tokens in styles.css (normal timing):

| Token | Value | Use |
| --- | --- | --- |
| `--motion-scale` | 1 (fallback), 5 in slow mode | Multiply durations and delays once |
| `--motion-fast` | 150 ms | Page crossfade |
| `--motion-base` | 260 ms | Navigation groups and directional root slide |
| `--motion-sponsor` | 480 ms | Sponsor card movement |
| `--motion-plan` | 700 ms | Plan row movement/entry |
| `--ease-out` | cubic-bezier(.2,.8,.2,1) | Navigation easing |

In-page types include `priority-history` for the read-only `/needs` time machine.
It cancels superseded transitions and invalidates pending callbacks on unmount;
recorded selection and chapter navigation remain independent of animation.

In-page types: `time-zoom` (outcome range changes), `sponsor-move`, `plan-rerank`, `proposal-change` (redline selection).
Cross-document types: `forward`, `backward`; other navigation retains the default
crossfade. Sponsor movement disables only its own root crossfade. Plan exits use
500 ms and entries/moves use 700 ms. Default navigation timings are unchanged.

To add an in-page transition:

1. Add its name to `MotionType` in `src/client/motion.ts` and call
   `runViewTransition(update, type)`. It commits with flushSync, skips unsupported
   APIs/off/reduced motion, and catches skipped visual snapshot promises. Await
   the helper when subsequent work depends on the completed update/animation.
2. Scope **each selector** with
   `html:is(:active-view-transition-type(my-type), [data-motion-type="my-type"])`.
   The attribute supports callback-only browsers and lasts until completion.
   Keep global snapshot defaults and accessibility rules inside the marked motion
   section of styles.css. Other stylesheets, including generated inline styles,
   must scope all `::view-transition-*` selectors to their type.
3. Use a scaled token or `calc(…ms * var(--motion-scale, 1))` for CSS durations
   and delays. For JS counters/WAAPI use `motionDuration(ms)` and skip animation
   with `motionDisabled()`. Scale visual cleanup timers too, so slow animations
   can finish. Keep network/polling and persistence behavior independent of motion.
4. Preserve stable names and source/package/revision isolation. Test the type,
   unsupported and callback-only APIs, off/reduced motion and slow timing. The
   motion guard rejects untyped calls and unscoped snapshot CSS outside the section.

Launch governance and human review requirements remain in
[launch-merge-policy.md](launch-merge-policy.md); this foundation changes no votes,
repository bindings, records, receipts, authentication or merge configuration.

## Civic milestone timeline

`CivicTimeline` renders an ordered, always-visible list. Citizen proposal detail
uses that proposal's `publishedAt` from its source response; institutional review
and delivery remain unknown because the source contract records neither. Dates
are never inferred from demo activity, votes, chapter position or tracker moves.
Recorded events sort by timestamp; invalid/absent dates remain undated. Small
axis markers use elapsed source time, while the list preserves readable order.
The Outcomes sample timeline is explicitly fictional and uses the existing chapter
routes with the selected sample identity. Native links retain existing navigation
and typed View Transition handling; scroll position never changes route state.
CSS view timelines enhance only recorded connectors. Unsupported browsers,
`motion=off` and reduced motion retain the full static list. No observers, pending
callbacks, submission handlers or new persistence are attached to scrolling.

Synthesis assumption changes reuse `plan-rerank` and its guarded request version.
The assumption diagram connects the edited value to matching real/blended package
spending and support figures only after a successful comparable calculation.
Unchanged values do not start counters. Its single growing connector respects
motion scale, off mode and reduced motion; the polite changed-field announcement
is independent of animation. Pending/error states infer no impact. Chapter links
and navigation remain ordinary routes, independent of diagram state.

Six-stage native navigation stores presentation state under `history.state.civicJourney`.
Each entry retains its stage, direction (when NavigationActivation is available),
proposal, search/topic/outcome/jurisdiction filters, focus path and window scroll.
Other history-state keys are preserved. Reloaded documents restore filters before
render and focus/scroll after proposal loading settles; BFCache restores on pageshow.
A removed focus target falls back to the main landmark. Restoration never clicks a
control, submits a vote, prepares a sponsor card or publishes content. Native links,
modified clicks, scrolling and unsupported-browser/no-motion fallbacks remain intact.

The routing browser matrix is `journey.config.ts` under `tests/accessibility`:
with that directory's dependencies installed, run
`bunx playwright test --config journey.config.ts` there. WebKit is Safari engine
coverage; actual Safari visual review remains a separate human check.

## Activated proposal origins

`object-navigation.ts` supplements native cross-document transitions on sample
proposal links in Published, Feed, Votes, Draft and home. `data-motion-proposal`
and `data-motion-revision` identify the displayed sample and title. The activated
anchor owns `sample-navigation-object`; the incoming matching heading takes that
name for the snapshot. Touch click and keyboard Enter use the same handler.
Modified clicks, downloads and other targets retain ordinary browser behavior.

A bounded, five-minute session record stores the source/destination navigation
entry keys and full URLs, proposal ID/title, link ordinal/label and origin viewport
rectangle. Entry pairs distinguish multiple routes to the same proposal. Returning
through browser history resolves the original anchor after native scroll
restoration. Geometry is captured for the origin record; the browser uses the
live named element's geometry for interpolation. Stored rectangles never create
placeholder content or force scrolling. No history state or scroll policy changes.

Missing/offscreen/virtualized headings or origins, changed titles/links, expired
records, blocked storage and missing lifecycle APIs keep the existing page
transition. Reduced motion and motion off omit object capture. Temporary names
are restored on completion and page restoration. This metadata contains only
sample display identity and is never a participation receipt or voting authority.
Topic badges and official legislative records keep their separate identities and
navigation behavior; this helper only matches explicit sample proposal links.

## Sample proposal mosaic (SHE-399)

Dashboard discovery uses row-major responsive tiles with occasional wide cards.
There is no dense packing, CSS ordering, randomness, dragging or perpetual motion.
Original, title and topic sorts preserve source records; compact list uses the same
cards, search, filters, sort and explicit View proposal actions. Choosing a layout
or exploring never submits a vote or publishes content.

The gallery defers result changes while a pointer is over it, a touch/press is
active, or focus remains within it. It retains keyed DOM nodes and announces
pending results until interaction leaves; background refreshes obey the same lock.
Changes use the existing typed `filter` transition, with callback-only fallback
selectors and scaled durations. Reduced motion, motion off and unsupported APIs
commit immediately once the interaction lock is released. View selection retains
the existing proposal-detail focus behavior and stage URLs.

## Semantic status dictionary (SHE-408)

`STATUS_MOTION` in `src/client/motion.ts` defines persistent text and icons:

| State | Icon | Transition |
| --- | --- | --- |
| Saved | ✓ | 180 ms icon fade after acknowledged persistence |
| Draft | ✎ | 150 ms icon fade when returning to editing |
| Syncing | ↔ | 180 ms icon fade when an operation starts; never loops |
| Updated | ✓ | 180 ms icon fade when new information arrives |
| Cited | ※ | 150 ms icon fade when a citation is attached; not verification |
| Unavailable | — | Immediate, still explanation |
| Error | ! | Immediate, still explanation; no shake or celebration |

`StateFeedback` animates only a changed state, never initial render, hover,
focus, repeated renders or changed message text within the same state. Only its
hidden icon fades; text stays visible. Unsupported WAAPI, off and reduced motion
retain identical feedback. Slow mode scales the finite effect. Parent live
regions retain announcement ownership; buttons retain native touch/keyboard
activation and focus. These indicators never initiate requests or retries.

Integrated in advisory mutation receipts, optional map loading/availability and
consent-first journal draft/submission feedback. Journal drafts explicitly remain
unsaved; moderation and uncertain publication outcomes retain their exact wording.
Saved does not mean a binding civic vote. Cited is available to citation consumers,
not inferred from arbitrary links. No data origins, revision bindings, governance
settings or publication/consent requirements change. Existing configured merge
policy remains as documented in `launch-merge-policy.md` (disabled/dry-run defaults,
quorum 10, active kill switch and human review); live settings were not changed.

## Visitor motion studio (SHE-409)

The shared header’s Motion disclosure offers Playful (the existing slides and
expressive details), Calm (150 ms route fades and still in-page details), and Off
(immediate changes). Each previews the same illustrative Journal → Needs route,
using the route’s incoming keyframes. The preview is decorative, isolated from
real and synthetic civic data, and never navigates, publishes or votes. Native
summary, radios, checkbox and replay button retain keyboard and touch semantics;
Escape closes the disclosure and returns focus to its summary. Settings remain
available in loading shells and do not depend on API data.

OS `prefers-reduced-motion: reduce` overrides every preset, including previews and
review modes, and follows live device changes. Playful is the default otherwise.
Selecting a preset applies it immediately; only checking “Remember my choice in
this browser” writes the validated preset to localStorage (`civic-motion`).
Unchecking removes that saved choice. Without consent or when storage is blocked,
choices last for the current document. Saved settings are installed before the
initial React shell/incoming snapshot, using the existing module initializer.
No new inline script or CSP exception is introduced.

The existing session/query review modes remain available. A studio selection
clears the session review override; OS reduction still wins. Calm and Off bypass
in-page JS motion via the shared helper, disable CSS decoration, and keep scroll
reveal and redline text readable. Route snapshots and the illustrative preview do
not change live DOM order, focusability, source identities or participation state.

Governance remains as documented in launch-merge-policy.md: no policy/default or
production setting was changed. Review candidates require human acceptance and
required main checks; this UI creates no verified merge authority.

Route handoff keeps ordinary anchors and browser history authoritative. The
cross-document lifecycle handler skips its previous snapshot on newer navigation,
page hide or another reveal; rejected visual promises do not replay routes. Incoming
activation focuses `#main-content` immediately when focus is still on the body,
preserving hash targets and browser-restored focus. Reduced/off motion skips the
snapshot. Navigation never invokes a submission action.

`tests/accessibility/route-handoff.pw.ts` covers native navigation/history, keyboard
activation, rapid links and rejected snapshot promises with a zero-write assertion.
Run across the accessibility viewport/reduced-motion projects. Native touch,
screen-reader announcements and throttled-device visual QA still require review.


## Cross-browser adapter (SHE-541)

The shared adapter detects `document.startViewTransition`; unavailable APIs and
startup failures commit immediately with `flushSync`. Existing component CSS/JS
motion remains available; no snapshot polyfill, click interception, history
replacement, focus movement or network delay is introduced. Theme changes remain
instant without native snapshots. Reduced motion and `motion=off` bypass snapshots.
Update callback errors still reject and are never retried.

Every native call exposes `data-motion-type` until completion, including engines
that accept options but omit transition types. Callback-only APIs retry once with
a callback; filter and theme snapshot CSS now uses the same attribute fallback as
other typed transitions. Ownership prevents an interrupted older animation from
clearing a newer animation's CSS scope. Rejected visual promises are observed
without hiding update failures.

Cross-document transitions stay a progressive enhancement of ordinary anchors:
unsupported engines perform ordinary page loads with native history/focus behavior.
Reviewed API guidance: [MDN ViewTransition](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition)
and [Chrome cross-document guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/cross-document-transitions).

For isolated browser QA, start `bun --no-env-file scripts/accessibility-server.ts`,
then `bun scripts/verify-motion-browser.mjs` with Playwright available. Set
`PLAYWRIGHT_MODULE` to its module path if installed separately. The verifier tests
Chromium, Firefox and WebKit with normal/reduced motion, forced missing APIs,
keyboard/touch activation, back/forward, skip-link focus and interrupted navigation.
Missing engines fail the command. WebKit automation does not establish Safari/iOS
acceptance. See [SHE-541 evidence and remaining checks](reviews/SHE-541.md).

## Low-power budgets (SHE-540)

The existing helper now shares `MOTION_BUDGET` with the Chromium benchmark:

| Metric | Regression ceiling |
| --- | --- |
| Incoming route frame interval p95 | 34 ms (30 fps floor; aim for 16.7 ms) |
| Observed input-to-next-paint event duration | 100 ms |
| Steady-state long task, after first second | 50 ms |
| Initial shell maximum long task | 200 ms |
| Peak Chromium compositor layers, including browser root | 24 |

`installMotion` returns a disposer. Reduced motion, an exposed battery at <=20%
while discharging, or six frame intervals >34 ms in a 30-frame input-triggered
window set `html[data-motion-budget=constrained]`. This disables decorative CSS,
snapshots, shared JS duration/FLIP helpers and new scroll reveals. Existing WAAPI
animations finish (unfinishable/infinite ones cancel). Loading outlines remain
visible and skeleton placeholders remain static. Updates, focus and native inputs
continue immediately. Charging/level and OS preference changes apply live; rendering
fallback stays latched for the document to prevent oscillation. Reload retries
normal rendering. Slow review mode cannot override constraints.

Sampling is foreground-only, bounded to 30 frames per keyboard/pointer interaction,
and never polls a battery or sends telemetry. Unsupported/denied Battery APIs retain
normal motion unless another constraint applies; there is no portable browser
battery-saver signal. No GPU/phone model inference is performed. Layer count is a
benchmark gate, not a production DOM heuristic. Long tasks and event timing are
also benchmark observations, not continuously collected production data.

### Repeatable browser gate

From repository root:

```sh
cd tests/performance
npm install
npx playwright install chromium
npm test
```

After setup, `bun run test:motion` runs the suite from the repository root.
The pinned Playwright suite starts the existing isolated production QA server with
disposable storage, no inherited service credentials and disabled/dry-run governance.
It uses Chromium, a 390x844 touch viewport and 4x CPU slowdown, then navigates
`/ → /feed → /votes` through real links. Each incoming document records its first
1.2 seconds of rAF intervals, long tasks and Event Timing; CDP observes actual layer
trees. Keyboard skip navigation and touch are exercised. Separate cases cover
battery-constrained empty search and reduced-motion pending/error/retry states.
Event Timing omits durations below 16 ms; an empty list means no observed event
crossed that floor, not zero latency. rAF measures scheduling, not GPU presentation.
CPU slowdown does not emulate an integrated GPU or thermal/battery limits.

Run five times on the same idle reference machine/browser version, saving JSON
attachments under `artifacts/motion/test-results`. Any absolute ceiling failure
blocks review. Also block a >10% rise in the median of five route p95 values versus
five base-main runs on that same machine; compare each route and motion mode
separately. Do not average layer-limit or long-task violations away. Keep raw
artifacts and environment details with the review. Baselines must be measured,
never updated simply to make a regression pass. Before release, repeat on a real
older phone/integrated GPU and inspect compositor paint/layers. Browser checks do
not establish human acceptance or authorize deployment.

Reviewed API references: [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver),
[Battery Status API](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API),
and [Chrome rendering diagnostics](https://developer.chrome.com/docs/devtools/rendering/performance).
Merge policy remains [unchanged](launch-merge-policy.md): disabled/dry-run defaults,
quorum 10, kill switch active, required checks and human review; production releases
require a human-published tag. This change touches no civic records or provenance.

## Adjacent chapter peek (SHE-591)

The previous/next edge buttons on the six chapter routes reveal catalog-only
previews. Drag inward at least 72 CSS pixels and release to expose an ordinary
Open stage anchor; navigation requires a separate tap/click. Short drags, vertical
intent, pointer cancellation, lost capture, Escape, history, page lifecycle and
window interruption discard the preview. A click, Enter or Space on a labeled
edge button provides the same preview without a drag. A live status announces
its title, description and next action; the visual preview has no controls.

Only the dedicated edge handles claim pointer capture (`touch-action: pan-y`).
Horizontal content scrolling remains native. The handles cover a narrow strip
at mid-height; browser/OS reserved edge gestures can still take precedence.
No destination component, fetch, vote or public submission runs during preview.
Open stage retains topic/proposal context and uses native anchors and the existing
`forward`/`backward` cross-document transition types. Animation never decides the
route. `motionDisabled()` removes the elastic displacement for off/reduced motion.

Run the isolated DOM integration with `bun test src/client/chapter-peek.test.tsx`.
Browser success/failure and keyboard/interruption coverage is in
`tests/accessibility/chapter-peek.pw.ts` (the accessibility Playwright suite).

## Layered proposal evidence (SHE-597)

Proposal evidence uses nested native details for observation, methodology and
uncertainty. Fine-pointer desktop layouts optionally lift opened layers with
perspective and a scaled 260 ms transform; touch, reduced motion, motion=off and
unsupported CSS retain a flat accordion. All text remains selectable in flow.
This disclosure sends no requests; existing typed proposal-change transitions
and Navigation chapter links own proposal selection and navigation. Disclosure
state resets for a different sample ID; leaving during an animation never
delays a link or submits a response.

## Stage preview lens (SHE-593)

Main navigation stage links keep their existing chapter URLs, topic and proposal
bindings. Hover (250 ms intent), keyboard focus or the separate Preview button
lazily imports authored stage summaries. These are plain React text nodes, not
HTML, screenshots, embedded routes or fetched resident data. The summary contains
no destination controls. Close preview and Escape dismiss it; blur, pointer exit,
pagehide and popstate clear it. Generation tokens discard interrupted loads.
After four seconds a failed/slow load shows a fallback while the link stays usable.
Network timeouts do not scale with motion. The fade uses motionDuration, respecting
off/reduced/slow modes without capturing or mutating route state. Existing typed
View Transitions remain exclusively responsible for their visual enhancements.
No preview action submits, votes, persists, changes history or mounts a route.

Tests: `bun test src/client/stage-preview.test.tsx`; browser success/failure cases:
`cd tests/accessibility && npm test -- --grep 'stage lens|failed lazy'`.
The existing launch merge policy, disabled/dry-run governance defaults and human
approval/tagged-release requirements are unchanged. This feature is not authority
to merge or deploy. See [SHE-593 review](reviews/SHE-593.md) for validation limits.

## County map / list continuity

`/map` keeps county FIPS selection, search, status filters, plan revision and
synthetic metric labels in one component across Map view / List view switches.
The typed `geography-mode` transition shares `county-model-<FIPS>` between the
selected public county boundary and its selected data row. Only one endpoint
owns that name in either mode. List view unmounts the SVG and focuses the data
row; Map view restores focus to its mode button. Searchable native buttons remain
available in both modes, including without the visual API or with reduced motion.
The selected row remains available outside search/status filters with an explicit
notice; it does not silently change those filters or their denominator.

Newer switches and page exit invalidate pending visual callbacks. Snapshot/API
failure falls back to the requested view. Chapter links in Navigation remain
ordinary links; neither animation completion nor mode selection submits data.
Only bundled Census county boundaries and synthetic FIPS model values are used;
this interaction requests no resident locations, geolocation or participation API.

`bun test src/client/MapScreen.test.tsx src/client/county-motion.test.ts src/client/motion.test.ts`
checks the DOM lifecycle and shared motion fallbacks. Native browser journeys
(success and visual failure, with no writes) are in
`tests/accessibility/geography-continuity.pw.ts` and use the existing desktop,
mobile, reduced-motion, forced-colors and reflow projects. Screen reader speech
and physical touch operation still require manual verification.

Civic House (`/?house=1`) reuses the typed `filter` transition for its optional
view switch and `prepareStageMorph` for ordinary chapter links. The flat default
uses no 3D transforms. Orbit is an explicit range input, with no autonomous
animation, render loop, WebGL dependency or navigation interception. Reduced
motion, motion-off and forced colors remove transforms. Failed snapshots cannot
block the view switch or stage navigation. See the README for storage/focus limits.

Existing merge policy is unchanged: disabled/dry-run defaults, quorum 10,
24-hour exposure, current-head checks and approval, protected-base evidence,
active default kill switch and human review. Browser choices are advisory;
production requires a human-published tagged release. This implementation does
not inspect or attest live protection/environment configuration.
