# Outcome time explorer

Refs: https://linear.app/shel-bernstein/issue/SHE-397/joymotion-time-zoom-from-legislative-draft-to-long-run-outcome

The stage route `/outcomes` owns the explorer in `WorkflowScreen.tsx` (there is
no `Outcomes.tsx`). Its local fixtures are independent of tracker storage,
participation, API measurements and synthesis. No verified historical policy
measurement is supplied: that lane states the gap rather than inventing evidence.
Planned milestones and long-run scenario checkpoints are explicitly synthetic,
with source/version labels; they imply neither scheduled government action nor
predicted benefit. The adjacent measurement prototype retains its source history.

Day, month, year and decade are fixed elapsed windows of 1, 30, 365 and 3652 days,
centered on the same UTC instant. They are duration windows, not calendar bins.
Five ticks show the window, including time for sub-day precision. Zooming out
restores context; earlier/later move half a window. Center navigation is bounded
to 1900–2100. `timeCenter` (ISO UTC) and `timeScale` survive reload and retain
proposal, topic, motion, other query parameters and hash. Invalid links fall
back to the default range. Popstate restores the range; gestures replace the
current URL to avoid filling browser history. The visible link can be copied.

Buttons work on touch and keyboard. Focus the range for +/−, Left/Right and Home.
Ctrl + wheel changes scale without intercepting ordinary scrolling. Two-finger
horizontal pinch changes scale after 45 pixels; vertical scrolling remains native.
Touch cancellation clears the gesture. Browser-reserved accessibility gestures
may take precedence; all operations remain available through 44px buttons.
`time-zoom` uses the shared typed transition helper, including snapshot skipping,
unsupported-browser fallback and off/reduced-motion bypass. Tick entry uses the
shared scaled duration and disables under off/reduced motion.

Validation includes isolated DOM keyboard, wheel, two-pointer touch and cancellation,
URL restoration, loading, empty data, motion-off and reduced-motion checks, plus
pure range boundary/roundtrip tests. Physical mobile gesture and visual motion
review remain human review tasks; DOM tests do not establish device usability.
The live reference could not be retrieved by the web tool during this work.
Existing PR audit found no PR referencing SHE-397 before changes.

Governance is unchanged: disabled/dry-run defaults, quorum 10, 24-hour exposure,
current-head approval, fail-closed base/check allowlists and active kill switch.
No voting, publication, production data, auth or repository revision binding is
changed. Human review and required checks remain necessary under
[launch-merge-policy.md](launch-merge-policy.md); this work does not verify live
branch protections or production environment configuration.

Validation results in this workspace: `bun run typecheck` passed. The focused
range/motion/measurement suite passed all 12 tests (282 assertions). `bun test`
reported 478 passing and 26 failing tests; server-start failures show port 0
`EADDRINUSE`. `bun run test:routes` likewise could not start the server on port 0.
These required checks need rerunning in an environment that permits server binds.
No PR, external message, merge, release or deployment was created.
