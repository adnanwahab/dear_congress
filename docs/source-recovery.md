# SHE-281 source recovery

Recovered the local application from /Users/wahabma/Desktop/dear_congress at
f53852e plus its uncommitted source, and integrated GitHub main at 47659fa.
The original local working tree is untouched. Runtime databases, credentials,
Mini Symphony state, and generated test databases are excluded.

## Integrated behavior

The repository now contains Dashboard, MapScreen, JournalScreen, WorkflowScreen,
Documentation, Navigation, county simulation fixtures and local integration source.
The newer main implementation of repository voting, citizen proposals, privacy,
moderation, public-write limits and signed anonymous identities is retained.
Demo votes are accepted by the same validation and cookie identity path.
Demo reset remains admin-only and preserves citizen proposals and moderation.
Browser build retains deferred MapLibre loading. Restored product routes use the
metadata-aware server shell. Ordinary pages retain SHE-276 security headers;
/embed uses FRAME_ANCESTORS (default self; Fly profile explicitly permits embeds).
Fly must not globally override CSP or it would override the embed policy.

fly.toml targets civic-synthesis, minimum one machine. The newer release-only
deploy workflow stays operator-gated; source pushes and tags do not deploy.
No production deployment, production-data writes or live-release claim occurred.
This is recovered local source, not proof of byte-for-byte equality with Fly.

## Acceptance and remaining handoff

Run bun test, bun run typecheck and bun run test:routes. Route smoke uses a real
production build with disposable databases and checks restored routes/assets,
404s, privacy headers and embed policy. Tests cover restart persistence, signed
cookie identities, independent demo ballots and invalid-write atomicity.
Human review and merge are required by AGENTS.md on launch day. After merge,
verify the recovery revision on main; have the maintainer identify/tag the actual
live release (do not call an undeployed recovery commit the current live build).
SHE-270/271/278/279 must remain open for acceptance against the recovered source.
Only then complete SHE-281; Mini Symphony's normal refresh releases its source
prerequisite holds. Production deployment stays separately held by SHE-280.

Validation: 224 local tests pass (99,104 assertions), typecheck and production
route smoke pass. Hosted CI caught a macOS-only temporary path in the recovered
public-plan test; it now uses node:os tmpdir for Linux runners as well.
