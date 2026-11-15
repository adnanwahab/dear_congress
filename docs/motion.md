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

## Read-only presenter (SHE-600)

Use **More → Present sample proposals**, or `/feed?presenter=1`. The existing six
chapter routes accept `presenter=1`; Previous/Next use ordinary links, retaining
proposal/topic context. Exit removes the presenter flag and exposes the ordinary
chapter as a separate action. The presenter mounts no advisory voting, draft
submission, tracker, live-round or outreach controls and fetches only `/api/demo`.
Synthetic labeling and source provenance remain visible. No tally determines
animation, ordering or treatment.

Blackout hides the audience slide from both display and accessibility tree while
leaving controls reachable. Zoom increases text size with reflow. Fullscreen is
requested only by its button and denial leaves a usable windowed presentation.
Tab/Enter operate native controls. With the presentation itself focused, B toggles
blackout and Escape reveals; focus is never moved automatically or trapped.
`presenter-reveal` uses the typed transition helper, reduced/off preferences and
slow timing. New input invalidates older callbacks and skips the prior transition;
unmount aborts loading and prevents late visual callbacks from changing state.
Animations never choose a route or trigger participation.
