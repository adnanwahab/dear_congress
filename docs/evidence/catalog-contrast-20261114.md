# Civic draft PR123 catalog contrast correction

Hosted run `43607691901` passed70 accessibility cases and failed the same catalog
journey in all five projects. Axe reported four statutory-section `h4` headings
at foreground `#56544e` on `#101820`: contrast2.36:1, below4.5:1.

The catalog and headings were unchanged by the launch increment. Its dark
palette inherited the global light-theme `h4 {color:var(--muted)}` rule. The
scoped correction makes `.bill-document h4` inherit the catalog's readable text
color. No axe exclusions, thresholds, authentication or governance changed.

Executed checks on the corrected source, November14,2026:

- Existing `bill-catalog.pw.ts` keyboard/search/history/deep-link journey: **5/5
  projects passed** in11.6seconds (desktop, mobile390, reduced motion, forced
  colors,720px reflow). Its unchanged axe checks cover `/bills` and
  `/bills/HFL-051` with no serious/critical violations and assert zero vote or
  proposal writes. Local temporary config selected installed Chromium1243 only.
- `bun test`: **536 passed,0 failed;106478 assertions**,131files,16.87seconds.
- `bun run typecheck`: passed.
- `bun run test:routes`: passed (production HTML/assets, read API,404s).
- `git diff --check`: passed.

Browser reports remain at `/private/tmp/civic-catalog-contrast-a11y-evidence`;
logs at `/private/tmp/civic-catalog-contrast-{a11y,tests,routes}.log`. These are
local results; hosted CI rerun is still required for the new revision. The prior
0028e96 build candidate is superseded; no release or production deployment ran.
