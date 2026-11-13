# Citizen proposals and advisory voting

This feature connects a person's own policy idea to a published proposal, public discussion, and advisory voting.

## User flow

1. Open `/votes` or `/feed` and choose **＋ Propose a law**.
2. Enter a title, the problem, the proposed change, and a jurisdiction. **Not sure** is a valid jurisdiction. A place name and supporting information are optional.
3. **Save draft** stores the draft in the current browser. It is not published or sent to the server. Drafts can be reopened from the proposal form.
4. Confirm the content can be public and choose **Publish for advisory voting**.
5. The server saves a permanent proposal at `/proposals/:id`. It appears in the feed and voting list with zero initial responses.
6. Visitors can support, oppose, choose **Not sure**, change or remove their response, and post a public comment.

Journal entries also offer **Turn this into a proposal**. This opens `/proposals/new?fromJournal=:entryId`, prefills the problem from the public journal, and retains the source entry ID. The person reviews and supplies the proposed rule before publishing. Conversion never casts a vote or publishes automatically.

## Meaning of a response

Responses are advisory and tracked by a server-issued anonymous browser cookie. They are not authenticated resident identities, verified turnout, a representative poll, or a legislative decision. Creating a proposal does not cast a response for its author. Citizen proposal responses never include simulated residents or the existing synthesis engine's illustrative support scores.

## Routes and integration

The new UI is isolated in `src/client/CitizenProposals.tsx`, with scoped styles in `src/client/citizen-proposals.css`. `App.tsx` selects it for `/votes`, `/feed`, `/proposals/new`, and `/proposals/:id`. Existing journal, needs, simulation voting, and synthesis views remain accessible.

The API uses the shared contract in `src/shared/citizen-proposals.ts`:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/citizen-proposals` | List published proposals and response totals |
| POST | `/api/citizen-proposals` | Publish a reviewed proposal |
| GET | `/api/citizen-proposals/:id` | Read a proposal, discussion, and this browser's response |
| POST | `/api/citizen-proposals/:id/vote` | Set or remove this browser's response |
| POST | `/api/citizen-proposals/:id/comments` | Post a public discussion comment |
| GET | `/api/citizen-proposals/journal/:id` | Read a public journal entry for draft prefill |

HTTP requests use a server-issued signed anonymous cookie; client-supplied `x-voter-id` is ignored. Non-browser clients must retain a cookie jar. See the public-write security section in `readme.md` for limits, deployment configuration, and legacy-ID behavior. Read responses do not disclose voter identifiers, ownership hashes, or idempotency keys. Responses use `Cache-Control: no-store` because `ownVote` is browser-specific.

Publishing requires `title`, `problem`, `proposedChange`, `jurisdiction`, a stable UUID `idempotencyKey`, and `confirmedPublic: true`. Optional fields are `jurisdictionName`, `supportingInfo`, and `sourceEntryId`. Jurisdictions are `city`, `county`, `state`, `federal`, and `unsure`. Vote bodies are `{ "choice": "support" }`, `oppose`, `unsure`, or `null` to remove the response. Comment bodies contain `text`, an optional `displayName`, and their own stable UUID `idempotencyKey`.

Publication and comment retries reuse their key. The same key and normalized content return the existing result; the same key with different content returns HTTP 409. Invalid input returns a useful 400 response, missing records return 404, and oversized requests return 413. Each response includes only the fields intended for the public UI.

## Persistence

Published proposals, discussion, and browser responses are stored in the existing JSON database through the optional `citizenProposals` field. Existing databases require no destructive migration. Database saves are serialized and written through a temporary file plus atomic rename so concurrent responses cannot replace a newer snapshot with an older one. This remains the application's existing single-process storage model; a multi-writer deployment needs a shared transactional database.

Resetting the simulation demo preserves published proposals, their discussion, responses, and cited journal entries. Browser drafts remain on the device that saved them. Published proposal text is immutable in this first version, so votes refer to the same text that was reviewed.

## Verification

Run the repository's existing commands:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:proposals-ui
```

