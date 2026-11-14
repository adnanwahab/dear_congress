# Accessibility acceptance evidence

Run against disposable local sample data only:

```sh
bun install --frozen-lockfile
npm install --prefix tests/accessibility --ignore-scripts --package-lock=false
cd tests/accessibility
npx playwright install --with-deps chromium
cd ../..
bun run test:a11y
```

The separate browser tooling package pins Playwright and axe integration versions;
its transitive dependencies are currently resolved at install time. The app's Bun
lock remains unchanged. Registry access and Chromium installation are required.
The runner starts a production build on localhost:3107 with temporary databases,
no inherited service credentials and merge disabled/dry-run/kill switch active.
It refuses to reuse an existing listener. SIGINT/SIGTERM remove its temporary state.
Never substitute a production URL or production database for this runner.

CI checks all 13 named public routes at 1440px, 390px, reduced motion, forced colors
and 720px reflow (the CSS viewport of a 1440px screen at 200% zoom). Reflow testing
is not actual browser magnification: perform actual 200% zoom manually as well.
Each route checks one main, one top heading, keyboard skip activation and the next
visible focused control, then runs axe. Critical/serious results fail the job;
all other findings are retained for review. No rules or elements are excluded.
A separate Tab/Enter journey searches sample proposals, reads the evidence-bearing
vote page, saves one advisory choice, checks confirmation and returns without an
extra vote. These checks do not establish that all controls are reachable.

Download the CI `accessibility-evidence` artifact: JSON summary, HTML report,
per-route full axe JSON, screenshots and failure traces. Attachments identify
route/project; the Actions run identifies the commit. Missing browser evidence,
a failed job or a missing artifact is not a pass. Human maintainers should require
`accessibility acceptance evidence` in branch protection in addition to the three
existing checks; adding this workflow does not configure GitHub protection.

No exception allowlist is implemented. A serious finding blocks this gate until
fixed. Any proposed exception must record the exact route/state/rule, affected
users, workaround, expiry, issue and human reviewer against the current revision;
this document alone cannot waive a failed check.

## Manual screen-reader review (required before acceptance)

Record commit SHA, date, reviewer, OS, browser/version, screen reader/version,
viewport/zoom, pass/fail notes and screenshot/report paths. Use VoiceOver with
Safari or NVDA with Firefox; a second combination is recommended. Do not mark a
review complete based on automated scans, screenshots or simulated DOM tests.

1. Start the isolated runner above. Open `/`, use only Tab/Shift-Tab/Enter/Space
   and screen-reader navigation. Hear the page title, activate Skip to main
   content, and verify one main and logical headings. Repeat on `/feed`, `/votes`,
   `/published`, `/journal`, `/needs`, `/synth`, `/map`, `/draft`, `/sponsors`,
   `/outcomes`, `/documentation`, `/account`. Confirm visible, unobscured focus.
2. In Feed, search for housing and change topic filters. Hear the result count,
   find the proposal, inspect its source and evidence and enter Votes. Confirm
   navigation did not submit. Read the advisory/unverified/synthetic distinction,
   choose Support and hear the server-confirmed status once. Return to Feed;
   verify the proposal identity and no unintended resubmission.
3. Repeat with network offline when saving. Hear the uncertain/error status,
   recover network and use the explicit exact-choice retry. Confirm the final
   acknowledgement and preserved choice. Never infer success from button color.
4. In Journal, inspect each input's name/instructions, required validation and
   error announcements using synthetic text only. Verify no accidental submit
   from unrelated controls. In phone navigation open More, traverse forwards and
   backwards, close with Esc, and confirm focus returns to More. Repeat for the
   search dialog and verify focus cannot escape an open modal.
5. In Map, use the county search/list instead of hovering. Confirm equivalent
   selected-county requirements, status and numerical commitments are available.
   In Needs/Synthesize read rankings and jurisdiction lists without the canvas.
   Read chart values and provenance without relying on color or animation.
6. Repeat the full Feed → Votes → return journey at actual browser 200% zoom,
   390px width, reduced motion and OS high contrast. Check clipped text, consent,
   status, focus visibility and horizontal page overflow. Local table scrolling
   must remain operable. Capture every public route and any failing state.

Manual result: **not performed**. Add a dated reviewer record here or link a
review artifact; keep acceptance pending until one full journey has been reviewed.
Automation supplies evidence, not a guarantee of full WCAG conformance.
