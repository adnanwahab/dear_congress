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

In-page types: `sponsor-move`, `plan-rerank`, `proposal-change` (redline selection).
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
