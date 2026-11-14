# Native law behavior playback in Civic Synthesis

## Purpose and entry point

After a user captures a frozen plan with **Simulate realities** on /synth, Civic Synthesis now mounts **LawBehaviorExplorer** directly in the UI. The law-to-model loop is:

1. Choose one reviewed law mechanism (bus frequency, construction costs, permit capacity, or fixed upzoning).
2. Edit **implementation strength** in 25% increments when the underlying HBL mapping supports numeric-factor interpolation.
3. Send a bounded request to HappyBearLandia POST /api/law-behavior. This is a separately modeled synthetic scenario; the frozen civic package is **not** applied.
4. View paired, same-seed aggregate time series and up to 12 matched synthetic resident/household actor states at each actual model checkpoint.
5. Play/pause, scrub exact recorded time, inspect what individual simulated actors did differently, edit again and rerun. The original full-strength comparison is retained as a reference.
6. Unsupported mechanisms show no effects, and stale responses are ignored. This loop does not publish legal amendments, alter votes, or change a package’s model parameters unless a reviewed mapping exists.

It renders actual worker-produced data natively in React. There is **no iframe, screenshot processing, fabricated actor motion, or heuristic model of arbitrary free-text legislation** in this new viewer.

## Contract and privacy

- Provider: versioned HappyBearLandia hbl-law-behavior-receipt.v1 read-only receipts. This contract is implemented in HBL draft PR #316.
- Allowlisted request: lawId 11–100, integer seed 0–4294967295, population <=60, numeric implementationStrength 0..1.
- Provider bounds the model to 720 population minutes or 12 city months, and returns <=100 checkpoints. Requests share existing per-IP/global simulation admission limits and provider concurrent-work limits.
- Origin-scoped CORS allowlist includes https://civic-synthesis.fly.dev and https://dear-congress.fly.dev. No cookies, journal text, votes, user IDs, source snapshot payloads or private entries are sent.
- The receipt uses an allowlist of model metrics/actor fields and cannot expose raw engine snapshots.
- The consumer checks schema version, comparison identity, nondecreasing-free time order and actor bounds before displaying a result. No results are presented when the data cannot be verified.

## Verification

- Consumer: bun run typecheck, bun test src/client/LawBehaviorExplorer.test.tsx, and regular bun test / route smoke CI.
- HBL provider: bun test test/law-behavior-api.test.js test/law-behavior-playback.test.js; real-browser worker tests exercise the source model/slider and tracked actor playback.
- Manual staged acceptance: deploy HBL first after maintainer approval, then Civic Synthesis; freeze a plan, choose law 83, run 100% and 50%, verify the baseline matches and the tracked actors/aggregate values are actual observed engine states. Test that CORS denial and provider outages show an error, not a fake successful simulation. Test keyboard and 320px responsive layout.
- A simulation snapshot and settings are reused for navigation provenance; the separate reviewed behavior sandbox always says it is **not a simulation of the exact user-edited bill**.

## Future integration needed for a true legislation compiler

To wire a *particular* policy amendment into the HBL simulation rather than a law reference sample, add a versioned consent/authority-safe compiler that maps clauses to explicitly reviewed engine levers; validate the mapped input against the published model contracts and retain an auditable amendment revision ID, seed, original base run ID and exact clock. Build controlled legislative drafting → parameter mapping → diff receipts → model rerun → same-world actor timeline → reverse/redo. Any unsupported text must result in an explicit unavailable status, not a simulated benefit.

Synthetic model differences cannot verify future real-world outcomes, representative citizens, causal policy attribution, rights, or official enacted status. This is not an electoral-advice engine or a prediction.

This feature is **draft, not deployed**. It depends on the simultaneous review/merge of HBL PR #316 and the Civic Synthesis PR; release approval remains human-owned.

## November 14 launch increment

The native sandbox is now the first action on `/synth`; package capture is no
longer required. Existing package synthesis/scoring remains under an advanced
section. The allowlisted control produces a `civic-reviewed-amendment.v1` local
discussion recipe (proposal/demo ID, revision, original/edited value, units,
permitted increments, seed, fixed horizon and eventual model version). It does
not persist a legal amendment, submit a ballot, or claim to compile prose. The
existing proposal editor remains available for unmodeled discussion drafts.

Public reciprocal context uses `civicContext=1`, `lawId`,
`implementationStrength`, `seed`, `population=24`, `proposalId`, `revision`, and
optional `modelVersion`. Only validated fields are copied. Same-page reproducible
links restore inputs without running automatically. Model-version mismatches,
invalid context, wrong-request receipts and malformed actor/metric records are
rejected. Runs have a 45-second deadline, cancellation and retry. Provider
HTTP 429/504/network errors are explicit failures, never fabricated results.
The CSP permits the exact HBL HTTPS origin while retaining the other restrictions.

