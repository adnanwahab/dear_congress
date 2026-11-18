# Mini Symphony PR hygiene and shared-file integration

Individual agents get an issue and exclusive approved source paths. Feature PRs on `mini/*` or `symphony/*` write per-issue plans and results to `docs/reviews/<ISSUE-ID>.md` and the Linear workpad, not shared `readme.md` or `src/client/public-guide.ts`. The integration coordinator owns shared surfaces and reconciles PRs in dependency order. An integration branch is an ownership convention, not automatic merge permission.

Generated screenshots, `.mini-symphony-evidence/`, `artifacts/`, `test-results/` and `playwright-report/` belong in trusted CI artifacts. `.github/workflows/ci.yml` already retains accessibility artifacts. Mini Symphony's local before/after screenshots do **not** automatically exist in Actions; a trusted CI capture with `actions/upload-artifact@v4` (or an approved durable evidence store) is necessary. Record browser, route, exact head SHA, successful artifact/run URL and actual test results. Deliberate golden baselines in test fixtures are allowed.

The trusted read-only `pull_request_target` PR hygiene job audits GitHub's changed-file list even for conflicted branches, without checking out or executing the untrusted PR head. PRs created **before 2026-11-17 11:00 UTC** receive warning annotations; newer PRs fail for generated evidence or agent edits to coordinator-owned files. Verify checker with `node --test scripts/pr-hygiene.test.cjs`.

Existing PR cleanup: confirm the worker is finished, preserve images/traces in a real CI artifact or durable store first, recheck current head SHA, let the trusted Git owner untrack only generated files, then resolve source conflicts and rerun verification. `.gitignore` does not remove already-tracked files; do not force-push live branches or report unrun tests as passed.

After approval, GitHub branch protection must require `PR hygiene`, normal tests and at least one human review. This change does not merge PRs, relax quorum, deploy or publish releases.
