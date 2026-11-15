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
