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

## Graphics quality (SHE-749)

Participation & privacy → Graphics quality (`/account#graphics`, also in More)
selects Auto, Lite, Standard or Cinematic independently of motion. Optional
MapLibre needs/jurisdiction maps use pixel-density caps of 1, 1.5 and 2,
bounded by device density. Auto starts Standard; 60 active render intervals
above 24 ms lower one tier. Three sample windows below 18 ms raise one tier.
Idle gaps over 100 ms and hidden documents discard samples. Stats beside each
ready map expose effective tier, density and average active frame interval;
these are render-event intervals, not GPU benchmarks or a device capability claim.
No polling render loop or telemetry is introduced. All tiers have a zero
optional-particle budget because this app currently has no particle renderer.

Choose Lite manually for low power; there is no reliable universal OS low-power
signal. Choice uses the separate `civic:graphics` browser key; blocked storage
retains only the current-page choice. Changing quality updates the existing map
without remounting forms, changing filters, dropping features or writing civic data.
The existing `motion.ts` reduced-motion/off behavior remains authoritative for
animation. Theme and first-run demo are unchanged.

Fallback: missing WebGL, provider errors or a 10-second load timeout retain the
existing map-free text summaries and manual map retry. Quality cannot repair
network/provider failures. Needs and jurisdiction facts remain in ordinary text
at every tier; no geographic feature or political option is culled for performance.
Run `bun test src/client/graphics.test.ts src/client/optional-map.test.tsx` for
adaptation, persistence failure, cleanup and map fallback regressions. Physical
low-end phone profiling and a keyboard/touch/screen-reader journey remain human
acceptance checks; automated timing fixtures do not establish device performance.