`src/server/citizen-proposals.test.ts` exercises validation, idempotent publishing, vote replacement/removal, public response filtering, and persistence failure handling. `server.citizen-proposals.integration.test.ts` uses a separate server process and temporary database to verify the HTTP journey and persistence across restart. Test proposals are never submitted to the deployed app.

`test:proposals-ui` runs the React components in Happy DOM against another isolated real HTTP server. It checks saved drafts, explicit publishing, voting, discussion, escaped user text, the feed, journal prefill, missing-source recovery, not-found handling, and recovery after a lost successful publication response. This verifies form interactions and API integration; it does not verify native browser rendering or visual layout.

For a UI check, use a temporary database and open `/votes`. Save and reload a draft, publish it, open the link in a second browser context, change a vote, add a comment, and confirm the feed and detail agree. Also test a journal conversion and a narrow mobile viewport.

## Deployment source alignment

This branch was prepared against GitHub `main` at `f53852e9d6537ae98e3e09fe792d0f4d9fdc5711`. At implementation time, that source used `/vote` and `fly.toml` targeted `dear-congress`, while the inspected `civic-synthesis.fly.dev` deployment already had newer `/votes`, `/feed`, and sample-draft screens absent from this repository.

Before production rollout, bring the current deployed source into the repository and integrate these modules with its existing screens. On the newer UI, reuse the form/detail components and API, add the proposal CTA to the existing voting screen, include published citizen proposals alongside clearly labelled sample content, and add the journal conversion link. Preserve the deployed app's other routes and features. Verify the intended Fly app and persistent volume before deploying. This branch does not change `fly.toml`, trigger a production deployment, or claim the live app has already changed.

## Private amendment preparation (SHE-305 first slice)

Citizen proposal details now offer **Suggest amendment**. The recovered sample
`/draft` and `/votes` screens offer the same editor, explicitly labelled fictional.
The source's entire proposed text is one editable section; this does not infer
legal clause boundaries. Replace text, supply rationale, impact/cost (unknown is
valid), and a citation note with title, URL, locator, date and excerpt/version.
The comparison labels Removed/Added alongside strike/underline and stacks on
narrow screens. It highlights one changed span between the shared prefix/suffix;
it is not a semantic legal diff or a minimal word diff.

**Save new private version** appends an exact text/source snapshot and metadata
in browser-local storage, isolated by source kind and proposal ID. Saved versions
can be reopened after reload; saving edits creates another version. Origin,
jurisdiction, title, text, timestamp and an unverified browser author label stay
attached to each saved version. The editor blocks a stale-source save and offers
an explicit fresh start, preserving earlier saved versions. An unsaved working
copy is lost on navigation; save before switching proposals. A fresh start clears
the working fields, so save any needed work before accepting it.

No amendment API, moderation submission, publication or voting option exists in
this slice. Publication permission is recorded as **not requested**. There is no
public author-name field. Citation notes render as escaped plain text, including
URLs; nothing is fetched or treated as verified evidence. Parent text, votes,
comments, source journal identity and repository ballots are untouched.

Local storage is accessible to users of the same browser profile and scripts on
this origin; it is not an authenticated private account or durable audit history.
Clearing it loses drafts. The app appends snapshots but storage can be edited and
has no tamper protection, backup or cross-tab transaction guarantee. Each proposal
is limited to 30 saved versions. Corrupt/unreadable storage and failed saves
produce an error without intentionally overwriting earlier records. Do not use
this preparation feature for sensitive personal information.

`bun test` includes model fixtures and an isolated Happy DOM walkthrough through
`src/client/amendment-ui.test.ts` / `scripts/verify-amendments-ui.tsx`. The existing
`bun run test:proposals-ui` additionally checks that amendment preparation on a
real citizen detail does not change its public API text, options or ballots.
Native browser, zoom/contrast, keyboard-only and screen-reader verification remain
manual acceptance tasks. See `docs/reviews/SHE-305.md` for remaining delivery.
