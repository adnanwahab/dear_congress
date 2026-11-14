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
