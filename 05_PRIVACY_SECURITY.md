# Privacy, security, eligibility and abuse safeguards

## Non-negotiable rules

1. Private by default. Journal creation never publishes a body automatically.
2. Separate consent for `aggregate` civic need sharing, `public` verbatim sharing, and processing by an external LLM. Silence means no consent.
3. No automated inference of a vote from a journal, comment or sentiment. Voting is an explicit, revocable advisory action during an open window.
4. An `x-voter-id`, cookie, local storage UUID or email address alone is **not** verified unique-human identity or voter eligibility.
5. No public account-to-choice linkage; no raw journal text in public endpoints, logs, SSE or exports unless separately approved and published.
6. Limit synthetic data to verified integrations; store it separately from humans and always label its origin in all projections.
7. Encrypt in transit; protect sensitive data at rest; minimize collection; plan access auditing and deletion.
8. Protect administrative changes and official-response claims with RBAC, provenance and immutable logs.

## Identity levels

| Level | Meaning | Allowed claim |
|---|---|---|
| Anonymous visitor | No account | May read public information |
| Authenticated account | Verified session; optionally email link | `Distinct authenticated accounts`, not people |
| Additional identity proofed (future) | Independent, audited proofing | Level/purpose disclosed; still evaluate uniqueness |
| Jurisdiction eligible (future) | Verified against appropriate criteria | Only for the defined consultation; not necessarily legal election eligibility |

National official electoral participation is **out of scope**. A website's advisory ballot must not be described as an official vote.

## Attack/abuse cases

- Multiple accounts per person (Sybil attack) and automated signups: rate limits, abuse analytics, user-visible limitations and independent verification research. Never claim "one person, one vote" based on a unique account key alone.
- Cross-account journal exposure via legacy route, SSE or caching: enumerate endpoints, write negative access tests, zero-cache private responses.
- IDOR on PATCH/DELETE/corrections/votes: verify owner on server regardless of client ID.
- Client forging `synthetic`, `source`, `location`, office response, or `verified` fields: never trust self-declared provenance.
- Prompt injection and hallucinated need extraction: treat journal text as untrusted, isolate prompts, limit model outputs, store extraction confidence/model version, allow correction.
- Defamation, personal data and threats in public text: moderation/appeal process and takedown; protect journal author privacy.
- DDoS, burst traffic and excessive LLM costs: API rate limits, quotas, circuit breakers, input-size limits, async processing.
- Secret exposure: never log or send cookies/tokens; disable `/api/debug/request` in deployed pilot; narrow CORS and apply security headers.
- Proposal editing after votes cast: proposal-version snapshot and explicit close/revote rule.
- Content poisoning to alter aggregated needs: dedupe, anomaly monitoring, audited thresholding, avoid treating clusters as representative polling.

## Specific safeguards for public API migration

- Gate all new real writes with authenticated sessions and ownership.
- Preserve demo endpoints only on intentionally demo-scoped data; public legacy reads must not reach production personal journals.
- Do not migrate or expose existing public demo journals as if they had newly given private/aggregate consent.
- With `DEMO_ENABLED=true`, make every tally/sample clearly labeled sample; with `PILOT_ENABLED=true`, read real data only through authorized pilot code paths.
- Use per-user and per-IP adaptive throttles, with attention to shared networks and accessibility; do not silently disenfranchise users.
- Response caching: `Cache-Control: private, no-store` for journal/receipt/account APIs.
- Protect cookie-based sessions with HTTP-only, Secure, SameSite appropriate cookies and CSRF protection where applicable; use parameterized DB access and robust schema validation.
- Separate trusted integration tokens from human sessions, and rotate credentials when exposed.

## Public accountability and governance

Publish a data use statement, privacy contact, data export/delete process, explanation of AI analysis, change-log of proposal versions, methods for a user to contest categorization, and clear boundary between measured vs simulated outputs. Create an independent review plan before claiming high-stakes public legitimacy.

## Release stop conditions

Any private data leak, public write authorization bypass, admin auth bypass, synthetic-to-real contamination, unmitigated duplicate ballot race, unverifiable deployment target or inability to roll back is a release blocker. No exception based on calendar deadlines.
