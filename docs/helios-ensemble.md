# HELIOS five-transformer ensemble (operator preview)

The /helios page offers a clearly **synthetic, offline example** of a civic policy
question reviewed through five lenses: Muse, Grok, Gemini, Claude and OpenAI.
The example contains invented responses and does not call model services.

The optional POST /api/helios/ensemble endpoint evaluates the same approved
question against **each configured provider concurrently**, then invokes the pure,
deterministic reduceHelios reducer. It returns every model's stance, benefits,
risks, assumptions, unanswered questions, failures and unconfigured status. The
reducer counts *model opinions*, not citizen votes. It does not claim verified facts,
public consensus, or authority to publish or merge laws.

## Enable an operator-only live evaluation

Keep the endpoint disabled unless a maintainer explicitly opts in.

- HELIOS_ENSEMBLE_ENABLED=1
- HELIOS_ENSEMBLE_TOKEN (a long random operator token, 24+ characters)
- Provider credentials, as needed: XAI_API_KEY, GEMINI_API_KEY,
  ANTHROPIC_API_KEY, OPENAI_API_KEY
- Model overrides: HELIOS_GROK_MODEL, HELIOS_GEMINI_MODEL,
  HELIOS_CLAUDE_MODEL, HELIOS_OPENAI_MODEL
- Muse is **not** presumed to have a universal public API. Connect an
  operator-controlled OpenAI Responses-compatible Muse service using
  HELIOS_MUSE_RESPONSES_URL (HTTPS), HELIOS_MUSE_MODEL and HELIOS_MUSE_API_KEY.
  Without all three, Muse is reported as unconfigured.

The operator enters only the HELIOS token in the browser; provider API keys stay
server-side. The UI requires affirmative consent before sending any text to
external providers. The endpoint validates the length (10-1800 characters),
uses the shared server IP/identity rate limiter, caps responses, and enforces
timeouts per provider. No journal, ballot, private draft, or database is read;
nothing is written to persistent storage or a public feed. Operators should
submit only public, non-sensitive questions and review the vendors' retention terms.

No model can vote, create a public proposal, adopt a recommendation, modify a
bill, trigger a merge, or deploy. A five-model result remains inspectable
AI-generated advisory analysis with original model-specific dissent.
Unavailable or malformed responses are shown as failures; no fake output replaces
them. The offline example is conspicuously labeled as invented.

## Verification

Run the following on the review branch:

    bun test src/server/helios-ensemble.test.ts
    bun test
    bun run typecheck
    bun run test:routes

No live provider call, production secret, or release is created by merging this
preview. Human acceptance is required before production activation.