The inspector selects the same actual synthetic ID in both branches. WHY shows
recorded checkpoint/parameter/provenance and explicitly says that project/event
IDs and a validated causal explanation are unavailable in this v1 receipt.
Nothing invents causal evidence missing from the provider.

Browser acceptance is reproducible with two disposable local servers:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CIVIC_TEST_ORIGIN=http://127.0.0.1:4399 \
HBL_TEST_ORIGIN=http://127.0.0.1:4498 \
node scripts/verify-law-launch-browser.mjs
```

This test forwards the exact production-origin API request to the **real local
HBL endpoint**, retaining the Civic CSP and rendering genuine model receipts.
It does not prove production deployment/CORS parity. It checks 100%→50%, identical
baseline, actor/time selection, WHY, revision-preserving share/reopen, invalid
mechanisms, version mismatch, 320px, keyboard focus and reduced motion. Server
state must be disposable and governance disabled; the test never votes.

### Executed candidate evidence (2026-11-14)

- `bun test`: **536 passed, 0 failed**, 106,478 assertions across 131 files.
- `bun run typecheck`: passed.
- `bun run test:routes`: passed using production HTML/bundled assets and disposable data.
- `node scripts/verify-law-launch-browser.mjs` with the two loopback origins:
  passed, **3 real HBL requests**, identical baseline for seed42 at100%/50%,
  actual actor/time rendering, WHY limits, revision2 link reopen without autorun,
  unsupported context rejected, mismatched model version rejected, 320px/reduced
  motion and keyboard focus, **zero page errors**. Screenshot inspected at
  `/private/tmp/civic-launch-320.png`. This is local integration evidence only.
- Chromium emitted pre-existing, nonblocking CSP warnings about optional inline
  speculation rules. The simulation endpoint is allowed only at the exact HBL
  HTTPS origin; no broad CSP exception was added to silence those warnings.

### Preserved civic flows and remaining launch gaps

Source audit confirms `/votes` already links HBL PRs/issues and Dear Congress /
Digital Pensieve PRs, separated from civic proposals; no duplicate navigation
implementation was needed. `WorkflowScreen`, `ParticipationNotice`,
`AmendmentEditor`, `ArgumentMap`, `ProposalProvenance` and `PolicyMeasurements`
retain advisory support/opposition/uncertainty, original comments, fictional vs
sourced labels and simulated-outcome boundaries. Full tests exercise those
existing paths; this increment did not submit any vote or civic proposal.

Remaining: a saved civic proposal revision is not yet bound server-side to this
model sandbox. The local recipe and safe URLs do not prove that arbitrary legal
text was modeled. The v1 receipt lacks event/project IDs for a full causal
inspector. Production SHA/CORS/release parity, staged deployment/rollback,
complete external accessibility matrix, real user study and human release
approval remain unverified. Demo outcomes are not institutional follow-through.

The focused existing `/synth` accessibility suite also passed **5/5 projects**:
desktop1440px, mobile390px, reduced motion, forced colors, and720px reflow.
It used the installed Chromium1243 executable via a temporary local config;
assertions/rules were unchanged. Keyboard skip/focus, one main/heading and axe
critical/serious violations all passed. The full multi-route/advisory-write
accessibility suite was not run; no autonomous vote was submitted. The existing
harness output-directory overlap was corrected by moving raw test artifacts to
`artifacts/accessibility/test-results`, separate from the HTML reporter.

### Why the live build SHA remains a release gate

`src/server/build-identity.ts` reads the image's `build-identity.json` once;
a missing/invalid lowercase40-character commit becomes `null`. It intentionally
does not accept runtime SHA overrides. Current `Dockerfile` already passes
`ARG BUILD_COMMIT` into `scripts/write-build-identity.ts`, which fails if the SHA
is invalid. The tagged-release workflow already supplies the validated tag commit
as `--build-arg BUILD_COMMIT` and verifies the serving version. Therefore current
source wiring is present: the observed production null commit cannot establish
which older/different build path or image is running. Inspect the actual image /
release provenance before rollout; do not fabricate a commit or override `/version`
at runtime. Current checked-in Fly target is `civic-synthesis`. No deployment ran.

Optional browser tooling/report assets were retained outside the app checkout
after accessibility verification. The repository's existing CSS source audit
otherwise scanned nested Playwright dependency/report CSS and exceeded its
5-second timeout. No assertions or test deadlines were weakened; the final
unchanged full suite passed536/536 after separating external tool artifacts.
