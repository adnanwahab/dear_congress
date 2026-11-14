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
